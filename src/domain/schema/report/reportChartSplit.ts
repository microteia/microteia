// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/report/reportChartSplit.ts
// é GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import type { ReportGroupLevel, ReportSpec } from './reportSpec';

/**
 * De ONDE sai a segunda dimensão do gráfico.
 *
 * `level`: um nível de agrupamento das linhas, logo abaixo do nível do eixo. Cada linha desse nível
 * já carrega a chave do pai — o ponto — e a dela — o membro da série —, com os números daquele par.
 *
 * `column`: o agrupamento das colunas do pivô, com o eixo nas linhas. Cada linha traz uma célula por
 * coluna, e cada coluna vira uma série: é o `columns` do pivô virando legenda.
 *
 * `row`: o pivô ao contrário — o eixo nas colunas, que é o padrão do pivô, e um nível das linhas como
 * legenda. Cada série é uma linha do resultado, e cada ponto dela, uma célula.
 */
export type ReportChartSplit =
  | { source: 'level'; categoryDepth: number; splitDepth: number }
  | { source: 'column'; categoryDepth: number | null }
  | { source: 'row'; splitDepth: number };

/** Os níveis que a dobra agrupa nas LINHAS, na ordem. */
export const reportRowLevels = (spec: ReportSpec): ReportGroupLevel[] => {
  if (spec.shape.kind === 'summary') return spec.shape.groupBy;
  if (spec.shape.kind === 'tabular') return spec.shape.groupBy ?? [];
  return spec.shape.rows;
};

/** A rosca mostra UMA medida sobre UM eixo: não há onde pôr uma segunda dimensão. */
export const isSingleSeriesChartKind = (kind: string): boolean => kind === 'pie' || kind === 'donut';

/**
 * O resultado só traz a linha de um nível intermediário quando ele pede subtotal — a lista agrupada
 * é a exceção, e traz todas, porque cada faixa dela fecha com o próprio total.
 */
const levelHasRows = (spec: ReportSpec, levels: ReportGroupLevel[], depth: number): boolean =>
  spec.shape.kind === 'tabular' || depth === levels.length - 1 || levels[depth]?.subtotal === true;

/**
 * Como ESTE kernel quebra o gráfico por `splitBy`, ou `null` quando não há quebra a desenhar.
 *
 * A quebra só é desenhada quando cada par (ponto, membro) é UMA linha do resultado. Somar no cliente
 * várias linhas num ponto daria o número errado em toda medida que não é soma — a média das médias
 * não é a média —, e por isso um nível de distância entre o eixo e a quebra não é aproximado: é
 * recusado aqui e avisado na validação, e o gráfico sai sem a quebra, com os números certos.
 *
 * É a MESMA função que decide o desenho e o aviso. Duas cópias da regra divergiriam no primeiro
 * caso novo, e o aviso diria uma coisa enquanto o gráfico fazia outra.
 */
export const reportChartSplit = (spec: ReportSpec): ReportChartSplit | null => {
  const chart = spec.presentation?.chart;
  if (!chart?.splitBy || isSingleSeriesChartKind(chart.kind)) return null;

  const levels = reportRowLevels(spec);
  const columns = spec.shape.kind === 'matrix' ? spec.shape.columns : [];
  const isColumn = (key: string | undefined): boolean =>
    columns.some((level) => level.dimension === key);
  const declaredCategory = chart.category === undefined
    ? -1
    : levels.findIndex((level) => level.dimension === chart.category);

  const splitDepth = levels.findIndex((level) => level.dimension === chart.splitBy);
  if (splitDepth >= 0) {
    if (!levelHasRows(spec, levels, splitDepth)) return null;

    // No pivô, o eixo sem categoria declarada são as colunas — é o que o gráfico dele desenha sem
    // quebra nenhuma —, e a quebra por um nível das linhas só acrescenta a legenda.
    if (spec.shape.kind === 'matrix' && (chart.category === undefined || isColumn(chart.category))) {
      return { source: 'row', splitDepth };
    }

    const categoryDepth = declaredCategory >= 0 ? declaredCategory : splitDepth - 1;
    if (categoryDepth < 0 || categoryDepth !== splitDepth - 1) return null;
    return { source: 'level', categoryDepth, splitDepth };
  }

  if (isColumn(chart.splitBy)) {
    if (declaredCategory >= 0 && !levelHasRows(spec, levels, declaredCategory)) return null;
    return { source: 'column', categoryDepth: declaredCategory >= 0 ? declaredCategory : null };
  }

  return null;
};
