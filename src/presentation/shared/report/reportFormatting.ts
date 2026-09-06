import type { LocaleFormatters } from '../i18n/useT';
import type { ReportResult } from '../../../domain/schema/report/reportResult';
import type { ReportDimension, ReportSpec, ReportValueFormat } from '../../../domain/schema/report/reportSpec';

/**
 * O rótulo de uma coluna ou de um número, resolvido pela regra de sempre: `@ns/chave` traduz, o que
 * o escritório digitou passa INTACTO. Na ausência de rótulo, a chave é o nome — é o que a autoria
 * mostra enquanto ninguém escreveu um.
 */
export const columnLabel = (
  declared: string | undefined,
  fallback: string,
  label: (value: string | null | undefined) => string,
): string => (declared ? label(declared) : fallback);

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

/** As medidas exibidas pela dobra, na ordem, com o formato que cada uma declara. */
export const shownMeasures = (spec: ReportSpec): { key: string; label?: string; format?: ReportValueFormat }[] => {
  const declared = spec.dataset.measures ?? [];
  const keys = spec.shape.kind === 'tabular'
    ? declared.map((measure) => measure.key)
    : spec.shape.values;

  return keys
    .map((key) => declared.find((measure) => measure.key === key))
    .filter((measure): measure is NonNullable<typeof measure> => measure !== undefined)
    .map((measure) => ({ key: measure.key, label: measure.label, format: measure.format }));
};

/** As dimensões que a dobra agrupa nas LINHAS, na ordem dos níveis. */
export const rowDimensions = (spec: ReportSpec): ReportDimension[] => {
  const declared = spec.dataset.dimensions ?? [];
  const keys = spec.shape.kind === 'summary'
    ? spec.shape.groupBy.map((level) => level.dimension)
    : (spec.shape.kind === 'matrix' ? spec.shape.rows.map((level) => level.dimension) : spec.shape.columns);

  return keys
    .map((key) => declared.find((dimension) => dimension.key === key))
    .filter((dimension): dimension is ReportDimension => dimension !== undefined);
};

/**
 * As dimensões que QUEBRAM a lista em grupos, na ordem dos níveis. Vazio em toda outra dobra.
 *
 * Separada de `rowDimensions` de propósito: na lista agrupada as duas respondem coisas diferentes —
 * uma é o que cada linha MOSTRA, a outra é o que as REÚNE —, e foi confundir as duas que fazia cada
 * campo virar um nível de recuo em vez de uma coluna.
 */
export const groupDimensions = (spec: ReportSpec): ReportDimension[] => {
  if (spec.shape.kind !== 'tabular') return [];
  const declared = spec.dataset.dimensions ?? [];

  return (spec.shape.groupBy ?? [])
    .map((level) => declared.find((dimension) => dimension.key === level.dimension))
    .filter((dimension): dimension is ReportDimension => dimension !== undefined);
};

export const hasRows = (result: ReportResult | null): boolean =>
  result !== null && (result.rows.length > 0 || (result.records ?? []).length > 0);
