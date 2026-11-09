import { MEMBER_REFERENCE_ENTITY } from '../schema/memberVisibility';
import { RECORD_LIST_FILTER_WINDOW } from './recordListQuery';
import type { FieldDefinition } from '../entities';
import type { ResolvedOptionsFilter } from '../schema/optionsFilter';
import type { RecordQueryClause, RecordQuerySpec } from './recordListQuery';

const queryableValue = (value: unknown): string | number | boolean | undefined => {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  // A origem que é ela mesma uma referência chega HIDRATADA: o registro inteiro no lugar do id.
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const id = (value as { id?: unknown }).id;
    return typeof id === 'string' ? id : undefined;
  }
  return undefined;
};

const isTopLevelPath = (path: string): boolean => path !== '' && !/[.[]/.test(path);

/**
 * A consulta que traz do servidor as candidatas de uma referência filtrada — as raças daquele tipo —,
 * para que a opção que ficou fora da janela dos mais recentes continue sendo oferecida.
 *
 * Só a IGUALDADE sobre um campo de topo desce: é a forma que os índices de campo único servem sem
 * índice composto, e uma coleção criada em runtime não pode declarar um. O resto do filtro é aplicado
 * em memória sobre o que voltar, como sobre a janela. Sem igualdade nenhuma, não há o que consultar.
 */
export const optionsFilterRecordQuery = (
  field: FieldDefinition,
  filter: ResolvedOptionsFilter | null,
): RecordQuerySpec | null => {
  if (field.type !== 'reference' || !field.refEntity || field.refEntity === MEMBER_REFERENCE_ENTITY) return null;
  if (!filter || filter.blocked) return null;
  const allOf: RecordQueryClause[] = [];
  for (const predicate of filter.predicates) {
    if (predicate.op !== 'eq' || !isTopLevelPath(predicate.path)) continue;
    const value = queryableValue(predicate.value);
    if (value !== undefined) allOf.push({ field: predicate.path, op: '==', value });
  }
  if (allOf.length === 0) return null;
  return {
    collection: field.refEntity,
    limit: RECORD_LIST_FILTER_WINDOW,
    anyOf: [],
    allOf,
    range: null,
    orderBy: null,
  };
};
