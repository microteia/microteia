import type { InputMapping } from '../entities/Workflow';
import type { NativeFieldSpec } from './entityRegistry';
import type { PathRoot, SchemaContext } from './pathResolver';
import { parsePath, resolvePath } from './pathResolver';
import { isEntityCollection, isLookupTable } from './screenEntity';

export type QueryOperator =
  | 'eq'
  | 'neq'
  | 'lt'
  | 'lte'
  | 'gt'
  | 'gte'
  | 'in'
  | 'contains'
  | 'exists';

export interface QueryPredicate {
  path: string;
  op: QueryOperator;
  value?: InputMapping;
}

export interface QueryOrderBy {
  path: string;
  dir: 'asc' | 'desc';
}

export interface QuerySpec {
  table: string;
  where: QueryPredicate[];
  orderBy?: QueryOrderBy[];
  limit: number;
  projections: string[];
}

export const QUERY_OPERATORS_WITHOUT_VALUE: QueryOperator[] = ['exists'];

export const LOOKUP_QUERY_FIELDS: NativeFieldSpec[] = [
  { key: 'id', label: '@core.data/lookup.field.id', type: 'string' },
  { key: 'key', label: '@core.data/lookup.field.key', type: 'string' },
  { key: 'label', label: '@core.data/lookup.field.label', type: 'string' },
  { key: 'color', label: '@core.data/lookup.field.color', type: 'string' },
];

export interface ResolvedQueryTable {
  physicalCollection: string;
  root: PathRoot;
}

/**
 * A tabela É a coleção — para as fixas ('persons') tanto quanto para as telas do Form Design
 * ('medico'). Não há mais coleção física distinta da tabela lógica nem filtro implícito por tela.
 */
export const resolveQueryTable = (table: string, ctx: SchemaContext): ResolvedQueryTable | null => {
  if (isEntityCollection(ctx, table)) {
    return { physicalCollection: table, root: { kind: 'entity', entityKey: table, hasOld: false } };
  }
  if (isLookupTable(ctx, table)) {
    return { physicalCollection: table, root: { kind: 'fields', fields: LOOKUP_QUERY_FIELDS, hasOld: false } };
  }
  return null;
};

export interface QuerySpecIssue {
  field: string;
  /** REFERÊNCIA de mensagem: a validação roda também no backend, que não conhece idioma. */
  error: string;
  errorParams?: Record<string, string>;
}

export const validateQuerySpec = (spec: QuerySpec, ctx: SchemaContext): QuerySpecIssue[] => {
  const issues: QuerySpecIssue[] = [];

  const resolved = resolveQueryTable(spec.table, ctx);
  if (!resolved) {
    issues.push({
      field: 'table',
      error: '@core.automation/mutation.table.unknown',
      errorParams: { table: spec.table },
    });
    return issues;
  }

  const checkPath = (path: string, field: string): void => {
    if (!path.trim()) {
      issues.push({ field, error: '@core.automation/query.path.missing' });
      return;
    }
    const resolution = resolvePath(ctx, resolved.root, parsePath(path));
    if (!resolution.valid) {
      issues.push(
        resolution.error
          ? { field, error: resolution.error, errorParams: resolution.errorParams }
          : { field, error: '@core.automation/mutation.path.invalid', errorParams: { path } },
      );
    }
  };

  spec.where.forEach((predicate, index) => {
    checkPath(predicate.path, `where[${index}].path`);
    if (!QUERY_OPERATORS_WITHOUT_VALUE.includes(predicate.op) && !predicate.value) {
      issues.push({
        field: `where[${index}].value`,
        error: '@core.automation/query.filter-value.missing',
      });
    }
  });
  spec.orderBy?.forEach((order, index) => checkPath(order.path, `orderBy[${index}].path`));
  spec.projections.forEach((path, index) => checkPath(path, `projections[${index}]`));

  if (!Number.isFinite(spec.limit) || spec.limit <= 0) {
    issues.push({ field: 'limit', error: '@core.automation/query.limit.invalid' });
  }

  return issues;
};
