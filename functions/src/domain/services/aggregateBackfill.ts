import type { IAggregateBackfillRepository } from '../repositories/IAggregateBackfillRepository';
import type { AggregationTarget } from '../schema/aggregationSpec';
import {
  AGGREGATE_BACKFILL_MAX_ATTEMPTS,
  AGGREGATE_BACKFILL_VIA,
  declaredAggregationSignatures,
  planAggregateBackfill,
  readAggregateBackfillState,
} from '../schema/aggregateBackfill';
import type {
  AggregateBackfillBlockage,
  AggregateBackfillPlan,
  AggregateBackfillState,
} from '../schema/aggregateBackfill';
import { resolveWritableTable } from '../schema/mutationSpec';
import type { SchemaContext } from '../schema/pathResolver';
import { collectFieldLogicTargets } from '../schema/recordRules';
import { computeAggregatePatch } from './recomputeAggregates';
import type { AggregateRecomputeDeps } from './recomputeAggregates';

/** Pais por rodada. Uma rodada é uma invocação: pequena o bastante para caber com folga no timeout. */
export const AGGREGATE_BACKFILL_PAGE_SIZE = 100;

/** Pais recalculados ao mesmo tempo dentro de uma rodada. */
const PARENT_CONCURRENCY = 8;

/** Reserva de uma rodada. Maior que o timeout da function que a executa. */
export const AGGREGATE_BACKFILL_LEASE_MS = 6 * 60_000;

/** Quantos ids de pai com falha o job guarda — o bastante para investigar, sem crescer sem teto. */
const MAX_FAILED_IDS = 50;

export interface AggregateBackfillDeps extends AggregateRecomputeDeps {
  backfillRepository: IAggregateBackfillRepository;
  /** O contexto relido do banco, sem cache: a rodada não pode agir sobre a declaração de antes. */
  freshSchemaContext: (tenantId: string) => Promise<SchemaContext>;
  now: () => number;
  /** O registro único de uma passada que terminou — no lugar de uma linha de auditoria por pai. */
  recordPassFinished?: (tenantId: string, table: string, state: AggregateBackfillState) => Promise<void>;
}

const EMPTY_STATE: AggregateBackfillState = readAggregateBackfillState({});

const freshPass = (
  base: AggregateBackfillState,
  pending: Record<string, string>,
  reconciled: Record<string, string>,
  attempts: number,
  now: number,
): AggregateBackfillState => ({
  ...EMPTY_STATE,
  status: 'running',
  pending,
  reconciled,
  generation: base.generation + 1,
  attempts,
  touchedAt: now,
});

/** O estado que um plano produz — ou `null` quando ele não muda nada. */
export const applyAggregateBackfillPlan = (
  state: AggregateBackfillState | null,
  plan: AggregateBackfillPlan,
  now: number,
): AggregateBackfillState | null => {
  switch (plan.kind) {
    case 'none':
      return null;
    case 'start':
      return freshPass(state ?? EMPTY_STATE, plan.pending, plan.reconciled, 0, now);
    case 'resume':
      if (!state) return null;
      // Geração nova: uma rodada que ainda estivesse em voo descarta o que fez.
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
          reconciled: plan.reconciled,
          leaseUntil: null,
          cursor: null,
          attempts: 0,
          failed: 0,
          failedIds: [],
          blocked: [],
          generation: state.generation + 1,
          touchedAt: now,
        }
        : { ...state, reconciled: plan.reconciled, touchedAt: now };
    default:
      return null;
  }
};

export interface AggregateBackfillRoundIdentity {
  generation: number;
  round: number;
}

/** Reserva a rodada — só numa passada em curso e sem outra reserva válida. */
export const claimAggregateBackfillRound = (
  state: AggregateBackfillState,
  now: number,
): AggregateBackfillState | null => {
  if (state.status !== 'running') return null;
  if (state.leaseUntil !== null && state.leaseUntil > now) return null;
  return { ...state, leaseUntil: now + AGGREGATE_BACKFILL_LEASE_MS, touchedAt: now };
};

const isSameRound = (state: AggregateBackfillState, identity: AggregateBackfillRoundIdentity): boolean =>
  state.generation === identity.generation && state.round === identity.round;

/** Solta a reserva de uma rodada que falhou, para que a nova entrega do gatilho a refaça. */
export const releaseAggregateBackfillRound = (
  state: AggregateBackfillState,
  identity: AggregateBackfillRoundIdentity,
  now: number,
): AggregateBackfillState | null =>
  isSameRound(state, identity) ? { ...state, leaseUntil: null, touchedAt: now } : null;

export interface AggregateBackfillRoundResult {
  processed: number;
  written: number;
  truncated: number;
  failed: number;
  failedIds: string[];
  /** Id do último pai da página; `null` = a coleção acabou. */
  nextCursor: string | null;
  blocked: AggregateBackfillBlockage[];
}

/**
 * Fecha a rodada. Uma rodada de geração ou número diferentes do atual pertence a uma passada que foi
 * abandonada (a declaração mudou no meio) e é descartada.
 *
 * Ao fim da passada: sem falha, os campos pendentes passam a recalculados. Com falha, a passada
 * recomeça até `AGGREGATE_BACKFILL_MAX_ATTEMPTS` vezes — falha passageira não pede ninguém — e
 * depois para, com a contagem à vista.
 */
export const completeAggregateBackfillRound = (
  state: AggregateBackfillState,
  identity: AggregateBackfillRoundIdentity,
  result: AggregateBackfillRoundResult,
  now: number,
): AggregateBackfillState | null => {
  if (!isSameRound(state, identity)) return null;

  if (result.blocked.length > 0) {
    return { ...state, status: 'blocked', blocked: result.blocked, leaseUntil: null, touchedAt: now };
  }

  const totals: AggregateBackfillState = {
    ...state,
    processed: state.processed + result.processed,
    written: state.written + result.written,
    truncated: state.truncated + result.truncated,
    failed: state.failed + result.failed,
    failedIds: [...state.failedIds, ...result.failedIds].slice(0, MAX_FAILED_IDS),
    leaseUntil: null,
    touchedAt: now,
  };

  if (result.nextCursor !== null) {
    return { ...totals, cursor: result.nextCursor, round: state.round + 1 };
  }

  if (totals.failed === 0) {
    return {
      ...totals,
      status: 'done',
      reconciled: { ...state.reconciled, ...state.pending },
      pending: {},
      cursor: null,
      attempts: 0,
    };
  }

  const attempts = state.attempts + 1;
  if (attempts < AGGREGATE_BACKFILL_MAX_ATTEMPTS) {
    return freshPass(state, state.pending, state.reconciled, attempts, now);
  }
  return { ...totals, status: 'done', cursor: null, attempts };
};

/** Os campos pendentes da tela, como o motor os entende — os que saíram da declaração ficam de fora. */
const pendingTargets = (
  ctx: SchemaContext,
  table: string,
  pending: Record<string, string>,
): AggregationTarget[] => {
  const screen = ctx.screens.get(table);
  const targets: AggregationTarget[] = [];
  for (const field of screen?.fields ?? []) {
    if (!field.aggregation || pending[field.key] === undefined) continue;
    targets.push({
      parentTable: table,
      parentPath: field.key,
      fieldKey: field.key,
      label: field.label,
      aggregation: field.aggregation,
    });
  }
  return targets;
};

const isWritableEntity = (ctx: SchemaContext, table: string): boolean => {
  const outcome = resolveWritableTable(table, ctx);
  return outcome.ok && outcome.value.kind !== 'lookup';
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

const processRound = async (
  ctx: SchemaContext,
  tenantId: string,
  table: string,
  state: AggregateBackfillState,
  deps: AggregateBackfillDeps,
): Promise<AggregateBackfillRoundResult> => {
  const result: AggregateBackfillRoundResult = {
    processed: 0,
    written: 0,
    truncated: 0,
    failed: 0,
    failedIds: [],
    nextCursor: null,
    blocked: [],
  };

  const targets = pendingTargets(ctx, table, state.pending);
  if (targets.length === 0 || !isWritableEntity(ctx, table)) return result;

  // A tela dos filhos pode ainda não existir: a instalação grava as telas uma a uma, e a do pai
  // pode chegar antes. A passada espera; a gravação da tela que falta a acorda.
  result.blocked = targets
    .filter((target) => !isWritableEntity(ctx, target.aggregation.from))
    .map((target) => ({ field: target.fieldKey, from: target.aggregation.from }));
  if (result.blocked.length > 0) return result;

  const parents = await deps.backfillRepository.listParents(
    tenantId,
    table,
    state.cursor,
    AGGREGATE_BACKFILL_PAGE_SIZE,
  );

  await runPool(parents, PARENT_CONCURRENCY, async (parent) => {
    try {
      const patch = await computeAggregatePatch(ctx, targets, tenantId, parent.id, parent.data, deps);
      if (patch.truncated) result.truncated += 1;
      if (!patch.payload) return;
      await deps.backfillRepository.writeParent(tenantId, table, parent.id, patch.payload);
      result.written += 1;
    } catch (error) {
      result.failed += 1;
      result.failedIds.push(parent.id);
      deps.logger?.warn(`Recálculo de ${table}/${parent.id} falhou: ${String(error)}`);
    }
  });

  result.processed = parents.length;
  result.nextCursor = parents.length < AGGREGATE_BACKFILL_PAGE_SIZE
    ? null
    : parents[parents.length - 1].id;
  return result;
};

/**
 * Uma rodada do recálculo de uma tela: reserva, processa uma página de pais e fecha — e é o fechamento
 * (uma gravação no job) que dispara a rodada seguinte. Sem agendador: a passada anda sozinha, sem
 * depender de ninguém com o app aberto, e retoma do cursor depois de qualquer falha.
 */
export const runAggregateBackfillRound = async (
  tenantId: string,
  table: string,
  deps: AggregateBackfillDeps,
): Promise<void> => {
  const repository = deps.backfillRepository;
  const claimed = await repository.update(tenantId, table, (current) =>
    current ? claimAggregateBackfillRound(current, deps.now()) : null,
  );
  if (!claimed) return;

  const identity: AggregateBackfillRoundIdentity = { generation: claimed.generation, round: claimed.round };
  try {
    const ctx = await deps.freshSchemaContext(tenantId);
    const result = await processRound(ctx, tenantId, table, claimed, deps);
    const completed = await repository.update(tenantId, table, (current) =>
      current ? completeAggregateBackfillRound(current, identity, result, deps.now()) : null,
    );
    if (completed?.status === 'done') await deps.recordPassFinished?.(tenantId, table, completed);
  } catch (error) {
    await repository
      .update(tenantId, table, (current) =>
        current ? releaseAggregateBackfillRound(current, identity, deps.now()) : null,
      )
      .catch(() => undefined);
    throw error;
  }
};

/**
 * Confere o que cada tela declara contra o que já foi recalculado e põe em marcha o que falta. Lê as
 * telas e os jobs; só abre transação para a tela cujo plano muda alguma coisa — chamada repetida custa
 * duas leituras de coleção e nenhuma gravação.
 *
 * `onlyKinds` restringe o que esta chamada pode fazer: a callable que o front chama não precisa
 * conferir de novo uma passada bloqueada, que só a gravação de uma tela desbloqueia.
 */
export const reconcileAggregateBackfills = async (
  tenantId: string,
  deps: AggregateBackfillDeps,
  onlyKinds?: ReadonlySet<AggregateBackfillPlan['kind']>,
): Promise<number> => {
  const ctx = await deps.freshSchemaContext(tenantId);
  const states = await deps.backfillRepository.listStates(tenantId);

  const declared = new Map<string, Record<string, string>>();
  // A chave do job é a COLEÇÃO (a chave do mapa), a mesma que `pendingTargets` e o gatilho leem —
  // nunca o `id` da tela, que numa coleção descrita por outra tela não é o nome dela.
  for (const [table, screen] of ctx.screens) {
    const signatures = declaredAggregationSignatures(screen.fields);
    if (Object.keys(signatures).length > 0) declared.set(table, signatures);
  }

  const allows = (plan: AggregateBackfillPlan): boolean =>
    plan.kind !== 'none' && (!onlyKinds || onlyKinds.has(plan.kind));

  let changed = 0;
  for (const table of new Set([...declared.keys(), ...states.keys()])) {
    const signatures = declared.get(table) ?? {};
    if (!allows(planAggregateBackfill(signatures, states.get(table) ?? null, deps.now()))) continue;

    const written = await deps.backfillRepository.update(tenantId, table, (current) => {
      const plan = planAggregateBackfill(signatures, current, deps.now());
      return allows(plan) ? applyAggregateBackfillPlan(current, plan, deps.now()) : null;
    });
    if (written) changed += 1;
  }
  return changed;
};

const sameJson = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left ?? null) === JSON.stringify(right ?? null);

/**
 * A gravação é do recálculo — e não um fato de negócio — quando traz a marca dele E só mexe nos campos
 * derivados (agregados e os `compute`, que dependem deles) e nos carimbos de autoria. `updatedAt`
 * fica fora de propósito: o recálculo não o toca, e uma gravação que o mexe é outra coisa.
 *
 * A marca sozinha não basta: ela PERMANECE no documento depois do recálculo, e a próxima gravação do
 * motor vivo — que muda `updatedAt` — tem de seguir publicando como sempre.
 */
export const isAggregateBackfillWrite = (
  ctx: SchemaContext,
  collection: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): boolean => {
  if (!before || !after || after.updatedVia !== AGGREGATE_BACKFILL_VIA) return false;

  const allowed = new Set<string>(['updatedBy', 'updatedVia']);
  for (const field of ctx.screens.get(collection)?.fields ?? []) {
    if (field.aggregation) allowed.add(field.key);
  }
  for (const target of collectFieldLogicTargets(ctx, collection, 'compute')) allowed.add(target.key);

  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (!allowed.has(key) && !sameJson(before[key], after[key])) return false;
  }
  return true;
};

/**
 * `isAggregateBackfillWrite` com uma segunda chance contra o cache de telas: o recálculo começa
 * segundos depois de a tela ganhar o agregado, e a instância que publica eventos pode ainda ter a
 * declaração de antes — sem o campo novo, a gravação pareceria de negócio. Só a gravação MARCADA paga
 * a releitura, e só quando a primeira resposta é não.
 */
export const isAggregateBackfillWriteFresh = async (
  tenantId: string,
  collection: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
  cached: (tenantId: string) => Promise<SchemaContext>,
  fresh: (tenantId: string) => Promise<SchemaContext>,
): Promise<boolean> => {
  if (!before || !after || after.updatedVia !== AGGREGATE_BACKFILL_VIA) return false;
  if (isAggregateBackfillWrite(await cached(tenantId), collection, before, after)) return true;
  return isAggregateBackfillWrite(await fresh(tenantId), collection, before, after);
};
