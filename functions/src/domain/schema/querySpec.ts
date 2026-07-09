// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/querySpec.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

import type { InputMapping } from '../entities/Workflow';
import type { NativeFieldSpec } from './entityRegistry';
import { getEntityByCollection } from './entityRegistry';
import { isLookupCollection } from './lookupRegistry';
import type { PathRoot, SchemaContext } from './pathResolver';
import { parsePath, resolvePath } from './pathResolver';

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
  { key: 'key', label: 'Chave', type: 'string' },
  { key: 'label', label: 'Rótulo', type: 'string' },
  { key: 'collection', label: 'Coleção', type: 'string' },
];

export interface ResolvedQueryTable {
  physicalCollection: string;
  screenKey?: string;
  root: PathRoot;
}

export const resolveQueryTable = (table: string, ctx: SchemaContext): ResolvedQueryTable | null => {
  const entity = getEntityByCollection(table);
  if (entity && entity.key !== 'customRecords') {
    return { physicalCollection: entity.collection, root: { kind: 'entity', entityKey: entity.key, hasOld: false } };
  }
  if (isLookupCollection(table)) {
    return { physicalCollection: table, root: { kind: 'fields', fields: LOOKUP_QUERY_FIELDS, hasOld: false } };
  }
  if (ctx.screens.has(table)) {
    return {
      physicalCollection: 'customRecords',
      screenKey: table,
      root: { kind: 'entity', entityKey: 'customRecords', screenKey: table, hasOld: false },
    };
  }
  return null;
};

export interface QuerySpecIssue {
  field: string;
  error: string;
}

export const validateQuerySpec = (spec: QuerySpec, ctx: SchemaContext): QuerySpecIssue[] => {
  const issues: QuerySpecIssue[] = [];

  const resolved = resolveQueryTable(spec.table, ctx);
  if (!resolved) {
    issues.push({ field: 'table', error: `Tabela "${spec.table}" não existe` });
    return issues;
  }

  const checkPath = (path: string, field: string): void => {
    if (!path.trim()) {
      issues.push({ field, error: 'Caminho não informado' });
      return;
    }
    const resolution = resolvePath(ctx, resolved.root, parsePath(path));
    if (!resolution.valid) {
      issues.push({ field, error: resolution.error ?? `Caminho "${path}" inválido` });
    }
  };

  spec.where.forEach((predicate, index) => {
    checkPath(predicate.path, `where[${index}].path`);
    if (!QUERY_OPERATORS_WITHOUT_VALUE.includes(predicate.op) && !predicate.value) {
      issues.push({ field: `where[${index}].value`, error: 'Valor do filtro não informado' });
    }
  });
  spec.orderBy?.forEach((order, index) => checkPath(order.path, `orderBy[${index}].path`));
  spec.projections.forEach((path, index) => checkPath(path, `projections[${index}]`));

  if (!Number.isFinite(spec.limit) || spec.limit <= 0) {
    issues.push({ field: 'limit', error: 'Limite deve ser um número positivo' });
  }

  return issues;
};
