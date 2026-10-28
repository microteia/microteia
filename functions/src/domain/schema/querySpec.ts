// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/querySpec.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

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

/**
 * A leitura em PÁGINAS de uma coleção maior que os tetos.
 *
 * A página percorre a coleção na ordem do id do documento — a ordem em que o Firestore já entrega uma
 * consulta só de igualdades —, e por isso o cursor não pede índice composto nenhum: é o id do último
 * registro que a página consumiu. Presente, a consulta publica `cursor`; ausente, nada muda.
 */
export interface QueryPage {
  /** O `cursor` publicado pela página anterior. Ausente, vazio ou nulo: a primeira página. */
  after?: InputMapping;
}

export interface QuerySpec {
  table: string;
  where: QueryPredicate[];
  orderBy?: QueryOrderBy[];
  limit: number;
  projections: string[];
  page?: QueryPage;
}

/**
 * Os tetos de uma consulta de automação. A varredura traz no máximo `QUERY_MAX_SCAN` documentos do
 * banco — só a igualdade desce, o resto é filtrado em memória sobre eles — e a resposta leva no máximo
 * `QUERY_MAX_RESULTS`. Moram aqui, e não no backend, porque o guia de autoria, o `check` e o construtor
 * visual dizem o mesmo número que o motor aplica.
 */
export const QUERY_MAX_SCAN = 300;
export const QUERY_MAX_RESULTS = 100;

/** O kernel em que a consulta passou a ler em páginas (`QuerySpec.page`). */
export const QUERY_PAGE_SINCE_KERNEL = '2.83.0';

/** Todos os operadores, para quem precisa VALIDAR um operador declarado em vez de executá-lo. */
export const QUERY_OPERATORS: readonly QueryOperator[] =
  ['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'in', 'contains', 'exists'];

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

/**
 * Confere UM caminho contra o esquema.
 *
 * Extraído para que o relatório cobre exatamente o que a automação cobra. Duas cópias divergiriam na
 * primeira operação nova, e a divergência apareceria como "o fluxo recusa, o relatório aceita" — a
 * pior forma de descobrir que existem duas verdades sobre o mesmo caminho.
 */
export const checkQueryPath = (
  ctx: SchemaContext,
  root: PathRoot,
  path: string,
  field: string,
): QuerySpecIssue[] => {
  if (!path.trim()) return [{ field, error: '@core.automation/query.path.missing' }];

  const resolution = resolvePath(ctx, root, parsePath(path));
  if (resolution.valid) return [];

  return [
    resolution.error
      ? { field, error: resolution.error, errorParams: resolution.errorParams }
      : { field, error: '@core.automation/mutation.path.invalid', errorParams: { path } },
  ];
};

/** O mesmo para uma lista de predicados: caminho que resolve e, quando o operador exige, valor presente. */
export const checkQueryPredicates = (
  ctx: SchemaContext,
  root: PathRoot,
  predicates: QueryPredicate[],
  prefix: string,
): QuerySpecIssue[] =>
  predicates.flatMap((predicate, index) => {
    const issues: QuerySpecIssue[] = checkQueryPath(ctx, root, predicate.path, `${prefix}[${index}].path`);
    if (!QUERY_OPERATORS_WITHOUT_VALUE.includes(predicate.op) && !predicate.value) {
      issues.push({ field: `${prefix}[${index}].value`, error: '@core.automation/query.filter-value.missing' });
    }
    return issues;
  });

export const validateQuerySpec = (spec: QuerySpec, ctx: SchemaContext): QuerySpecIssue[] => {
  const resolved = resolveQueryTable(spec.table, ctx);
  if (!resolved) {
    return [{
      field: 'table',
      error: '@core.automation/mutation.table.unknown',
      errorParams: { table: spec.table },
    }];
  }

  const issues: QuerySpecIssue[] = [
    ...checkQueryPredicates(ctx, resolved.root, spec.where, 'where'),
    ...(spec.orderBy ?? []).flatMap((order, index) =>
      checkQueryPath(ctx, resolved.root, order.path, `orderBy[${index}].path`)),
    ...spec.projections.flatMap((path, index) =>
      checkQueryPath(ctx, resolved.root, path, `projections[${index}]`)),
  ];

  if (!Number.isFinite(spec.limit) || spec.limit <= 0) {
    issues.push({ field: 'limit', error: '@core.automation/query.limit.invalid' });
  }

  // A página segue a ordem do id; uma ordenação declarada valeria só dentro de cada página, e a
  // sequência das páginas não seria ordenada por ela. Recusar é dizer isso antes da primeira execução.
  if (spec.page && (spec.orderBy ?? []).length > 0) {
    issues.push({ field: 'page', error: '@core.automation/query.page.order-by' });
  }

  return issues;
};

/**
 * O que a consulta aceita, mas não entrega como está escrito. Nunca recusa: a automação gravada com
 * `limit: 300` roda desde sempre devolvendo 100, e passar a reprová-la quebraria quem já a usa.
 */
export const querySpecWarnings = (spec: QuerySpec): QuerySpecIssue[] =>
  Number.isFinite(spec.limit) && spec.limit > QUERY_MAX_RESULTS
    ? [{
      field: 'limit',
      error: '@core.automation/query.limit.above-ceiling',
      errorParams: { limit: String(spec.limit), max: String(QUERY_MAX_RESULTS), scan: String(QUERY_MAX_SCAN) },
    }]
    : [];
