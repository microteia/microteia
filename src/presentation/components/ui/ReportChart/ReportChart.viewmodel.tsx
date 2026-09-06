import { useMemo } from 'react';
import { useTheme } from 'styled-components';
import { useLabel } from '../../../shared/i18n/useT';
import { useReportGroupLabels } from '../../../shared/report/useReportGroupLabels';
import { columnLabel, shownMeasures } from '../../../shared/report/reportFormatting';
import { reportCellKey } from '../../../../domain/schema/report/aggregateRows';
import type { ChartSeries, DonutSlice } from '../Chart';
import type { ReportResult } from '../../../../domain/schema/report/reportResult';
import type { ReportSpec } from '../../../../domain/schema/report/reportSpec';

export type ReportChartMark = 'bar' | 'column' | 'line' | 'area' | 'pie' | 'donut';

export interface ReportChartViewModel {
  /** A marca já reduzida ao que o kernel sabe desenhar. `null` = nada a desenhar. */
  mark: 'bar' | 'line' | 'donut' | null;
  data: Array<Record<string, string | number>>;
  series: ChartSeries[];
  slices: DonutSlice[];
  stacked: boolean;
  height: number;
}

/** A marca declarada, reduzida às três primitivas. Desconhecida não desenha — a tabela já mostra. */
const primitiveOf = (kind: string): 'bar' | 'line' | 'donut' | null => {
  if (kind === 'bar' || kind === 'column') return 'bar';
  if (kind === 'line' || kind === 'area') return 'line';
  if (kind === 'pie' || kind === 'donut') return 'donut';
  return null;
};

/**
 * Traduz o gráfico DECLARADO nas séries que as primitivas esperam.
 *
 * As primitivas não sabem o que desenham: recebem linhas prontas com rótulo e cor. A cor sai da
 * paleta do tema, na ordem — nunca de um hex dentro do pacote, que não sobreviveria à troca de tema.
 */
export const useReportChartViewModel = (
  spec: ReportSpec,
  result: ReportResult | null,
): ReportChartViewModel => {
  const theme = useTheme();
  const label = useLabel();
  const groupLabel = useReportGroupLabels(spec);

  return useMemo(() => {
    const chart = spec.presentation?.chart;
    const mark = chart ? primitiveOf(chart.kind) : null;
    const palette = theme.tagColors;

    if (!chart || !mark || !result) {
      return { mark: null, data: [], series: [], slices: [], stacked: false, height: 240 };
    }

    const measures = shownMeasures(spec)
      .filter((measure) => !chart.series || chart.series.includes(measure.key));

    const series: ChartSeries[] = measures.map((measure, index) => ({
      key: measure.key,
      label: columnLabel(measure.label, measure.key, label),
      color: palette[index % palette.length].value,
    }));

    // No pivô, cada coluna é um ponto do eixo; na dobra agrupada, cada linha é.
    const points = spec.shape.kind === 'matrix'
      ? result.columns.map((path) => ({
          name: path.map((entry) => groupLabel(entry)).join(' / '),
          values: result.columnTotals?.[reportCellKey(path)] ?? {},
        }))
      : result.rows
        .filter((row) => row.subtotal !== true)
        .map((row) => ({
          name: groupLabel(row.keys[row.keys.length - 1]),
          values: row.values,
        }));

    const data = points.map((point) => ({
      name: point.name,
      ...Object.fromEntries(measures.map((measure) => [measure.key, point.values[measure.key] ?? 0])),
    }));

    // A rosca mostra UMA medida: várias fatias de várias medidas no mesmo círculo somariam coisas
    // que não se somam.
    const slices: DonutSlice[] = mark === 'donut' && measures.length > 0
      ? points.map((point, index) => ({
          name: point.name,
          value: Number(point.values[measures[0].key] ?? 0),
          color: palette[index % palette.length].value,
        }))
      : [];

    return {
      mark,
      data,
      series,
      slices,
      stacked: chart.stacked === true,
      height: chart.height ?? 240,
    };
  }, [spec, result, theme, label, groupLabel]);
};
