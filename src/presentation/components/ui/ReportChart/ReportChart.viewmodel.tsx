import { useMemo } from 'react';
import { useTheme } from 'styled-components';
import { useLabel } from '../../../shared/i18n/useT';
import { useReportGroupLabels } from '../../../shared/report/useReportGroupLabels';
import { columnLabel, shownMeasures } from '../../../shared/report/reportFormatting';
import { reportCellKey } from '../../../../domain/schema/report/aggregateRows';
import { reportChartSplit, reportRowLevels } from '../../../../domain/schema/report/reportChartSplit';
import type { ReportChartSplit } from '../../../../domain/schema/report/reportChartSplit';
import type { ChartSeries, DonutSlice } from '../Chart';
import type { ReportGroupKey, ReportResult, ReportRow } from '../../../../domain/schema/report/reportResult';
import type { ReportSpec } from '../../../../domain/schema/report/reportSpec';

export type ReportChartMark = 'bar' | 'column' | 'line' | 'area' | 'pie' | 'donut';

export interface ReportChartViewModel {
  /** A marca já reduzida ao que o kernel sabe desenhar. `null` = nada a desenhar. */
  mark: 'bar' | 'line' | 'donut' | null;
  /**
   * A VARIANTE da primitiva: barras deitadas (`bar`) ou em pé (`column`), área preenchida (`area`),
   * pizza cheia (`pie`). Antes cada par era desenhado igual, e escolher "Área" dava uma linha sem
   * nada na tela dizendo que a escolha não valeu.
   */
  horizontal: boolean;
  filled: boolean;
  solid: boolean;
  data: Array<Record<string, string | number>>;
  series: ChartSeries[];
  slices: DonutSlice[];
  stacked: boolean;
  height: number;
}

const NOTHING: ReportChartViewModel = {
  mark: null, horizontal: false, filled: false, solid: false, data: [], series: [], slices: [], stacked: false, height: 240,
};

/** A marca declarada, reduzida às três primitivas. Desconhecida não desenha — a tabela já mostra. */
const primitiveOf = (kind: string): 'bar' | 'line' | 'donut' | null => {
  if (kind === 'bar' || kind === 'column') return 'bar';
  if (kind === 'line' || kind === 'area') return 'line';
  if (kind === 'pie' || kind === 'donut') return 'donut';
  return null;
};

/**
 * O NÍVEL de agrupamento que vira o eixo categórico, ou `null` para o mais interno.
 *
 * A categoria declarada era lida na validação e ignorada no desenho: quem escolhia agrupar o gráfico
 * pelo primeiro nível de dois via o segundo, e nada na tela dizia que a escolha não valeu.
 */
const categoryDepth = (spec: ReportSpec, category: string | undefined): number | null => {
  const levels = reportRowLevels(spec);
  if (levels.length === 0) return null;

  const depth = category === undefined
    ? -1
    : levels.findIndex((level) => level.dimension === category);
  if (depth >= 0) return depth;

  // Na lista AGRUPADA nenhuma linha é folha no sentido do resumo — toda linha de grupo carrega os
  // números dela. Sem escolher um nível, o ponto é o mais fundo: é o que a tabela mostra abaixo de
  // cada faixa, e o gráfico não pode desenhar uma leitura que a tabela ao lado não confirma.
  return spec.shape.kind === 'tabular' ? levels.length - 1 : null;
};

/** As linhas que viram ponto: as do nível pedido, ou as folhas quando nenhum foi pedido. */
const pointRows = (rows: ReportRow[], depth: number | null): ReportRow[] =>
  rows.filter((row) => (depth === null ? row.subtotal !== true : row.level === depth));

interface PlotPoint {
  name: string;
  values: Record<string, number | null>;
}

interface Plot {
  points: PlotPoint[];
  series: { key: string; label: string }[];
}

type ShownMeasure = ReturnType<typeof shownMeasures>[number];

type GroupLabel = (entry: ReportGroupKey | undefined) => string;

/**
 * Uma série por par (medida, membro). A chave é posicional, e não o valor cru do membro: o gráfico
 * lê `dataKey` como caminho, e um ponto dentro de uma opção do escritório viraria um campo aninhado
 * que não existe. Com uma medida só, o membro basta como nome — repetir a medida em toda entrada da
 * legenda seria ruído.
 */
const splitSeries = (
  measures: ShownMeasure[],
  members: string[],
  measureLabel: (measure: ShownMeasure) => string,
): Array<{ key: string; label: string; measure: string; member: number }> =>
  measures.flatMap((measure, measureIndex) => members.map((member, memberIndex) => ({
    key: `split-${measureIndex}-${memberIndex}`,
    label: measures.length === 1 ? member : [measureLabel(measure), member].join(' / '),
    measure: measure.key,
    member: memberIndex,
  })));

/**
 * O gráfico quebrado por `splitBy`: o ponto vem do nível do eixo, e cada membro da segunda dimensão
 * vira uma série. Nenhum número é somado aqui — cada valor é uma linha (ou célula) que o agregador já
 * devolveu, e é isso que mantém certa a média, o mínimo e a contagem distinta.
 */
const splitPlot = (
  split: ReportChartSplit,
  result: ReportResult,
  measures: ShownMeasure[],
  groupLabel: GroupLabel,
  measureLabel: (measure: ShownMeasure) => string,
): Plot => {
  if (split.source === 'row') {
    const members = result.rows.filter((row) => row.level === split.splitDepth);
    const series = splitSeries(
      measures,
      members.map((row) => groupLabel(row.keys[row.keys.length - 1])),
      measureLabel,
    );

    return {
      series,
      points: result.columns.map((path) => {
        const cellKey = reportCellKey(path);
        return {
          name: path.map((entry) => groupLabel(entry)).join(' / '),
          values: Object.fromEntries(series.map((one) => [
            one.key,
            members[one.member].cells?.[cellKey]?.[one.measure] ?? null,
          ])),
        };
      }),
    };
  }

  if (split.source === 'column') {
    const members = result.columns.map((path) => path.map((entry) => groupLabel(entry)).join(' / '));
    const series = splitSeries(measures, members, measureLabel);
    const cellKeys = result.columns.map((path) => reportCellKey(path));

    return {
      series,
      points: pointRows(result.rows, split.categoryDepth).map((row) => ({
        name: groupLabel(row.keys[row.keys.length - 1]),
        values: Object.fromEntries(series.map((one) => [
          one.key,
          row.cells?.[cellKeys[one.member]]?.[one.measure] ?? null,
        ])),
      })),
    };
  }

  const memberIndex = new Map<string, number>();
  const memberLabels: string[] = [];
  const byPoint = new Map<string, { name: string; rows: ReportRow[] }>();

  for (const row of result.rows.filter((one) => one.level === split.splitDepth)) {
    const member = row.keys[split.splitDepth];
    if (!memberIndex.has(member.key)) {
      memberIndex.set(member.key, memberLabels.length);
      memberLabels.push(groupLabel(member));
    }

    const pointKey = reportCellKey(row.keys.slice(0, split.splitDepth));
    const point = byPoint.get(pointKey)
      ?? { name: groupLabel(row.keys[split.categoryDepth]), rows: [] };
    point.rows.push(row);
    byPoint.set(pointKey, point);
  }

  const series = splitSeries(measures, memberLabels, measureLabel);
  const points = [...byPoint.values()].map((point) => {
    const values: Record<string, number | null> = {};
    for (const row of point.rows) {
      const member = memberIndex.get(row.keys[split.splitDepth].key);
      for (const one of series) {
        if (one.member === member) values[one.key] = row.values[one.measure] ?? null;
      }
    }
    return { name: point.name, values };
  });

  return { series, points };
};

/**
 * Traduz o gráfico DECLARADO nas séries que as primitivas esperam.
 *
 * As primitivas não sabem o que desenham: recebem linhas prontas com rótulo e cor. A cor sai da
 * paleta do tema, na ordem — nunca de um hex dentro do pacote, que não sobreviveria à troca de tema.
 *
 * Sem ponto ou sem série, a marca volta `null` e a moldura não é desenhada. Um retângulo vazio ao
 * lado de uma tabela cheia é a pior resposta possível: parece defeito do produto, e não diz que o
 * relatório é uma lista simples — que não agrupa, e por isso não tem o que plotar.
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

    if (!chart || !mark || !result) return NOTHING;

    const measures = shownMeasures(spec)
      .filter((measure) => !chart.series || chart.series.includes(measure.key));

    const measureLabel = (measure: ShownMeasure): string => columnLabel(measure.label, measure.key, label);

    // No pivô, cada coluna é um ponto do eixo; na dobra agrupada, cada linha do nível escolhido é.
    const points: PlotPoint[] = spec.shape.kind === 'matrix'
      ? result.columns.map((path) => ({
          name: path.map((entry) => groupLabel(entry)).join(' / '),
          values: result.columnTotals?.[reportCellKey(path)] ?? {},
        }))
      : pointRows(result.rows, categoryDepth(spec, chart.category))
        .map((row) => ({
          name: groupLabel(row.keys[row.keys.length - 1]),
          values: row.values,
        }));

    // A quebra que não pode ser desenhada não leva o gráfico junto: ele sai sem ela, com os mesmos
    // números da tabela, e a validação diz por quê.
    const split = mark === 'donut' ? null : reportChartSplit(spec);
    const plot: Plot = split
      ? splitPlot(split, result, measures, groupLabel, measureLabel)
      : {
          points,
          series: measures.map((measure) => ({ key: measure.key, label: measureLabel(measure) })),
        };

    const series: ChartSeries[] = plot.series.map((one, index) => ({
      key: one.key,
      label: one.label,
      color: palette[index % palette.length].value,
    }));

    const data = plot.points.map((point) => ({
      name: point.name,
      ...Object.fromEntries(series.map((one) => [one.key, point.values[one.key] ?? 0])),
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

    if (mark === 'donut' ? slices.length === 0 : data.length === 0 || series.length === 0) {
      return NOTHING;
    }

    return {
      mark,
      horizontal: chart.kind === 'bar',
      filled: chart.kind === 'area',
      solid: chart.kind === 'pie',
      data,
      series,
      slices,
      stacked: chart.stacked === true,
      height: chart.height ?? 240,
    };
  }, [spec, result, theme, label, groupLabel]);
};
