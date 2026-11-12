import type { LocaleFormatters } from '../i18n/useT';
import type { ReportResult } from '../../../domain/schema/report/reportResult';
import type { ReportValueFormat } from '../../../domain/schema/report/reportSpec';

// As peças da TABELA moram no domínio compartilhado: a planilha da tela e o arquivo de uma automação
// saem da mesma `buildReportTable`.
export { columnLabel, groupDimensions, rowDimensions, shownMeasures } from '../../../domain/schema/report/reportTable';

/**
 * O texto de um valor agregado.
 *
 * `null` é ausência de resposta — média de nada não é zero —, e por isso vira travessão em vez de
 * `0`: um zero ali seria uma afirmação que ninguém fez.
 */
export const formatMeasureValue = (
  value: number | null | undefined,
  format: ReportValueFormat | undefined,
  formatters: LocaleFormatters,
): string => {
  if (value === null || value === undefined) return '—';

  switch (format?.kind) {
    case 'currency':
      return formatters.formatMoney(value);
    case 'percent':
      return `${formatters.formatNumber(value, {
        minimumFractionDigits: format.decimals ?? 1,
        maximumFractionDigits: format.decimals ?? 1,
      })}%`;
    case 'integer':
      return formatters.formatNumber(value, { maximumFractionDigits: 0 });
    default:
      return formatters.formatNumber(value, {
        minimumFractionDigits: format?.decimals ?? 0,
        maximumFractionDigits: format?.decimals ?? 2,
      });
  }
};

export const hasRows = (result: ReportResult | null): boolean =>
  result !== null && (result.rows.length > 0 || (result.records ?? []).length > 0);
