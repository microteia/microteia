// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/report/reportCapabilities.ts
// é GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import { DEFAULT_REPORT_DATASET_KIND, isAggregateMeasure } from './reportSpec';
import type { ReportGroupLevel, ReportSpec } from './reportSpec';

/**
 * As capacidades que ESTE kernel sabe executar.
 *
 * A lista só CRESCE — há teste. É ela que permite a um relatório escrito com o SDK de 2031, mas que
 * só usa o que 2026 sabia fazer, rodar num kernel de 2026: o carimbo de versão do pacote seria
 * grosso demais para essa pergunta, porque recusaria a extensão inteira por causa de um recurso que
 * ela nem chegou a usar.
 */
export const REPORT_CAPABILITIES: readonly string[] = [
  'dataset.collection',
  'dataset.includeWhen',
  'dimension.granularity',
  'export.csv',
  'export.pdf',
  'measure.aggregate',
  'measure.computed',
  'measure.distinct',
  'measure.filter',
  'presentation.chart',
  'presentation.chart.split',
  'presentation.prompt',
  'shape.matrix',
  'shape.subtotal',
  'shape.summary',
  'shape.tabular',
  'shape.tabular.group',
];

const anySubtotal = (levels: ReportGroupLevel[]): boolean =>
  levels.some((level) => level.subtotal === true);

/**
 * As capacidades que o spec de fato usa. É DERIVADA: o autor nunca a escreve, e o portão do pacote
 * reprova a divergência entre `spec.requires` e esta função.
 *
 * Emite deliberadamente tokens que `REPORT_CAPABILITIES` ainda NÃO tem (`dataset.join`,
 * `schedule`). É esse descompasso que faz o kernel recusar pelo NOME do recurso que
 * lhe falta, em vez de somar sem ele e devolver um número diferente com o mesmo rótulo.
 *
 * O mesmo vale para a propriedade que o contrato PREVÊ e este kernel ainda não lê — `shape.limit`,
 * `presentation.fields`, o alvo do detalhamento, o
 * controle/obrigatoriedade/semente de um filtro e a ordenação por rótulo. Antes disso elas eram
 * no-ops silenciosos: o autor declarava e nada acontecia, sem uma palavra em lugar nenhum. Emitir o
 * token põe cada uma no MESMO caminho de aviso que já existia, e o dia em que uma delas for
 * executada é o dia em que ela entra em `REPORT_CAPABILITIES` e o aviso some sozinho.
 */
export const deriveReportRequires = (spec: ReportSpec): string[] => {
  const required = new Set<string>();

  required.add(`dataset.${spec.dataset.kind ?? DEFAULT_REPORT_DATASET_KIND}`);
  // O filtro por expressão pede token PRÓPRIO, e sob `dataset.` de propósito: um kernel que não o
  // execute somaria justamente as linhas que ele exclui, com o mesmo rótulo no total.
  if ((spec.dataset.includeWhen ?? '').trim() !== '') required.add('dataset.includeWhen');

  for (const dimension of spec.dataset.dimensions ?? []) {
    if (dimension.granularity !== undefined) required.add('dimension.granularity');
    if (dimension.sort?.by !== undefined && dimension.sort.by !== 'key') {
      required.add('dimension.sort.by');
    }
  }

  for (const measure of spec.dataset.measures ?? []) {
    if (!isAggregateMeasure(measure)) {
      required.add(`measure.${measure.kind}`);
      continue;
    }
    required.add('measure.aggregate');
    if (measure.filter && measure.filter.length > 0) required.add('measure.filter');
    if (measure.distinct === true) required.add('measure.distinct');
  }

  required.add(`shape.${spec.shape.kind}`);
  // A lista AGRUPADA é um token próprio, e não `shape.tabular` sozinho: um kernel que só saiba a
  // lista corrida precisa dizer que a quebra em grupos se perdeu. Sem o token ele desenharia a lista
  // toda corrida, com o total certo — e nada na tela dizendo que os grupos sumiram.
  if (spec.shape.kind === 'tabular' && (spec.shape.groupBy ?? []).length > 0) {
    required.add('shape.tabular.group');
    if (anySubtotal(spec.shape.groupBy ?? [])) required.add('shape.subtotal');
  }
  if (spec.shape.kind === 'summary' && anySubtotal(spec.shape.groupBy)) required.add('shape.subtotal');
  if (spec.shape.kind === 'matrix'
    && (anySubtotal(spec.shape.rows) || anySubtotal(spec.shape.columns))) {
    required.add('shape.subtotal');
  }

  if ('limit' in spec.shape && spec.shape.limit !== undefined) required.add('shape.limit');

  if (spec.presentation?.chart) required.add('presentation.chart');
  if (spec.presentation?.chart?.splitBy !== undefined) required.add('presentation.chart.split');
  if ((spec.presentation?.prompts ?? []).length > 0) required.add('presentation.prompt');

  for (const prompt of spec.presentation?.prompts ?? []) {
    if (prompt.control !== undefined) required.add('presentation.prompt.control');
    if (prompt.required === true) required.add('presentation.prompt.required');
    if (prompt.default !== undefined) required.add('presentation.prompt.default');
  }

  if (Object.keys(spec.presentation?.fields ?? {}).length > 0) required.add('presentation.fields');
  if (spec.presentation?.drillDown?.enabled === true) required.add('presentation.drilldown');
  if (spec.presentation?.export?.csv) required.add('export.csv');
  if (spec.presentation?.export?.pdf) required.add('export.pdf');
  if (spec.presentation?.export?.fileName !== undefined) required.add('export.filename');
  if (spec.schedule) required.add('schedule');

  return [...required].sort();
};

/**
 * Os prefixos cuja ausência RECUSA o relatório. Todo o resto degrada com aviso.
 *
 * A linha é a mesma que separa as camadas: `dataset` e `measure` são a verdade do NÚMERO — somar sem
 * uma medida devolve um número diferente com o mesmo rótulo, e o leitor não tem como notar. Uma
 * dobra, um gráfico ou um balde que faltem tiram algo que se VÊ faltar.
 *
 * Esta é a regra inteira, e ela é derivada da POSIÇÃO — não uma tabela mantida à mão. Uma exceção
 * que dissesse "capacidade desconhecida sempre recusa" tornaria a degradação de `shape` código
 * morto: nenhuma dobra nova jamais chegaria a degradar, porque o token dela recusaria antes.
 */
const REFUSING_CAPABILITY_PREFIXES = ['dataset.', 'measure.'];

export const reportCapabilitySeverity = (capability: string): 'error' | 'warning' =>
  REFUSING_CAPABILITY_PREFIXES.some((prefix) => capability.startsWith(prefix)) ? 'error' : 'warning';

/** O que o relatório pede e este kernel não sabe fazer. Vazio = executável aqui. */
export const unsupportedReportCapabilities = (
  spec: ReportSpec,
  capabilities: readonly string[] = REPORT_CAPABILITIES,
): string[] => {
  const known = new Set(capabilities);
  const asked = spec.requires && spec.requires.length > 0
    ? spec.requires
    : deriveReportRequires(spec);
  return asked.filter((capability) => !known.has(capability));
};
