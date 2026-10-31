import type { IPortalRepository, PortalReprojectionState, PortalScreen } from '../repositories/IPortalRepository';
import { portalFieldKeys, portalReferenceLabels } from '../schema/portal';
import { PORTAL_PROJECTION_REVISION, isPortalProjectionBehind, isPortalReprojectionStalled } from '../schema/portalReprojection';
import type { ProjectPortalRecordUseCase } from './PortalProjectionUseCases';

/** Registros por rodada. Uma rodada é uma invocação: pequena o bastante para caber com folga no timeout. */
export const PORTAL_REPROJECTION_PAGE_SIZE = 200;
/**
 * Registros projetados ao mesmo tempo dentro de uma rodada. Cada projeção gravada acorda os gatilhos
 * que escutam o tenant inteiro: o paralelismo daqui é multiplicado por eles em instâncias.
 */
const RECORD_CONCURRENCY = 4;
/** Reserva de uma rodada. Maior que o timeout da function que a executa. */
export const PORTAL_REPROJECTION_LEASE_MS = 6 * 60_000;
/** Quantas vezes uma passada com falha recomeça antes de parar com a contagem à vista. */
export const PORTAL_REPROJECTION_MAX_ATTEMPTS = 3;
/** Quantos ids com falha o job guarda — o bastante para investigar, sem crescer sem teto. */
const MAX_FAILED_IDS = 50;

/** As entidades para onde o vínculo da tela aponta — o pai, ou o `refEntity` do campo-sujeito. */
const subjectTargetsOf = (screen: PortalScreen): string[] => {
  const subject = screen.portal?.subject;
  if (!subject || subject === 'self') return [];
  if (subject === 'parent') return screen.parentEntity ? [screen.parentEntity] : [];
  const field = screen.fields.find((one) => one.key === subject.field);
  return field?.type === 'reference' && field.refEntity ? [field.refEntity] : [];
};

/**
 * As entidades cujo TÍTULO a tela mostra como rótulo de uma referência exposta — e, quando o título do
 * apontado é outra referência, a do segundo salto (o contribuinte da comunicação que aponta para o
 * domicílio dele).
 */
const labelTargetsOf = (screens: readonly PortalScreen[], screen: PortalScreen): string[] => [
  ...portalFieldKeys(screen).flatMap((key) => {
    const field = screen.fields.find((one) => one.key === key);
    return field?.type === 'reference' && field.refEntity ? [field.refEntity] : [];
  }),
  ...portalReferenceLabels(screens, screen).flatMap((label) =>
    (label.through ? [label.through.target.id, label.through.target.collection] : [])),
];

/**
 * As coleções cuja projeção pode ter mudado quando a declaração de UMA tela mudou — e só elas.
 *
 * - a própria (pelo nome de antes e de depois: mudar `dataCollection` deixa projeções no nome velho);
 * - as que chegam ao sujeito ATRAVÉS dela, em qualquer profundidade: o filho, o neto. O sujeito
 *   delas pode ter mudado, e um registro escondido corta a corrente de todos;
 * - as que mostram o título dela no rótulo de uma referência exposta, direto ou pelo segundo salto
 *   (`through`). Só essas: o rótulo é o título do registro apontado, e o sujeito de quem aponta não
 *   muda por isso.
 */
export const portalReprojectionScope = (
  screens: readonly PortalScreen[],
  changed: { screenId: string; collections: readonly string[] },
): string[] => {
  const portalScreens = screens.filter((screen) => !!screen.portal);
  const reached = new Set<string>([changed.screenId, ...changed.collections]);
  const collections = new Set<string>(changed.collections);

  for (const screen of portalScreens) {
    if (labelTargetsOf(screens, screen).some((key) => reached.has(key))) collections.add(screen.collection);
  }

  for (let grew = true; grew;) {
    grew = false;
    for (const screen of portalScreens) {
      if (reached.has(screen.id) || !subjectTargetsOf(screen).some((key) => reached.has(key))) continue;
      reached.add(screen.id);
      reached.add(screen.collection);
      collections.add(screen.collection);
      grew = true;
    }
  }
  return [...collections];
};

const freshPass = (
  status: 'queued' | 'running',
  generation: number,
  attempts: number,
  total: number | null,
  now: number,
): PortalReprojectionState => ({
  status,
  generation,
  round: 0,
  cursor: null,
  leaseUntil: null,
  touchedAt: now,
  openedAt: now,
  total,
  processed: 0,
  failed: 0,
  failedIds: [],
  attempts,
  revision: PORTAL_PROJECTION_REVISION,
});

/**
 * A passada nova entra na fila — a não ser que a da mesma coleção já esteja andando: então ela segue
 * andando, do começo, e a rodada em voo da passada anterior é descartada pela geração.
 */
const queuedPass = (current: PortalReprojectionState | null, total: number | null, now: number): PortalReprojectionState =>
  freshPass(current?.status === 'running' ? 'running' : 'queued', (current?.generation ?? 0) + 1, 0, total, now);

/** A próxima da fila — a aberta há mais tempo —, ou nenhuma, se alguma passada já anda. */
export const nextQueuedReprojection = (states: ReadonlyMap<string, PortalReprojectionState>): string | null => {
  const all = [...states.entries()];
  if (all.some(([, state]) => state.status === 'running')) return null;
  const queued = all
    .filter(([, state]) => state.status === 'queued')
    .sort(([a, one], [b, other]) => one.openedAt - other.openedAt || a.localeCompare(b));
  return queued[0]?.[0] ?? null;
};

/**
 * Põe a próxima da fila para andar, quando nenhuma anda. A gravação é o que dispara a primeira rodada
 * dela. A transação lê os jobs do escritório inteiro: duas chamadas juntas não põem duas para andar.
 */
const promoteNextReprojection = async (repo: IPortalRepository, tenantId: string, now: number): Promise<string | null> => {
  const changed = await repo.updateReprojections(tenantId, (states) => {
    const next = nextQueuedReprojection(states);
    const state = next ? states.get(next) : undefined;
    return next && state ? new Map([[next, { ...state, status: 'running', touchedAt: now }]]) : new Map();
  });
  return [...changed.keys()][0] ?? null;
};

export type StartPortalReprojectionUseCase = {
  /** Abre uma passada nova em cada coleção, na fila do escritório. */
  execute: (tenantId: string, collections: readonly string[]) => Promise<void>;
};

/**
 * Uma passada nova, sempre do começo — inclusive sobre uma em curso: a declaração mudou de novo, e o
 * que a passada anterior já tinha feito foi feito pela declaração de antes. A geração nova faz a
 * rodada que ainda estiver em voo ser descartada ao fechar.
 *
 * O tamanho é contado ao abrir — os registros da coleção, ou as projeções dela quando ela saiu do
 * portal —, só para o escritório ver o andamento. A contagem que falha não segura a passada: o
 * andamento fica sem o total.
 */
export const makeStartPortalReprojectionUseCase = (
  repo: IPortalRepository,
  now: () => number = Date.now,
): StartPortalReprojectionUseCase => ({
  execute: async (tenantId, collections) => {
    const screens = await repo.getScreens(tenantId);
    for (const collection of new Set(collections)) {
      const inPortal = screens.some((screen) => screen.collection === collection && !!screen.portal);
      const total = await (inPortal ? repo.countRecords(tenantId, collection) : repo.countProjectionsOfCollection(tenantId, collection))
        .catch(() => null);
      await repo.updateReprojection(tenantId, collection, (current) => queuedPass(current, total, now()));
    }
    await promoteNextReprojection(repo, tenantId, now());
  },
});

export type EnsurePortalProjectionRevisionUseCase = {
  /** Devolve as coleções em que uma passada foi aberta. */
  execute: (tenantId: string) => Promise<string[]>;
};

/**
 * Abre uma passada em cada coleção do portal cuja última passada é de uma
 * `PORTAL_PROJECTION_REVISION` anterior — ou que nunca teve passada. É o que leva ao escritório uma
 * correção na forma de projetar sem que ninguém precise mexer na declaração, nem saber da correção.
 * A revisão que só corrige um caso raro alcança só as coleções que o têm (`isPortalProjectionBehind`):
 * as outras ficam na revisão gravada, sem passada nenhuma.
 *
 * A conferência é refeita dentro da transação: duas instâncias que chegam juntas abrem UMA passada.
 */
export const makeEnsurePortalProjectionRevisionUseCase = (
  repo: IPortalRepository,
  now: () => number = Date.now,
): EnsurePortalProjectionRevisionUseCase => ({
  execute: async (tenantId) => {
    const screens = await repo.getScreens(tenantId);
    const isBehind = (collection: string, state: PortalReprojectionState | null | undefined): boolean =>
      isPortalProjectionBehind(state?.revision ?? 0, screens, collection);
    const inPortal = [...new Set(screens.filter((screen) => !!screen.portal).map((screen) => screen.collection))];
    if (inPortal.length === 0) return [];

    const states = await repo.listReprojections(tenantId);
    const opened: string[] = [];
    for (const collection of inPortal.filter((one) => isBehind(one, states.get(one)))) {
      const total = await repo.countRecords(tenantId, collection).catch(() => null);
      const next = await repo.updateReprojection(tenantId, collection, (current) =>
        isBehind(collection, current) ? queuedPass(current, total, now()) : null);
      if (next) opened.push(collection);
    }
    if (opened.length > 0) await promoteNextReprojection(repo, tenantId, now());
    return opened;
  },
});

interface RoundResult {
  processed: number;
  failed: number;
  failedIds: string[];
  next: string | null;
}

const runPool = async <T>(items: readonly T[], size: number, work: (item: T) => Promise<void>): Promise<void> => {
  let next = 0;
  const lanes = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next];
      next += 1;
      await work(item);
    }
  });
  await Promise.all(lanes);
};

const isSameRound = (state: PortalReprojectionState, claimed: PortalReprojectionState): boolean =>
  state.generation === claimed.generation && state.round === claimed.round;

/**
 * Fecha a rodada. Com página seguinte, avança o cursor — e essa gravação dispara a próxima. No fim, sem
 * falha, a passada termina. Com falha, recomeça até `PORTAL_REPROJECTION_MAX_ATTEMPTS` vezes — falha
 * passageira não pede ninguém, e refazer uma projeção é idempotente — e depois para com a contagem.
 */
export const completePortalReprojectionRound = (
  state: PortalReprojectionState,
  result: RoundResult,
  now: number,
): PortalReprojectionState => {
  const totals: PortalReprojectionState = {
    ...state,
    processed: state.processed + result.processed,
    failed: state.failed + result.failed,
    failedIds: [...state.failedIds, ...result.failedIds].slice(0, MAX_FAILED_IDS),
    leaseUntil: null,
    touchedAt: now,
  };
  if (result.next !== null) return { ...totals, cursor: result.next, round: state.round + 1 };
  if (totals.failed === 0) return { ...totals, status: 'done', cursor: null, attempts: 0 };
  const attempts = state.attempts + 1;
  if (attempts < PORTAL_REPROJECTION_MAX_ATTEMPTS) return freshPass('running', state.generation + 1, attempts, state.total, now);
  return { ...totals, status: 'done', cursor: null, attempts };
};

export type RunPortalReprojectionRoundUseCase = {
  execute: (tenantId: string, collection: string) => Promise<void>;
};

/**
 * Uma rodada da passada de uma coleção: reserva o job, processa uma página a partir do cursor e fecha.
 *
 * A declaração é relida a cada rodada, sem cache. Se a coleção ainda está no portal, cada registro da
 * página é projetado de novo — sem cascata, porque os dependentes estão no escopo da passada. Se saiu,
 * a página é de PROJEÇÕES, e cada uma é apagada.
 *
 * Uma falha da rodada inteira solta a reserva e sobe, para o gatilho reentregar; a falha de um registro
 * é contada e a página segue — um registro problemático não pode deixar os outros para trás.
 */
export const makeRunPortalReprojectionRoundUseCase = (
  repo: IPortalRepository,
  projectRecord: ProjectPortalRecordUseCase,
  now: () => number = Date.now,
): RunPortalReprojectionRoundUseCase => ({
  execute: async (tenantId, collection) => {
    const claimed = await repo.updateReprojection(tenantId, collection, (current) =>
      current?.status === 'running' && (current.leaseUntil === null || current.leaseUntil <= now())
        ? { ...current, leaseUntil: now() + PORTAL_REPROJECTION_LEASE_MS, touchedAt: now() }
        : null);
    if (!claimed) return;

    try {
      const screens = await repo.getScreens(tenantId, { fresh: true });
      const inPortal = screens.some((screen) => screen.collection === collection && !!screen.portal);
      const result: RoundResult = { processed: 0, failed: 0, failedIds: [], next: null };
      const attempt = async (id: string, work: () => Promise<unknown>) => {
        try {
          await work();
        } catch {
          result.failed += 1;
          result.failedIds.push(id);
        }
      };

      if (inPortal) {
        const page = await repo.listRecords(tenantId, collection, claimed.cursor, PORTAL_REPROJECTION_PAGE_SIZE);
        await runPool(page.items, RECORD_CONCURRENCY, (record) => attempt(record.id, () => projectRecord.execute({
          tenantId, collection, recordId: record.id, data: record.data, syncDocuments: true, cascade: false,
        })));
        result.processed = page.items.length;
        result.next = page.next;
      } else {
        const page = await repo.projectionsOfCollection(tenantId, collection, claimed.cursor, PORTAL_REPROJECTION_PAGE_SIZE);
        await runPool(page.items, RECORD_CONCURRENCY, (item) => attempt(item.id, () => repo.deleteProjection(tenantId, item.id)));
        result.processed = page.items.length;
        result.next = page.next;
      }

      const closed = await repo.updateReprojection(tenantId, collection, (current) =>
        current && isSameRound(current, claimed) ? completePortalReprojectionRound(current, result, now()) : null);
      if (closed?.status === 'done') await promoteNextReprojection(repo, tenantId, now());
    } catch (error) {
      await repo
        .updateReprojection(tenantId, collection, (current) =>
          current && isSameRound(current, claimed) ? { ...current, leaseUntil: null, touchedAt: now() } : null)
        .catch(() => undefined);
      throw error;
    }
  },
});

export type NudgePortalReprojectionsUseCase = {
  /** Devolve quantas passadas paradas foram acordadas. */
  execute: (tenantId: string) => Promise<number>;
};

/**
 * Acorda a passada que parou — a rodada falhou além da janela de reentrega, ou a function caiu sem
 * soltar a reserva. Tocar o job (sem reserva, com `touchedAt` novo) é o que dispara a rodada, e ela
 * continua do cursor: nada do que já foi feito é refeito. E, se nenhuma anda, a fila anda: a promoção
 * que falhou ao fim de uma passada não deixa as outras esperando para sempre.
 */
export const makeNudgePortalReprojectionsUseCase = (
  repo: IPortalRepository,
  now: () => number = Date.now,
): NudgePortalReprojectionsUseCase => ({
  execute: async (tenantId) => {
    const isStalled = (state: PortalReprojectionState | null): state is PortalReprojectionState =>
      !!state && isPortalReprojectionStalled(state, now());
    let woken = 0;
    for (const [collection, state] of await repo.listReprojections(tenantId)) {
      if (!isStalled(state)) continue;
      const touched = await repo.updateReprojection(tenantId, collection, (current) =>
        isStalled(current) ? { ...current, leaseUntil: null, touchedAt: now() } : null);
      if (touched) woken += 1;
    }
    if (await promoteNextReprojection(repo, tenantId, now())) woken += 1;
    return woken;
  },
});
