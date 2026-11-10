import type { IScreenSeedRepository, SeedInstalledScreen } from '../repositories/IScreenSeedRepository';
import {
  declaredScreenSeeds,
  needsEmptinessCheck,
  planScreenSeed,
  resolveSeedData,
} from '../schema/screenSeed';
import type { DeclaredScreenSeed, ExtensionSeedState, ScreenSeedFailure } from '../schema/screenSeed';

/** A reserva de uma passada: folga sobre o `timeoutSeconds` (300) da function que a executa. */
export const SCREEN_SEED_LEASE_MS = 6 * 60_000;

/**
 * Quantas vezes uma passada recomeça porque o pacote mudou enquanto ela corria. A entrega do gatilho
 * da versão nova encontra a reserva desta e sai sem fazer nada; é esta passada que tem de enxergar a
 * mudança, ou as sementes da versão nova esperariam pela próxima gravação da instalação.
 */
const MAX_PASSES = 3;

/** Quantas sementes gravam ao mesmo tempo. A ordem de entrega não importa: cada uma é um registro. */
const CONCURRENCY = 4;

/** A recusa que quer dizer "o escritório já tem este registro" — conta como entregue, como na lista. */
const KEY_CONFLICT = '@core.automation/mutation.upsert.key-conflict';

export type SeedWriteOutcome =
  | { ok: true }
  | { ok: false; error: string; errorParams?: Record<string, string> };

export interface ScreenSeedTotals {
  created: number;
  /** A semente que esbarrou numa chave declarada: o escritório já tinha o registro. */
  matched: number;
  failed: number;
}

export interface ScreenSeedPassSummary extends ScreenSeedTotals {
  pluginId: string;
  screens: number;
}

export interface ScreenSeedDeps {
  repository: IScreenSeedRepository;
  /**
   * Cria UM registro pelo caminho de gravação de sempre (`runWorkflowUpsert` com `seed`). É chamado só
   * depois de `prepare`, que deixa a declaração das telas fresca.
   */
  writeSeed: (tenantId: string, collection: string, data: Record<string, unknown>) => Promise<SeedWriteOutcome>;
  /** Relê a declaração das telas: a passada corre segundos depois de a instalação gravá-las. */
  prepare: (tenantId: string) => Promise<void>;
  /** A tradução de uma referência no idioma do escritório, com o catálogo do pacote por baixo. */
  resolverFor: (tenantId: string, pkg: unknown) => Promise<(ref: string) => string>;
  /** A linha ÚNICA de Auditoria da passada. */
  recordPass: (tenantId: string, summary: ScreenSeedPassSummary) => Promise<void>;
  now: () => number;
  logger: { warn: (message: string) => void };
}

const fingerprint = (seeds: readonly DeclaredScreenSeed[]): string => JSON.stringify(seeds);

const hasWork = (seeds: readonly DeclaredScreenSeed[], state: ExtensionSeedState): boolean =>
  seeds.some((seed) => {
    const entry = state.screens[seed.sourceId];
    if (needsEmptinessCheck(seed.mode, entry)) return true;
    return planScreenSeed(seed.mode, seed.records, entry, false).create.length > 0;
  });

const inLanes = async <T>(items: readonly T[], worker: (item: T) => Promise<void>): Promise<void> => {
  let next = 0;
  const drain = async (): Promise<void> => {
    while (next < items.length) {
      const item = items[next];
      next += 1;
      await worker(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, drain));
};

const seedScreen = async (
  tenantId: string,
  pluginId: string,
  seed: DeclaredScreenSeed,
  screen: SeedInstalledScreen,
  state: ExtensionSeedState,
  resolve: (ref: string) => string,
  deps: ScreenSeedDeps,
): Promise<ScreenSeedTotals> => {
  const { repository } = deps;
  const entry = state.screens[seed.sourceId];
  const empty = needsEmptinessCheck(seed.mode, entry)
    ? await repository.isCollectionEmpty(tenantId, screen.collection)
    : false;
  const plan = planScreenSeed(seed.mode, seed.records, entry, empty);
  const failures: ScreenSeedFailure[] = [];
  const totals: ScreenSeedTotals = { created: 0, matched: 0, failed: 0 };

  // A decisão do `when-empty` é gravada ANTES da primeira semente: depois dela a coleção já não está
  // vazia, e uma retomada sem a decisão concluiria que não há o que semear.
  await repository.saveScreen(tenantId, pluginId, seed.sourceId, plan.entry, state.failures[seed.sourceId] ?? []);

  await inLanes(plan.create, async (record) => {
    const outcome = await deps.writeSeed(tenantId, screen.collection, resolveSeedData(record.data, seed.fields, resolve));
    if (outcome.ok || outcome.error === KEY_CONFLICT) {
      await repository.markDelivered(tenantId, pluginId, seed.sourceId, record.key);
      if (outcome.ok) totals.created += 1;
      else totals.matched += 1;
      return;
    }
    totals.failed += 1;
    failures.push({ key: record.key, error: outcome.error, ...(outcome.errorParams ? { errorParams: outcome.errorParams } : {}) });
  });

  await repository.saveScreen(tenantId, pluginId, seed.sourceId, plan.entry, failures);
  return totals;
};

/**
 * Uma passada de semeadura de UMA extensão no escritório. Devolve `null` quando não havia o que fazer
 * — inclusive quando outra passada já tem a reserva.
 *
 * A semente que falha (o escritório acrescentou um campo obrigatório, uma regra recusa o valor) não
 * para as outras: fica fora de `delivered`, com o motivo em `failures`, e é tentada de novo na próxima
 * passada. A que esbarra numa chave declarada conta como ENTREGUE — o escritório já tinha o registro, e
 * é a mesma regra da lista, que não duplica a opção que ele já tem pelo rótulo.
 */
export const runScreenSeedPass = async (
  tenantId: string,
  pluginId: string,
  deps: ScreenSeedDeps,
): Promise<ScreenSeedPassSummary | null> => {
  const { repository } = deps;
  const installed = await repository.readInstalled(tenantId, pluginId);
  if (!installed?.active) return null;
  let seeds = declaredScreenSeeds(installed.package);
  if (seeds.length === 0) return null;
  // A conferência sem reserva: quase toda gravação da instalação (ligar, revisar código, o carimbo do
  // backend) não tem semente pendente, e custa uma leitura em vez de uma transação.
  if (!hasWork(seeds, await repository.readState(tenantId, pluginId))) return null;

  const claimed = await repository.claim(tenantId, pluginId, deps.now(), SCREEN_SEED_LEASE_MS);
  if (!claimed) return null;

  const summary: ScreenSeedPassSummary = { pluginId, screens: 0, created: 0, matched: 0, failed: 0 };
  try {
    let state = claimed;
    let pkg = installed.package;
    for (let pass = 0; pass < MAX_PASSES; pass += 1) {
      await deps.prepare(tenantId);
      const screens = new Map((await repository.installedScreens(tenantId)).map((screen) => [screen.sourceId, screen]));
      const resolve = await deps.resolverFor(tenantId, pkg);
      for (const seed of seeds) {
        const screen = screens.get(seed.sourceId);
        if (!screen) {
          deps.logger.warn(`tela ${seed.sourceId} de ${pluginId} não está instalada em ${tenantId}; semente adiada`);
          continue;
        }
        const totals = await seedScreen(tenantId, pluginId, seed, screen, state, resolve, deps);
        if (totals.created + totals.matched + totals.failed > 0) summary.screens += 1;
        summary.created += totals.created;
        summary.matched += totals.matched;
        summary.failed += totals.failed;
      }

      const current = await repository.readInstalled(tenantId, pluginId);
      if (!current?.active) break;
      const next = declaredScreenSeeds(current.package);
      if (fingerprint(next) === fingerprint(seeds)) break;
      seeds = next;
      pkg = current.package;
      state = await repository.readState(tenantId, pluginId);
    }
  } finally {
    await repository.release(tenantId, pluginId);
  }

  if (summary.created + summary.failed > 0) await deps.recordPass(tenantId, summary);
  return summary;
};
