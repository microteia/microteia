import type {
  IRecordKeyAdoptionRepository,
  RecordKeyAdoptionRequest,
} from '../repositories/IRecordKeyAdoptionRepository';
import {
  declaredRecordKeySignatures,
  planRecordKeyAdoption,
  readRecordKeyAdoptionState,
  RECORD_KEY_ADOPTION_MAX_ATTEMPTS,
  RECORD_KEY_ADOPTION_MAX_LISTED,
} from '../schema/recordKeyAdoption';
import type {
  RecordKeyAdoptionBlockage,
  RecordKeyAdoptionIssue,
  RecordKeyAdoptionPlan,
  RecordKeyAdoptionState,
} from '../schema/recordKeyAdoption';
import type { RecordKeyEntry, ScopedRecordKeySpec } from '../schema/recordKeys';
import { planRecordKeys, storedRecordKeyRefs } from '../schema/recordKeys';
import { isBookkeepingWrite } from './recordBookkeeping';
import { resolveWritableTable } from '../schema/mutationSpec';
import type { SchemaContext } from '../schema/pathResolver';
import { resolveRecordKeys } from '../schema/screenEntity';

/** Registros por rodada. A maioria passa sem transação — só o que ainda não cita a reserva paga uma. */
export const RECORD_KEY_ADOPTION_PAGE_SIZE = 200;

/** Registros adotados ao mesmo tempo dentro de uma rodada. */
const RECORD_CONCURRENCY = 8;

/** Reserva de uma rodada. Maior que o timeout da function que a executa. */
export const RECORD_KEY_ADOPTION_LEASE_MS = 6 * 60_000;

const MAX_FAILED_IDS = 50;

export interface RecordKeyAdoptionDeps {
  adoptionRepository: IRecordKeyAdoptionRepository;
  /** O contexto relido do banco, sem cache: a rodada não pode agir sobre a declaração de antes. */
  freshSchemaContext: (tenantId: string) => Promise<SchemaContext>;
  now: () => number;
  logger?: { warn: (message: string) => void };
  /** O registro único de uma passada que terminou — no lugar de uma linha por registro. */
  recordPassFinished?: (tenantId: string, collection: string, state: RecordKeyAdoptionState) => Promise<void>;
}

// ─── A decisão sobre UM registro ─────────────────────────────────────────────

/** O que a transação leu: a reserva de cada id citado, e quais delas têm dono vivo. */
export interface RecordKeyAdoptionSnapshot {
  recordId: string;
  stored: Record<string, string>;
  request: RecordKeyAdoptionRequest;
  /** keyId → registro que a reserva aponta, ou `null` quando a reserva não existe. */
  reservations: ReadonlyMap<string, string | null>;
  /** keyIds reservados por OUTRO registro que existe e ainda os cita em `keyRefs`. */
  liveHolders: ReadonlySet<string>;
}

export interface RecordKeyAdoptionDecision {
  /** Reservas a gravar — inclusive por cima de uma órfã, que nenhum registro vivo cita. */
  create: RecordKeyEntry[];
  release: string[];
  /** Nome → id a citar em `keyRefs`; `null` tira a citação. Só o que muda. */
  refs: Record<string, string | null>;
  issues: RecordKeyAdoptionIssue[];
}

/**
 * O que a adoção faz com um registro. Pura: a transação lê, isto decide, a transação grava.
 *
 * A reserva ocupada só é CONFLITO quando o dono existe e ainda a cita — uma reserva que ninguém cita
 * é resto de uma gravação interrompida, e prendê-la para sempre transformaria um acidente numa
 * duplicata que ninguém consegue resolver.
 *
 * O registro em conflito mantém o que já citava. Sob uma normalização anterior, aquela reserva
 * continua impedindo o valor antigo de ser reusado enquanto a pessoa decide.
 */
export const decideRecordKeyAdoption = (snapshot: RecordKeyAdoptionSnapshot): RecordKeyAdoptionDecision => {
  const { recordId, stored, request, reservations, liveHolders } = snapshot;
  const decision: RecordKeyAdoptionDecision = { create: [], release: [], refs: {}, issues: [] };
  const owns = (keyId: string | undefined): keyId is string =>
    keyId !== undefined && reservations.get(keyId) === recordId;
  const releaseCurrent = (name: string, next: string | null): void => {
    const current = stored[name];
    if (current === undefined || current === next) return;
    if (owns(current)) decision.release.push(current);
    decision.refs[name] = next;
  };

  for (const name of request.names) {
    const gap = request.plan.gaps.find((one) => one.name === name);
    if (gap) {
      decision.issues.push({ key: name, kind: 'missing', recordId, values: [] });
      continue;
    }
    const entry = request.plan.entries.find((one) => one.name === name);
    if (!entry) {
      releaseCurrent(name, null);
      continue;
    }
    const holder = reservations.get(entry.keyId) ?? null;
    if (holder !== null && holder !== recordId && liveHolders.has(entry.keyId)) {
      decision.issues.push({ key: name, kind: 'duplicate', recordId, holderId: holder, values: entry.values });
      continue;
    }
    if (holder !== recordId) decision.create.push(entry);
    if (stored[name] !== entry.keyId) {
      releaseCurrent(name, entry.keyId);
      decision.refs[name] = entry.keyId;
    }
  }
  return decision;
};

// ─── O job ───────────────────────────────────────────────────────────────────

const EMPTY_STATE: RecordKeyAdoptionState = readRecordKeyAdoptionState({});

const freshPass = (
  base: RecordKeyAdoptionState,
  pending: Record<string, string>,
  adopted: Record<string, string>,
  attempts: number,
  now: number,
): RecordKeyAdoptionState => ({
  ...EMPTY_STATE,
  status: 'running',
  pending,
  adopted,
  generation: base.generation + 1,
  attempts,
  touchedAt: now,
});

/** A passada terminou limpa: o que estava em adoção passa a valer. */
const adoptPending = (state: RecordKeyAdoptionState, now: number): RecordKeyAdoptionState => ({
  ...state,
  status: 'done',
  adopted: { ...state.adopted, ...state.pending },
  pending: {},
  cursor: null,
  leaseUntil: null,
  attempts: 0,
  issues: [],
  issueCount: 0,
  recheck: false,
  touchedAt: now,
});

/** O estado que um plano produz — ou `null` quando ele não muda nada. */
export const applyRecordKeyAdoptionPlan = (
  state: RecordKeyAdoptionState | null,
  plan: RecordKeyAdoptionPlan,
  now: number,
): RecordKeyAdoptionState | null => {
  switch (plan.kind) {
    case 'none':
      return null;
    case 'start':
      return freshPass(state ?? EMPTY_STATE, plan.pending, plan.adopted, 0, now);
    case 'resume':
      if (!state) return null;
      return { ...state, status: 'running', blocked: [], leaseUntil: null, generation: state.generation + 1, touchedAt: now };
    case 'nudge':
      return state ? { ...state, leaseUntil: null, touchedAt: now } : null;
    case 'settle':
      if (!state) return null;
      return plan.finish
        ? {
          ...state,
          status: 'done',
          pending: {},
          adopted: plan.adopted,
          cursor: null,
          leaseUntil: null,
          attempts: 0,
          failed: 0,
          failedIds: [],
          issues: [],
          issueCount: 0,
          blocked: [],
          recheck: false,
          generation: state.generation + 1,
          touchedAt: now,
        }
        : { ...state, adopted: plan.adopted, touchedAt: now };
    default:
      return null;
  }
};

/**
 * Pede que os conflitos listados sejam reconferidos, porque um dos registros deles mudou — o
 * duplicado, ou o dono da reserva. `null` quando o registro não está na lista, que é o caso de quase
 * toda gravação.
 *
 * Vale também no meio da passada: o conflito achado na primeira página pode ser resolvido antes de a
 * última terminar, e a passada que fecha com o pedido em mãos reconfere a lista na rodada seguinte.
 */
export const requestRecordKeyRecheck = (
  state: RecordKeyAdoptionState,
  recordId: string,
  now: number,
): RecordKeyAdoptionState | null => {
  if (state.issueCount === 0 || state.recheck) return null;
  const listed = state.issues.some((issue) => issue.recordId === recordId || issue.holderId === recordId);
  return listed ? { ...state, recheck: true, touchedAt: now } : null;
};

export interface RecordKeyAdoptionRoundIdentity {
  generation: number;
  round: number;
  /** A rodada reconfere só os conflitos listados, em vez de seguir o cursor. */
  recheck: boolean;
}

/**
 * Reserva a rodada: a de uma passada em curso, ou a reconferência pedida numa passada terminada. A
 * reconferência CONSOME o pedido ao ser reservada — um registro que mude enquanto ela roda pede outra,
 * em vez de se perder dentro da que já tinha lido o registro antes.
 */
export const claimRecordKeyAdoptionRound = (
  state: RecordKeyAdoptionState,
  now: number,
): RecordKeyAdoptionState | null => {
  if (state.leaseUntil !== null && state.leaseUntil > now) return null;
  const lease = { leaseUntil: now + RECORD_KEY_ADOPTION_LEASE_MS, touchedAt: now };
  if (state.status === 'running') return { ...state, ...lease };
  if (state.status === 'done' && state.recheck) return { ...state, ...lease, recheck: false };
  return null;
};

const isSameRound = (state: RecordKeyAdoptionState, identity: RecordKeyAdoptionRoundIdentity): boolean =>
  state.generation === identity.generation && state.round === identity.round;

export const releaseRecordKeyAdoptionRound = (
  state: RecordKeyAdoptionState,
  identity: RecordKeyAdoptionRoundIdentity,
  now: number,
): RecordKeyAdoptionState | null => {
  if (!isSameRound(state, identity)) return null;
  // A reconferência que falhou devolve o pedido que consumiu.
  return { ...state, leaseUntil: null, recheck: state.recheck || identity.recheck, touchedAt: now };
};

export interface RecordKeyAdoptionRoundResult {
  processed: number;
  reserved: number;
  failed: number;
  failedIds: string[];
  issues: RecordKeyAdoptionIssue[];
  /** Id do último registro da página; `null` = a coleção acabou. Sem sentido na reconferência. */
  nextCursor: string | null;
  blocked: RecordKeyAdoptionBlockage[];
}

const completeRecheck = (
  state: RecordKeyAdoptionState,
  result: RecordKeyAdoptionRoundResult,
  now: number,
): RecordKeyAdoptionState => {
  const issueCount = Math.max(0, state.issueCount - state.issues.length) + result.issues.length;
  const next: RecordKeyAdoptionState = {
    ...state,
    reserved: state.reserved + result.reserved,
    round: state.round + 1,
    leaseUntil: null,
    touchedAt: now,
  };
  if (issueCount === 0) return adoptPending(next, now);
  // Os listados se resolveram, mas havia mais do que a lista mostrava: uma passada nova os encontra.
  if (result.issues.length === 0) return freshPass(state, state.pending, state.adopted, 0, now);
  return { ...next, issues: result.issues, issueCount };
};

/**
 * Fecha a rodada. Uma rodada de geração ou número diferentes do atual pertence a uma passada que foi
 * abandonada (a declaração mudou no meio) e é descartada.
 *
 * Ao fim da passada: com falha, ela recomeça até `RECORD_KEY_ADOPTION_MAX_ATTEMPTS` vezes; sem falha
 * nem conflito, as chaves passam a valer; com conflito, ficam em adoção, com a lista à vista, até que
 * os registros listados mudem.
 */
export const completeRecordKeyAdoptionRound = (
  state: RecordKeyAdoptionState,
  identity: RecordKeyAdoptionRoundIdentity,
  result: RecordKeyAdoptionRoundResult,
  now: number,
): RecordKeyAdoptionState | null => {
  if (!isSameRound(state, identity)) return null;
  if (identity.recheck) return completeRecheck(state, result, now);

  if (result.blocked.length > 0) {
    return { ...state, status: 'blocked', blocked: result.blocked, leaseUntil: null, touchedAt: now };
  }

  const totals: RecordKeyAdoptionState = {
    ...state,
    processed: state.processed + result.processed,
    reserved: state.reserved + result.reserved,
    failed: state.failed + result.failed,
    failedIds: [...state.failedIds, ...result.failedIds].slice(0, MAX_FAILED_IDS),
    issues: [...state.issues, ...result.issues].slice(0, RECORD_KEY_ADOPTION_MAX_LISTED),
    issueCount: state.issueCount + result.issues.length,
    leaseUntil: null,
    touchedAt: now,
  };

  if (result.nextCursor !== null) {
    return { ...totals, cursor: result.nextCursor, round: state.round + 1 };
  }

  if (totals.failed > 0) {
    const attempts = state.attempts + 1;
    if (attempts < RECORD_KEY_ADOPTION_MAX_ATTEMPTS) {
      return freshPass(state, state.pending, state.adopted, attempts, now);
    }
    return { ...totals, status: 'done', cursor: null, attempts };
  }

  if (totals.issueCount === 0) return adoptPending(totals, now);
  return { ...totals, status: 'done', cursor: null, attempts: 0 };
};

// ─── A rodada ────────────────────────────────────────────────────────────────

/** As chaves em adoção, como a coleção as declara agora — as que saíram da declaração ficam de fora. */
const adoptionTargets = (
  ctx: SchemaContext,
  collection: string,
  pending: Record<string, string>,
): ScopedRecordKeySpec[] =>
  resolveRecordKeys(ctx, collection).filter((key) => pending[key.name] !== undefined && key.fields.length > 0);

const isWritableEntity = (ctx: SchemaContext, collection: string): boolean => {
  const outcome = resolveWritableTable(collection, ctx);
  return outcome.ok && outcome.value.kind !== 'lookup';
};

const adoptionRequest = (
  ctx: SchemaContext,
  collection: string,
  targets: readonly ScopedRecordKeySpec[],
  data: Record<string, unknown>,
): RecordKeyAdoptionRequest => ({
  plan: planRecordKeys(targets, data, collection, ctx.fieldRulePresets),
  names: targets.map((key) => key.name),
});

/**
 * O registro já está adotado — cita, para cada chave, exatamente a reserva que o valor dele pede (ou
 * nenhuma, quando não tem valor)? É o caso de quase todos numa coleção cujas chaves só ganharam
 * normalização nova em parte, e no escritório que já tinha chaves antes da adoção existir: a leitura
 * da página basta, e nenhuma transação é aberta.
 */
const isAlreadyAdopted = (request: RecordKeyAdoptionRequest, data: Record<string, unknown>): boolean => {
  if (request.plan.gaps.length > 0) return false;
  const stored = storedRecordKeyRefs(data);
  return request.names.every((name) => {
    const entry = request.plan.entries.find((one) => one.name === name);
    return entry ? stored[name] === entry.keyId : stored[name] === undefined;
  });
};

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

const emptyResult = (): RecordKeyAdoptionRoundResult => ({
  processed: 0,
  reserved: 0,
  failed: 0,
  failedIds: [],
  issues: [],
  nextCursor: null,
  blocked: [],
});

const adoptEach = async (
  ctx: SchemaContext,
  tenantId: string,
  collection: string,
  targets: readonly ScopedRecordKeySpec[],
  recordIds: readonly string[],
  result: RecordKeyAdoptionRoundResult,
  deps: RecordKeyAdoptionDeps,
): Promise<void> => {
  await runPool(recordIds, RECORD_CONCURRENCY, async (recordId) => {
    try {
      const outcome = await deps.adoptionRepository.adoptRecord(
        tenantId,
        collection,
        recordId,
        (data) => adoptionRequest(ctx, collection, targets, data),
      );
      result.reserved += outcome.reserved;
      result.issues.push(...outcome.issues);
    } catch (error) {
      result.failed += 1;
      result.failedIds.push(recordId);
      deps.logger?.warn(`Adoção de chave em ${collection}/${recordId} falhou: ${String(error)}`);
    }
  });
};

const processRound = async (
  ctx: SchemaContext,
  tenantId: string,
  collection: string,
  state: RecordKeyAdoptionState,
  recheck: boolean,
  deps: RecordKeyAdoptionDeps,
): Promise<RecordKeyAdoptionRoundResult> => {
  const result = emptyResult();
  const targets = adoptionTargets(ctx, collection, state.pending);
  if (targets.length === 0 || !isWritableEntity(ctx, collection)) return result;

  // Uma formatação que esta instalação não conhece daria a cada valor um id diferente do que o
  // formulário dará quando ela chegar. A passada espera; a instalação da extensão que a traz grava a
  // tela, e a porta automática a retoma.
  result.blocked = targets.flatMap((key) => {
    const preset = key.normalize?.formatPreset;
    return preset && !ctx.fieldRulePresets.get(preset) ? [{ key: key.name, preset }] : [];
  });
  if (result.blocked.length > 0) return result;

  if (recheck) {
    const recordIds = [...new Set(state.issues.map((issue) => issue.recordId))];
    await adoptEach(ctx, tenantId, collection, targets, recordIds, result, deps);
    // A reconferência que falhou num registro mantém o conflito dele como estava.
    const failed = new Set(result.failedIds);
    result.issues.push(...state.issues.filter((issue) => failed.has(issue.recordId)));
    return result;
  }

  const records = await deps.adoptionRepository.listRecords(
    tenantId,
    collection,
    state.cursor,
    RECORD_KEY_ADOPTION_PAGE_SIZE,
  );
  const unadopted = records
    .filter((record) => !isAlreadyAdopted(adoptionRequest(ctx, collection, targets, record.data), record.data))
    .map((record) => record.id);
  await adoptEach(ctx, tenantId, collection, targets, unadopted, result, deps);

  result.processed = records.length;
  result.nextCursor = records.length < RECORD_KEY_ADOPTION_PAGE_SIZE ? null : records[records.length - 1].id;
  return result;
};

/**
 * Uma rodada da adoção de uma coleção: reserva, processa uma página (ou os conflitos listados) e fecha
 * — e é o fechamento, uma gravação no job, que dispara a rodada seguinte. Sem agendador.
 */
export const runRecordKeyAdoptionRound = async (
  tenantId: string,
  collection: string,
  deps: RecordKeyAdoptionDeps,
): Promise<void> => {
  const repository = deps.adoptionRepository;
  let recheck = false;
  const claimed = await repository.update(tenantId, collection, (current) => {
    const next = current ? claimRecordKeyAdoptionRound(current, deps.now()) : null;
    recheck = current?.status === 'done';
    return next;
  });
  if (!claimed) return;

  const identity: RecordKeyAdoptionRoundIdentity = { generation: claimed.generation, round: claimed.round, recheck };
  try {
    const ctx = await deps.freshSchemaContext(tenantId);
    const result = await processRound(ctx, tenantId, collection, claimed, recheck, deps);
    const completed = await repository.update(tenantId, collection, (current) =>
      current ? completeRecordKeyAdoptionRound(current, identity, result, deps.now()) : null,
    );
    // Uma linha por passada, e outra quando uma reconferência põe a chave para valer — não uma por
    // reconferência, que acontece a cada registro listado que muda.
    const passEnded = !recheck || Object.keys(completed?.pending ?? {}).length === 0;
    if (completed?.status === 'done' && passEnded) {
      await deps.recordPassFinished?.(tenantId, collection, completed);
    }
  } catch (error) {
    await repository
      .update(tenantId, collection, (current) =>
        current ? releaseRecordKeyAdoptionRound(current, identity, deps.now()) : null,
      )
      .catch(() => undefined);
    throw error;
  }
};

/** Toda coleção que declara chave: as telas e as entidades do registro do kernel. */
const declaredCollections = (ctx: SchemaContext): Map<string, Record<string, string>> => {
  const declared = new Map<string, Record<string, string>>();
  for (const collection of new Set([...ctx.screens.keys(), ...Object.keys(ctx.registry)])) {
    const signatures = declaredRecordKeySignatures(resolveRecordKeys(ctx, collection), ctx.fieldRulePresets);
    if (Object.keys(signatures).length > 0) declared.set(collection, signatures);
  }
  return declared;
};

/**
 * Confere o que cada coleção declara contra o que já foi adotado e põe em marcha o que falta. Só
 * abre transação para a coleção cujo plano muda alguma coisa — chamada repetida custa duas leituras
 * de coleção e nenhuma gravação.
 */
export const reconcileRecordKeyAdoptions = async (
  tenantId: string,
  deps: RecordKeyAdoptionDeps,
  onlyKinds?: ReadonlySet<RecordKeyAdoptionPlan['kind']>,
): Promise<number> => {
  const ctx = await deps.freshSchemaContext(tenantId);
  const states = await deps.adoptionRepository.listStates(tenantId);
  const declared = declaredCollections(ctx);

  const allows = (plan: RecordKeyAdoptionPlan): boolean =>
    plan.kind !== 'none' && (!onlyKinds || onlyKinds.has(plan.kind));

  let changed = 0;
  for (const collection of new Set([...declared.keys(), ...states.keys()])) {
    const signatures = declared.get(collection) ?? {};
    if (!allows(planRecordKeyAdoption(signatures, states.get(collection) ?? null, deps.now()))) continue;

    const written = await deps.adoptionRepository.update(tenantId, collection, (current) => {
      const plan = planRecordKeyAdoption(signatures, current, deps.now());
      return allows(plan) ? applyRecordKeyAdoptionPlan(current, plan, deps.now()) : null;
    });
    if (written) changed += 1;
  }
  return changed;
};

// ─── As gravações de registro ────────────────────────────────────────────────

const sameJson = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left ?? null) === JSON.stringify(right ?? null);

const isUnadopted = (
  ctx: SchemaContext,
  collection: string,
  keys: readonly ScopedRecordKeySpec[],
  data: Record<string, unknown> | null,
): boolean => {
  if (!data) return false;
  return !isAlreadyAdopted(
    { plan: planRecordKeys(keys, data, collection, ctx.fieldRulePresets), names: keys.map((key) => key.name) },
    data,
  );
};

/**
 * A gravação PODE ter resolvido um conflito de adoção? Responde sem ler nada além do que o evento
 * traz: o registro sem a reserva que o valor dele pede (o duplicado — inclusive o que foi apagado),
 * ou uma reserva que mudou de mãos (o dono que trocou de valor ou saiu). Numa coleção com todas as
 * chaves adotadas, só a troca de valor de chave responde sim.
 */
export const recordWriteMayResolveKeyIssue = (
  ctx: SchemaContext,
  collection: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): boolean => {
  const keys = resolveRecordKeys(ctx, collection).filter((key) => key.fields.length > 0);
  if (keys.length === 0 || isBookkeepingWrite(before, after)) return false;
  if (!sameJson(storedRecordKeyRefs(before), storedRecordKeyRefs(after))) return true;
  return isUnadopted(ctx, collection, keys, before) || isUnadopted(ctx, collection, keys, after);
};

/** O gatilho de registro: se a gravação pode ter resolvido um conflito listado, pede a reconferência. */
export const recheckRecordKeyIssues = async (
  tenantId: string,
  collection: string,
  recordId: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
  cachedSchemaContext: (tenantId: string) => Promise<SchemaContext>,
  deps: Pick<RecordKeyAdoptionDeps, 'adoptionRepository' | 'now'>,
): Promise<boolean> => {
  const ctx = await cachedSchemaContext(tenantId);
  if (!recordWriteMayResolveKeyIssue(ctx, collection, before, after)) return false;
  const written = await deps.adoptionRepository.update(tenantId, collection, (current) =>
    current ? requestRecordKeyRecheck(current, recordId, deps.now()) : null,
  );
  return written !== null;
};
