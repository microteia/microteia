// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/aggregateBackfill.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/aggregateBackfill.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import type { FieldDefinition } from '../entities/entitySchemas';
import type { FieldAggregation } from './fieldRules';

/**
 * O recálculo dos agregados sobre os registros que JÁ existiam quando a declaração mudou. O motor
 * vivo só recalcula o pai cujo filho mudou; um campo agregado declarado numa tela povoada nasceria
 * vazio em todos os pais antigos, e nada o preencheria.
 *
 * Um documento por TELA PAI em `tenants/{tenantId}/aggregate_backfills/{tela}`: a assinatura é por
 * campo, mas a passada é por tela — três agregados novos numa instalação percorrem os pais uma vez
 * e gravam cada pai uma vez.
 */
export const AGGREGATE_BACKFILL_COLLECTION = 'aggregate_backfills';

/**
 * A partir de qual `KERNEL_VERSION` um agregado novo ou alterado alcança os registros que já existiam.
 * É o que o guia de autoria cita: num kernel anterior o agregado funciona, mas só nos pais cujos
 * filhos mudarem depois.
 */
export const AGGREGATE_BACKFILL_SINCE_KERNEL = '2.28.0';

/** Quem o motor de agregados carimba em `updatedBy` — o vivo e o recálculo. */
export const AGGREGATE_ENGINE_ACTOR = 'aggregate-engine';

/**
 * O `updatedVia` da gravação do recálculo. É ele, e não o `updatedBy`, que separa o recálculo de uma
 * gravação de negócio: o cliente pode escrever `updatedBy`, mas a regra do Firestore o proíbe de
 * deixar um registro marcado com este valor.
 */
export const AGGREGATE_BACKFILL_VIA = 'aggregate-backfill';

/**
 * Teto de filhos lidos por pai, no motor vivo e no recálculo. Acima dele o agregado sairia incorreto
 * por truncamento: melhor gravar o que dá e contar o caso do que silenciar a divergência. Vale igual
 * para o `latest` — a consulta é só por igualdade no vínculo (servida pelos índices de campo único,
 * sem índice composto por agregação) e a ordenação é em memória, então acima do teto o mais recente
 * pode ter ficado fora da leitura.
 */
export const AGGREGATION_MAX_CHILDREN = 500;

/** Quantas passadas completas o recálculo tenta quando algum pai falhou. */
export const AGGREGATE_BACKFILL_MAX_ATTEMPTS = 3;

/**
 * Sem gravação no documento do job por mais que isto, uma passada `running` está parada: a rodada
 * morreu sem soltar a reserva e sem nova entrega do gatilho. Maior que a reserva de uma rodada.
 */
export const AGGREGATE_BACKFILL_STALL_MS = 10 * 60_000;

export type AggregateBackfillStatus = 'running' | 'blocked' | 'done';

/** Campo cujo `from` não resolve para uma tela gravável — a passada espera por ele. */
export interface AggregateBackfillBlockage {
  field: string;
  from: string;
}

/** O documento do job, só com o que é dado plano — os carimbos de data ficam fora do contrato. */
export interface AggregateBackfillState {
  status: AggregateBackfillStatus;
  /** Campo → assinatura, da passada em curso (ou da última, se ela terminou com falhas). */
  pending: Record<string, string>;
  /** Campo → assinatura já recalculada em todos os pais. */
  reconciled: Record<string, string>;
  /** Sobe a cada passada nova: a rodada de uma passada abandonada não grava sobre a seguinte. */
  generation: number;
  round: number;
  /** Id do último pai processado; `null` = começo da coleção. */
  cursor: string | null;
  /** Até quando (ms) a rodada em curso está reservada; `null` = livre. */
  leaseUntil: number | null;
  /** Última gravação no job (ms) — é o que denuncia uma passada parada. */
  touchedAt: number;
  attempts: number;
  processed: number;
  written: number;
  truncated: number;
  failed: number;
  failedIds: string[];
  blocked: AggregateBackfillBlockage[];
}

const text = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

/**
 * A identidade de um agregado: só o que muda o VALOR. Rótulo, ordem do campo e qualquer outra
 * propriedade ficam fora — mudar o rótulo não pode recalcular uma coleção inteira.
 */
export const aggregationSignature = (aggregation: FieldAggregation): string =>
  JSON.stringify([
    text(aggregation.from),
    text(aggregation.via),
    aggregation.op,
    text(aggregation.field),
    text(aggregation.filter),
    (aggregation.orderBy ?? []).map((order) => [text(order.path), order.dir]),
  ]);

/** Campo → assinatura de todo agregado completo (com `from` e `via`) declarado nos campos da tela. */
export const declaredAggregationSignatures = (
  fields: readonly Pick<FieldDefinition, 'key' | 'aggregation'>[],
): Record<string, string> => {
  const declared: Record<string, string> = {};
  for (const field of fields) {
    const aggregation = field.aggregation;
    if (!aggregation || !text(aggregation.from) || !text(aggregation.via)) continue;
    declared[field.key] = aggregationSignature(aggregation);
  }
  return declared;
};

const sameMap = (left: Record<string, string>, right: Record<string, string>): boolean => {
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every((key) => right[key] === left[key]);
};

const isEmpty = (map: Record<string, string>): boolean => Object.keys(map).length === 0;

/** A passada `running` sem sinal de vida há mais que o tolerável. */
export const isAggregateBackfillStalled = (state: AggregateBackfillState, now: number): boolean =>
  state.status === 'running' && now - state.touchedAt > AGGREGATE_BACKFILL_STALL_MS;

/**
 * O que fazer com o job de uma tela, dado o que ela declara agora:
 *
 * - `start` — há agregado declarado ainda não recalculado (novo, alterado, ou o job nunca existiu,
 *   que é o caso do escritório que já tinha agregados antes do recálculo existir);
 * - `resume` — a passada esperava uma tela de filhos; vale conferir de novo;
 * - `nudge` — a passada está parada; acordar a rodada;
 * - `settle` — o registro do que já foi recalculado precisa esquecer um agregado que saiu da
 *   declaração; com `finish`, não resta nada pendente e a passada (se havia) termina;
 * - `none` — nada.
 *
 * Uma passada que terminou com falhas e esgotou as tentativas NÃO recomeça sozinha: repetiria a
 * mesma falha. Recomeça quando a declaração mudar.
 */
export type AggregateBackfillPlan =
  | { kind: 'none' }
  | { kind: 'start'; pending: Record<string, string>; reconciled: Record<string, string> }
  | { kind: 'resume' }
  | { kind: 'nudge' }
  | { kind: 'settle'; reconciled: Record<string, string>; finish: boolean };

export const planAggregateBackfill = (
  declared: Record<string, string>,
  state: AggregateBackfillState | null,
  now: number,
): AggregateBackfillPlan => {
  const kept: Record<string, string> = {};
  for (const [key, signature] of Object.entries(state?.reconciled ?? {})) {
    if (declared[key] === signature) kept[key] = signature;
  }

  const pending: Record<string, string> = {};
  for (const [key, signature] of Object.entries(declared)) {
    if (kept[key] !== signature) pending[key] = signature;
  }

  if (!state) return isEmpty(pending) ? { kind: 'none' } : { kind: 'start', pending, reconciled: kept };

  const keptChanged = !sameMap(kept, state.reconciled);

  if (isEmpty(pending)) {
    return state.status !== 'done' || keptChanged || !isEmpty(state.pending)
      ? { kind: 'settle', reconciled: kept, finish: true }
      : { kind: 'none' };
  }

  if (state.status === 'done') {
    const exhausted = state.failed > 0
      && state.attempts >= AGGREGATE_BACKFILL_MAX_ATTEMPTS
      && sameMap(pending, state.pending);
    if (!exhausted) return { kind: 'start', pending, reconciled: kept };
    return keptChanged ? { kind: 'settle', reconciled: kept, finish: false } : { kind: 'none' };
  }

  if (!sameMap(pending, state.pending)) return { kind: 'start', pending, reconciled: kept };
  if (state.status === 'blocked') return { kind: 'resume' };
  if (isAggregateBackfillStalled(state, now)) return { kind: 'nudge' };
  return { kind: 'none' };
};

const asStringMap = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const map: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === 'string') map[key] = entry;
  }
  return map;
};

const asCount = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;

const STATUSES: readonly AggregateBackfillStatus[] = ['running', 'blocked', 'done'];

/** Lê o documento do job sem confiar na forma — um campo ausente vale o neutro dele. */
export const readAggregateBackfillState = (data: Record<string, unknown>): AggregateBackfillState => ({
  status: STATUSES.includes(data.status as AggregateBackfillStatus)
    ? (data.status as AggregateBackfillStatus)
    : 'done',
  pending: asStringMap(data.pending),
  reconciled: asStringMap(data.reconciled),
  generation: asCount(data.generation),
  round: asCount(data.round),
  cursor: typeof data.cursor === 'string' && data.cursor !== '' ? data.cursor : null,
  leaseUntil: typeof data.leaseUntil === 'number' ? data.leaseUntil : null,
  touchedAt: asCount(data.touchedAt),
  attempts: asCount(data.attempts),
  processed: asCount(data.processed),
  written: asCount(data.written),
  truncated: asCount(data.truncated),
  failed: asCount(data.failed),
  failedIds: Array.isArray(data.failedIds)
    ? data.failedIds.filter((id): id is string => typeof id === 'string')
    : [],
  blocked: Array.isArray(data.blocked)
    ? data.blocked.flatMap((entry) => {
      const raw = entry as Record<string, unknown> | null;
      const field = text(raw?.field);
      const from = text(raw?.from);
      return field && from ? [{ field, from }] : [];
    })
    : [],
});
