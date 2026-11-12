// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/report/reportComputedDimension.ts
// é GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import { evaluateFieldExpression, extractFieldExpressionPaths } from '../fieldExpression';
import { isBusinessDaysError } from '../time/businessDays';
import { isComputedDimension } from './reportSpec';
import type { ReportRowFilterInput, ReportRowFilterOutcome } from './reportRowFilter';
import { reportRowScope } from './reportRowFilter';

/**
 * Onde a linha guarda o valor das dimensões calculadas. Um nome que nenhum campo pode ter — o mesmo
 * separador da chave reservada de "Outros" —, para o valor calculado nunca cobrir um campo de verdade.
 */
export const REPORT_DIMENSION_SLOT = '\u001edimensions';

export const computedDimensionValue = (row: Record<string, unknown>, key: string): unknown => {
  const slot = row[REPORT_DIMENSION_SLOT];
  return slot && typeof slot === 'object' ? (slot as Record<string, unknown>)[key] ?? null : null;
};

/** A linha sem o que o relatório calculou nela — o registro como ele é, para quem o vê no detalhe. */
export const withoutComputedDimensions = (row: Record<string, unknown>): Record<string, unknown> => {
  if (!(REPORT_DIMENSION_SLOT in row)) return row;
  const rest = { ...row };
  delete rest[REPORT_DIMENSION_SLOT];
  return rest;
};

/**
 * Calcula as dimensões por expressão, UMA vez por linha, entre o filtro e a agregação.
 *
 * Uma vez, e não a cada leitura da chave, porque a chave é lida de novo pelo pivô e pelo detalhamento:
 * `today()` avaliado em instantes diferentes poria a mesma linha em dois grupos. E aqui, e não no
 * agregador, pela mesma razão do filtro de linha: a expressão pode RECUSAR, e o agregador devolve um
 * resultado, nunca um resultado-ou-recusa.
 *
 * Expressão que estoura numa linha é recusa nomeada, como no filtro: "na dúvida, grupo vazio" seria um
 * aging com as faturas de que ninguém sabe a idade escondidas sob "sem valor".
 */
export const materializeReportDimensions = (input: ReportRowFilterInput): ReportRowFilterOutcome => {
  const computed = (input.spec.dataset.dimensions ?? []).filter(isComputedDimension);
  if (computed.length === 0) return { ok: true, rows: input.rows };

  const plans = computed.map((dimension) => {
    const expression = (dimension.expression ?? '').trim();
    return { key: dimension.key, expression, paths: extractFieldExpressionPaths(expression) };
  });

  const rows: Record<string, unknown>[] = [];
  for (const row of input.rows) {
    const values: Record<string, unknown> = {};
    for (const plan of plans) {
      try {
        values[plan.key] = evaluateFieldExpression(plan.expression, {
          value: row.value ?? null,
          data: reportRowScope(row, plan.paths),
          entity: input.entity,
          permissions: input.permissions,
          at: input.now,
          timeZone: input.timeZone,
          businessCalendars: input.businessCalendars,
        }) ?? null;
      } catch (caught) {
        if (isBusinessDaysError(caught)) return { ok: false, error: caught.message, errorParams: caught.params };
        return {
          ok: false,
          error: '@core.reports/dimension.expression.failed',
          errorParams: { key: plan.key, detail: caught instanceof Error ? caught.message : String(caught) },
        };
      }
    }
    rows.push({ ...row, [REPORT_DIMENSION_SLOT]: values });
  }
  return { ok: true, rows };
};
