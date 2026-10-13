import type { IScreenDefinitionProvider } from '../repositories/IScreenDefinitionProvider';
import type { IWorkflowMutationRepository } from '../repositories/IWorkflowMutationRepository';
import type { IWorkflowQueryRepository, WorkflowEqualityFilter } from '../repositories/IWorkflowQueryRepository';
import { aggregateChildren, collectAggregationsFor, readChildField } from '../schema/aggregationSpec';
import type { AggregationTarget } from '../schema/aggregationSpec';
import { AGGREGATE_ENGINE_ACTOR, AGGREGATION_MAX_CHILDREN } from '../schema/aggregateBackfill';
import { flattenDataLeaves, resolveWritableTable, setValueAtPath } from '../schema/mutationSpec';
import { getValueAtPath, parsePath } from '../schema/pathResolver';
import type { SchemaContext } from '../schema/pathResolver';
import { formatAndValidateRecord } from '../schema/recordRules';
import { withAmbientTimeZone } from '../schema/clockGate';
import { tableMentionsBusinessDays } from '../schema/recordRules';
import { mentionsBusinessDays, type BusinessCalendarSet } from '../schema/time/businessDays';
import { withAmbientBusinessCalendars } from '../schema/time/businessDaysGate';
import { businessCalendarsFor } from './businessCalendarScope';

export interface AggregateRecomputeDeps {
  screenProvider: IScreenDefinitionProvider;
  queryRepository: IWorkflowQueryRepository;
  mutationRepository: IWorkflowMutationRepository;
  logger?: { warn: (message: string) => void };
  /** O fuso do escritório, para o `today()` de um filtro ou de um `compute` recalculado aqui. */
  timeZoneOf?: (tenantId: string) => Promise<string>;
  /** Os calendários de dias úteis, lidos só quando um filtro ou uma regra do pai conta dias úteis. */
  businessCalendarsOf?: (tenantId: string) => Promise<BusinessCalendarSet | null>;
}

const asRecordId = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

/**
 * Igualdade ESTRUTURAL: `latest` copia o valor do filho como está, e ele pode ser uma lista (uma
 * referência de vários, uma seleção múltipla) — que chega como array NOVO a cada leitura. Com `===`,
 * o mesmo valor pareceria diferente, o pai seria regravado a cada mudança de filho e o `.saved` dele
 * seria republicado sem nada ter mudado.
 */
const sameValue = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if ((a === null || a === undefined) && (b === null || b === undefined)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  return JSON.stringify(a) === JSON.stringify(b);
};

/** A coleção É a entidade: não há mais coleção física compartilhada por várias telas. */
export const resolveChildTable = (collection: string): string => collection;

/**
 * Só recalcula quando a mudança no filho pode ter mexido no agregado: o pai vinculado mudou, o campo
 * medido mudou, uma chave do `orderBy` mudou (é ela que decide QUAL filho o `latest` copia), ou existe
 * filtro (que pode depender de qualquer campo). Sem isso, toda edição de um filho custaria uma query
 * por agregado.
 */
const changeAffectsAggregate = (
  ctx: SchemaContext,
  childTable: string,
  target: AggregationTarget,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): boolean => {
  if (!before || !after) return true;
  if (target.aggregation.filter?.trim()) return true;

  const { via, field, op, orderBy } = target.aggregation;
  const changed = (key: string): boolean =>
    !sameValue(readChildField(ctx, childTable, before, key), readChildField(ctx, childTable, after, key));

  if (changed(via)) return true;
  if (op === 'count') return false;
  if (op === 'latest' && (orderBy ?? []).some((order) => changed(order.path))) return true;
  if (!field) return false;

  return changed(field);
};

const buildChildFilters = (
  ctx: SchemaContext,
  childTable: string,
  via: string,
  parentId: string,
): WorkflowEqualityFilter[] | null => {
  const outcome = resolveWritableTable(childTable, ctx);
  if (!outcome.ok || outcome.value.kind === 'lookup') return null;
  return [{ path: via, value: parentId }];
};

/** O que muda no pai: as folhas que diferem do que está gravado, ou `null` se nada muda. */
export interface AggregatePatch {
  payload: Record<string, unknown> | null;
  /** Algum dos agregados bateu no teto de filhos lidos — o valor pode estar incompleto. */
  truncated: boolean;
}

/**
 * Calcula os agregados de UM pai — um ou vários campos da mesma tela — e devolve só o que mudou.
 * É a mesma conta para o motor vivo e para o recálculo: o que os separa é como gravam.
 *
 * Os campos entram num patch só, que passa pelo gate com `baseline`: um campo `compute` que dependa
 * de um agregado é recalculado no mesmo write — é o que faz agregação e valor calculado se comporem.
 */
export const computeAggregatePatch = async (
  ctx: SchemaContext,
  targets: readonly AggregationTarget[],
  tenantId: string,
  parentId: string,
  baseline: Record<string, unknown>,
  deps: AggregateRecomputeDeps,
): Promise<AggregatePatch> => {
  const patch: Record<string, unknown> = {};
  const timeZone = await deps.timeZoneOf?.(tenantId);
  const calendars = await businessCalendarsFor(
    deps,
    tenantId,
    targets.some(
      (target) =>
        mentionsBusinessDays(JSON.stringify(target.aggregation)) || tableMentionsBusinessDays(ctx, target.parentTable),
    ),
  );
  let truncated = false;
  let parentTable: string | null = null;

  for (const target of targets) {
    const childTable = target.aggregation.from;
    const child = resolveWritableTable(childTable, ctx);
    if (!child.ok || child.value.kind === 'lookup') continue;

    const filters = buildChildFilters(ctx, childTable, target.aggregation.via, parentId);
    if (!filters) continue;

    const rows = await deps.queryRepository.queryByEquality(
      tenantId,
      child.value.physicalCollection,
      filters,
      AGGREGATION_MAX_CHILDREN,
    );
    if (rows.length === AGGREGATION_MAX_CHILDREN) {
      truncated = true;
      deps.logger?.warn(
        `Agregado "${target.label}" em ${target.parentTable}/${parentId}: limite de ${AGGREGATION_MAX_CHILDREN} filhos atingido, o valor pode estar incompleto`,
      );
    }

    const value = withAmbientBusinessCalendars(calendars, () =>
      withAmbientTimeZone(timeZone, () => aggregateChildren(ctx, target.aggregation, childTable, rows)),
    );
    setValueAtPath(patch, target.parentPath, value);
    parentTable = target.parentTable;
  }

  if (!parentTable) return { payload: null, truncated };
  const table = parentTable;

  // O agregado é FATO sobre os filhos: uma regra do campo, ou a validação de um `compute` que
  // depende dele, não pode impedir que ele seja gravado — recusar deixaria o pai com o valor de
  // antes, que é falso. A recusa vai para o log, e o valor vai para o registro.
  const ruled = withAmbientBusinessCalendars(calendars, () =>
    withAmbientTimeZone(timeZone, () => formatAndValidateRecord(ctx, table, patch, { baseline })),
  );
  if (ruled.issues.length > 0) {
    deps.logger?.warn(
      `Agregado em ${table}/${parentId} gravado apesar de ${ruled.issues.length} recusa(s) de regra: ${ruled.issues.map((issue) => issue.path).join(', ')}`,
    );
  }

  // Guarda de recursão: sem diferença real, não grava — e sem write o `.saved` do pai não dispara,
  // encerrando a cascata. É o que substitui um limite de profundidade.
  const changed = flattenDataLeaves(ruled.data).filter(
    (leaf) => !sameValue(getValueAtPath(baseline, parsePath(leaf.path)), leaf.value),
  );
  if (changed.length === 0) return { payload: null, truncated };

  const payload: Record<string, unknown> = {};
  for (const leaf of changed) setValueAtPath(payload, leaf.path, leaf.value);
  return { payload, truncated };
};

const recomputeOneParent = async (
  ctx: SchemaContext,
  target: AggregationTarget,
  tenantId: string,
  parentId: string,
  deps: AggregateRecomputeDeps,
): Promise<void> => {
  const parent = resolveWritableTable(target.parentTable, ctx);
  if (!parent.ok || parent.value.kind === 'lookup') return;

  const parentCollection = parent.value.physicalCollection;
  const baseline = await deps.mutationRepository.getById(tenantId, parentCollection, parentId);
  if (!baseline) return;

  const { payload } = await computeAggregatePatch(ctx, [target], tenantId, parentId, baseline, deps);
  if (!payload) return;

  await deps.mutationRepository.update(tenantId, parentCollection, parentId, {
    ...payload,
    updatedBy: AGGREGATE_ENGINE_ACTOR,
  });
};

/**
 * Recalcula todos os agregados afetados pela mudança de um registro filho. Alcança tanto o pai atual
 * quanto o anterior — um filho que troca de pai precisa baixar o total de um e subir o do outro.
 */
export const recomputeAggregatesForChildChange = async (
  tenantId: string,
  childCollection: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
  deps: AggregateRecomputeDeps,
): Promise<void> => {
  const childTable = resolveChildTable(childCollection);

  const ctx = await deps.screenProvider.getSchemaContext(tenantId);
  const targets = collectAggregationsFor(ctx, childTable);
  if (targets.length === 0) return;

  for (const target of targets) {
    if (!changeAffectsAggregate(ctx, childTable, target, before, after)) continue;

    const parentIds = new Set<string>();
    for (const source of [before, after]) {
      if (!source) continue;
      const id = asRecordId(readChildField(ctx, childTable, source, target.aggregation.via));
      if (id) parentIds.add(id);
    }

    for (const parentId of parentIds) {
      await recomputeOneParent(ctx, target, tenantId, parentId, deps);
    }
  }
};
