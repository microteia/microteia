// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/report/reportRelated.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/report/reportRelated.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import { extractFieldExpressionPaths } from '../fieldExpression';
import { parsePath, resolvePath } from '../pathResolver';
import type { SchemaContext } from '../pathResolver';
import { checkQueryPredicates, resolveQueryTable } from '../querySpec';
import type { QuerySpec } from '../querySpec';
import { REPORT_RELATED_MODES } from './reportSpec';
import type { ReportRelated, ReportSpec } from './reportSpec';
import type { ReportSpecIssue } from './validateReportSpec';

/**
 * A leitura dos relacionados: o filtro fixo deles desce ao banco, e só o que a decisão precisa vem — o
 * campo de ligação e o que a expressão lê. Nenhuma coluna do relacionado entra no relatório.
 */
export const relatedQuery = (related: ReportRelated, scanCeiling: number): QuerySpec => ({
  table: related.table,
  where: related.where ?? [],
  limit: scanCeiling,
  projections: [...new Set([related.via, ...extractFieldExpressionPaths(related.includeWhen)])],
});

/**
 * Os ids que os relacionados APONTAM pelo campo de ligação. A referência múltipla grava uma lista, e cada
 * item dela conta — o pedido de dois clientes é pedido dos dois.
 */
export const relatedParentIds = (rows: readonly Record<string, unknown>[], via: string): Set<string> => {
  const ids = new Set<string>();
  for (const row of rows) {
    const value = row[via];
    for (const id of Array.isArray(value) ? value : [value]) {
      if (typeof id === 'string' && id !== '') ids.add(id);
    }
  }
  return ids;
};

/** Um cruzamento já resolvido: os ids apontados pelos relacionados que atendem, e o modo. */
export interface ResolvedRelated {
  mode: ReportRelated['mode'];
  ids: ReadonlySet<string>;
}

/** Os registros do relatório que passam em TODOS os cruzamentos — com quem tem, sem quem não tem. */
export const keepByRelated = (
  rows: Record<string, unknown>[],
  resolved: readonly ResolvedRelated[],
): Record<string, unknown>[] =>
  resolved.length === 0
    ? rows
    : rows.filter((row) => {
      const id = String(row.id ?? '');
      return resolved.every((one) => (one.mode === 'with' ? one.ids.has(id) : !one.ids.has(id)));
    });

/**
 * O que o validador diz de `dataset.related`. O campo de ligação TEM de ser uma referência do relacionado
 * para a coleção do relatório: com outro campo qualquer, "sem pedido" responderia sobre um id que nunca
 * casa — e todo cliente sairia "sem pedido", um número plausível e errado.
 */
export const relatedIssues = (spec: ReportSpec, ctx: SchemaContext): ReportSpecIssue[] => {
  const source = resolveQueryTable(spec.dataset.table, ctx);
  if (!source) return [];
  return (spec.dataset.related ?? []).flatMap((related, index): ReportSpecIssue[] => {
    const field = `dataset.related[${index}]`;
    const issues: ReportSpecIssue[] = [];
    if (!(REPORT_RELATED_MODES as readonly string[]).includes(related.mode)) {
      issues.push({ field: `${field}.mode`, error: '@core.reports/related.mode.invalid', errorParams: { mode: String(related.mode) } });
    }
    const table = resolveQueryTable(related.table, ctx);
    if (!table) {
      issues.push({ field: `${field}.table`, error: '@core.reports/dataset.table.unknown', errorParams: { table: related.table } });
      return issues;
    }
    const link = resolvePath(ctx, table.root, parsePath(related.via ?? '')).node;
    const pointsToSource = (link.kind === 'entity' || link.kind === 'entityList')
      && (link.collection === source.physicalCollection || link.collection === spec.dataset.table);
    if (!pointsToSource) {
      issues.push({
        field: `${field}.via`,
        error: '@core.reports/related.via.not-reference',
        errorParams: { via: related.via ?? '', table: related.table, source: spec.dataset.table },
      });
    }
    issues.push(...checkQueryPredicates(ctx, table.root, related.where ?? [], `${field}.where`));
    return issues;
  });
};
