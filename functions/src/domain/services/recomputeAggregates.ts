import type { IScreenDefinitionProvider } from '../repositories/IScreenDefinitionProvider';
import type { IWorkflowMutationRepository } from '../repositories/IWorkflowMutationRepository';
import type { IWorkflowQueryRepository, WorkflowEqualityFilter } from '../repositories/IWorkflowQueryRepository';
import { aggregateChildren, collectAggregationsFor, readChildField } from '../schema/aggregationSpec';
import type { AggregationTarget } from '../schema/aggregationSpec';
import { flattenDataLeaves, resolveWritableTable, setValueAtPath } from '../schema/mutationSpec';
import { getValueAtPath, parsePath } from '../schema/pathResolver';
import type { SchemaContext } from '../schema/pathResolver';
import { formatAndValidateRecord } from '../schema/recordRules';

const AGGREGATE_ACTOR = 'aggregate-engine';

// Acima disto o agregado sairia incorreto por truncamento: melhor gravar o que dá e registrar o
// aviso do que silenciar a divergência. Vale igual para o `latest`: a consulta é só por igualdade no
// vínculo (servida pelos índices de campo único, sem índice composto por agregação) e a ordenação é
// em memória — então, acima do teto, o mais recente pode ter ficado fora da leitura.
const MAX_CHILDREN = 500;

export interface AggregateRecomputeDeps {
  screenProvider: IScreenDefinitionProvider;
  queryRepository: IWorkflowQueryRepository;
  mutationRepository: IWorkflowMutationRepository;
  logger?: { warn: (message: string) => void };
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

const recomputeOneParent = async (
  ctx: SchemaContext,
  childTable: string,
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

  const child = resolveWritableTable(childTable, ctx);
  if (!child.ok || child.value.kind === 'lookup') return;

  const filters = buildChildFilters(ctx, childTable, target.aggregation.via, parentId);
  if (!filters) return;

  const rows = await deps.queryRepository.queryByEquality(
    tenantId,
    child.value.physicalCollection,
    filters,
    MAX_CHILDREN,
  );
  if (rows.length === MAX_CHILDREN) {
    deps.logger?.warn(
      `Agregado "${target.label}" em ${target.parentTable}/${parentId}: limite de ${MAX_CHILDREN} filhos atingido, o valor pode estar incompleto`,
    );
  }

  const value = aggregateChildren(ctx, target.aggregation, childTable, rows);

  const patch: Record<string, unknown> = {};
  setValueAtPath(patch, target.parentPath, value);

  // Passa pelo gate para que um campo `compute` que dependa deste agregado seja recalculado no
  // mesmo write — é o que faz agregação e valor calculado se comporem.
  const ruled = formatAndValidateRecord(ctx, target.parentTable, patch, { baseline });
  if (ruled.issues.length > 0) return;

  // Guarda de recursão: sem diferença real, não grava — e sem write o `.saved` do pai não dispara,
  // encerrando a cascata. É o que substitui um limite de profundidade.
  const changed = flattenDataLeaves(ruled.data).filter(
    (leaf) => !sameValue(getValueAtPath(baseline, parsePath(leaf.path)), leaf.value),
  );
  if (changed.length === 0) return;

  const payload: Record<string, unknown> = {};
  for (const leaf of changed) setValueAtPath(payload, leaf.path, leaf.value);

  await deps.mutationRepository.update(tenantId, parentCollection, parentId, {
    ...payload,
    updatedBy: AGGREGATE_ACTOR,
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
      await recomputeOneParent(ctx, childTable, target, tenantId, parentId, deps);
    }
  }
};
