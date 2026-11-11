import { useCallback, useEffect, useMemo, useState } from 'react';
import { withArtifactPrefix } from '../../../domain/schema/plugin/artifactPrefix';
import { useArtifactPrefix } from '../../shared/settings/useArtifactPrefix';
import { useNotification } from '../../../stores/useNotification';
import { useReportDefinitions } from '../../../stores/useReportDefinitions';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useSchemaContext } from '../../shared/useSchemaContext';
import { useLabel, useT } from '../../shared/i18n/useT';
import { useReportPathOptions } from '../../shared/report/useReportPathOptions';
import type { ReportPathOption } from '../../shared/report/useReportPathOptions';
import { useReportValueLabel } from '../../shared/report/useReportValueLabel';
import { reportExpressionVariables } from '../../shared/report/reportExpressionVariables';
import {
  filterLiteralOf,
  filterTextOf,
  filterValueOf,
} from '../../shared/report/reportFilterFields';
import { screenDataCollection } from '../../../domain/services/screenDataCollection';
import { parseReportDesignTabKey } from '../../../shared/constants/reportKeys';
import { useAuthorization } from '../../../stores/useAuthorization';
import { REPORT_PERIODS, REPORT_PROMPT_PERIOD_CONTROL } from '../../../domain/schema/report/reportPeriod';

/** A lista, para onde a autoria volta depois de excluir. */
const REPORT_DESIGN_RETURN_TAB = 'reports';
import {
  REPORT_CHART_KINDS,
  REPORT_GRANULARITIES,
  REPORT_HIGHLIGHT_OPS,
  REPORT_HIGHLIGHT_TONES,
  REPORT_SPEC_VERSION,
  isAggregateMeasure,
} from '../../../domain/schema/report/reportSpec';
import { QUERY_OPERATORS } from '../../../domain/schema/querySpec';
import type { QueryOperator, QueryPredicate } from '../../../domain/schema/querySpec';
import type {
  ReportDimension,
  ReportGranularity,
  ReportHighlight,
  ReportHighlightOp,
  ReportHighlightTone,
  ReportMeasure,
  ReportPresentation,
  ReportPrompt,
  ReportShape,
  ReportSpec,
  ReportTabularShape,
} from '../../../domain/schema/report/reportSpec';
import { hasBlockingReportIssue, validateReportSpec } from '../../../domain/schema/report/validateReportSpec';
import type { ReportResult } from '../../../domain/schema/report/reportResult';
import { NUMERIC_AGGREGATION_OPS, type NumericAggregationOp } from '../../../domain/schema/fieldRules';
import type { WorkflowVariable } from '../../components/ui/ExpressionEditor/autocompleteHelpers';
import type { CustomFieldValue, FieldDefinition } from '../../../domain/entities/entitySchemas';
import type { ReportDefinition } from '../../../domain/entities/Report';
import { errorParamsOf } from '../../../domain/errors/LocalizedError';

export type ReportShapeKindChoice = 'tabular' | 'summary' | 'matrix';

/**
 * Um agrupamento como a TELA o mostra.
 *
 * A ORDEM importa — ela é a ordem dos níveis do resumo e a das colunas da lista simples —, e é por
 * isso que cada item carrega se pode subir e se pode descer: sem os dois, a tela teria de contar a
 * posição de novo, e um botão habilitado no primeiro item é um gesto que não faz nada.
 *
 * `isDate` é o que decide se há modelo de apresentação a escolher, e ele vem do CAMPO — não de já
 * haver um corte escolhido. Enquanto vinha do corte, escolher "Valor exato" fazia o seletor sumir:
 * a pessoa perdia o caminho de volta para "Por mês" sem nada dizer por quê.
 */
export interface ReportDesignDimension {
  key: string;
  label: string;
  granularity: ReportGranularity | '';
  isDate: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  /**
   * O campo agrupa (é nível ou coluna do pivô). Só aí ordem, limite e "Outros" significam algo: num
   * campo que só aparece como coluna da lista, eles não teriam o que ordenar.
   */
  isGroup: boolean;
  /** A ordem escolhida, codificada para o seletor (`sortValueOf`). */
  sortValue: string;
  limit: string;
  others: boolean;
}

/** Uma medida como a TELA a mostra: o que ela é e como é exibida. */
export interface ReportDesignMeasure {
  key: string;
  label: string;
  /** O que a medida calcula, numa linha — a expressão de uma calculada, nada numa agregada. */
  detail: string;
  formatKind: string;
  decimals: string;
}

/** Um filtro do leitor como a TELA o mostra. */
export interface ReportDesignPrompt {
  key: string;
  label: string;
  op: string;
  required: boolean;
  isPeriod: boolean;
  /** O período inicial de um filtro de período; vazio = nenhum. */
  periodDefault: string;
}

/** O operador do filtro do leitor, ou o controle de PERÍODO — que é escolhido no mesmo seletor. */
export type ReportPromptChoice = QueryOperator | typeof REPORT_PROMPT_PERIOD_CONTROL;

/** Os formatos que a autoria oferece — os que a tela sabe desenhar. */
const DESIGN_FORMAT_KINDS = ['number', 'integer', 'currency', 'percent'] as const;

/**
 * A ordem de um nível, codificada para UM seletor: `key:asc`, `key:desc`, `m:<medida>:desc`…
 *
 * Um seletor só, e não dois (critério e direção), porque a pergunta que a pessoa faz é uma —
 * "maiores primeiro" — e dois seletores a obrigariam a montá-la de peças.
 */
export const sortValueOf = (dimension: ReportDimension): string => {
  const dir = dimension.sort?.dir === 'desc' ? 'desc' : 'asc';
  const by = dimension.sort?.by;
  return by && by !== 'key' ? `m:${by}:${dir}` : `key:${dir}`;
};

/** O inverso de `sortValueOf`: a dimensão com a ordem escolhida — e sem `sort` no padrão. */
export const withSortValue = (dimension: ReportDimension, value: string): ReportDimension => {
  const next: ReportDimension = { ...dimension };
  delete next.sort;
  if (value === 'key:asc' || value === '') return next;
  if (value === 'key:desc') return { ...next, sort: { dir: 'desc' } };
  const match = /^m:(.+):(asc|desc)$/.exec(value);
  return match ? { ...next, sort: { by: match[1], dir: match[2] as 'asc' | 'desc' } } : next;
};

/**
 * O limite e o "Outros" de uma dimensão, sem chave vazia: o `spec` é gravado verbatim, e `limit: 0`
 * ou `others: false` seriam capacidades declaradas que o relatório não usa.
 */
export const withLimit = (dimension: ReportDimension, limit: string, others: boolean): ReportDimension => {
  const next: ReportDimension = { ...dimension };
  delete next.limit;
  delete next.others;
  const parsed = Number.parseInt(limit, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return next;
  return { ...next, limit: parsed, ...(others ? { others: true } : {}) };
};

/**
 * O RASCUNHO — tudo o que a tela edita, num objeto só.
 *
 * Um objeto, e não seis estados, porque o formulário precisa nascer PREENCHIDO quando se está
 * editando um relatório que já existe. Com estados separados, semear exigiria um efeito que chama
 * `setState` — o que o React Compiler recusa, e com razão: o valor semeado é DERIVADO do relatório
 * carregado, e derivar é mais simples que sincronizar. Aqui o rascunho é a sobreposição do que a
 * pessoa mexeu sobre o que o relatório já dizia.
 */
interface ReportDraft {
  table: string;
  title: string;
  dimensions: ReportDimension[];
  measures: ReportMeasure[];
  shapeKind: ReportShapeKindChoice;
  columnDimension: string;
  /**
   * Os campos que REÚNEM as linhas, do nível mais externo ao mais interno. Vazio = nada agrupa.
   *
   * Um só para as três dobras, e essa unificação é a correção: enquanto o resumo e o pivô comiam a
   * lista INTEIRA de campos como níveis, escolher dez campos para ver como colunas dava dez níveis
   * de recuo numa coluna só — uma linha por coluna, que não é resumo nenhum. Agrupar e mostrar
   * passaram a ser duas perguntas, e cada dobra responde a mesma pergunta do seu jeito.
   */
  groupDimensions: string[];
  /** O filtro FIXO: vale sempre, e quem lê o relatório não o vê nem o muda. */
  filters: QueryPredicate[];
  /** A pergunta feita sobre a LINHA. Vazio = nada a mais do que os predicados já dizem. */
  filterExpression: string;
  /** Vazio = sem gráfico. A tabela sozinha é um relatório legítimo. */
  chartKind: string;
  chartCategory: string;
  chartSeries: string[];
  /** Vazio = sem quebra: uma série por medida. */
  chartSplitBy: string;
  chartStacked: boolean;
  /** Os filtros que o LEITOR preenche ao abrir. */
  prompts: ReportPrompt[];
  highlights: ReportHighlight[];
  /** O total geral do resumo e do pivô. Ligado é o padrão do contrato. */
  grandTotal: boolean;
  /** Vazio = o padrão (o valor calculado). */
  emptyCell: '' | 'blank' | 'zero';
  /** Texto, porque é o que o campo edita; vazio = o teto da instalação. */
  scanLimit: string;
  /** A permissão PRÓPRIA (`access.permission`); vazio = nenhuma. */
  permission: string;
}

export interface ReportDesignViewModel {
  title: string;
  /** Editando um relatório que já existe, em vez de criando. */
  isEditing: boolean;
  editingNotice: string | null;
  /**
   * A aba pede um relatório que não existe.
   *
   * Sem isto a tela abria o formulário de CRIAR, em branco e calada — e quem clicou em Editar via
   * uma tela vazia sem nada dizendo que o relatório não foi achado. Um formulário vazio no lugar de
   * um erro é o pior tipo de silêncio: parece que a tela quebrou.
   */
  notFound: string | null;
  /** O relatório de PACOTE é somente-leitura: um spec não se mescla — duplica-se para editar. */
  isManaged: boolean;

  tableOptions: { value: string; label: string }[];
  table: string;
  setTable: (table: string) => void;

  reportTitle: string;
  setReportTitle: (value: string) => void;

  pathOptions: ReportPathOption[];

  dimensions: ReportDesignDimension[];
  addDimension: (path: string) => void;
  removeDimension: (key: string) => void;
  setGranularity: (key: string, granularity: ReportGranularity | undefined) => void;
  /** A reordenação pelos botões — o mesmo gesto do Form Design, e o que funciona sem mouse. */
  moveDimension: (key: string, direction: -1 | 1) => void;
  draggedDimension: string | null;
  dragOverDimension: string | null;
  startDragDimension: (key: string) => void;
  dragOverDimensionAt: (key: string) => void;
  endDragDimension: () => void;
  dropDimension: (targetKey: string) => void;

  measures: ReportDesignMeasure[];
  setMeasureFormat: (key: string, kind: string) => void;
  setMeasureDecimals: (key: string, decimals: string) => void;
  formatOptions: { value: string; label: string }[];
  /** Os campos que uma contagem DISTINTA pode contar — qualquer um, não só os numéricos. */
  distinctOptions: { value: string; label: string }[];
  computedName: string;
  setComputedName: (value: string) => void;
  computedExpression: string;
  setComputedExpression: (value: string) => void;
  /** As medidas que a expressão de uma calculada pode citar, pela chave. */
  measureVariables: WorkflowVariable[];
  addComputed: () => void;
  canAddComputed: boolean;
  setDimensionSort: (key: string, value: string) => void;
  setDimensionLimit: (key: string, limit: string) => void;
  setDimensionOthers: (key: string, others: boolean) => void;
  sortOptions: { value: string; label: string }[];
  grandTotal: boolean;
  setGrandTotal: (value: boolean) => void;
  emptyCell: string;
  setEmptyCell: (value: string) => void;
  emptyCellOptions: { value: string; label: string }[];
  scanLimit: string;
  setScanLimit: (value: string) => void;
  permission: string;
  setPermission: (value: string) => void;
  permissionOptions: { value: string; label: string }[];
  highlights: { label: string }[];
  highlightMeasure: string;
  setHighlightMeasure: (key: string) => void;
  highlightOp: ReportHighlightOp;
  setHighlightOp: (op: ReportHighlightOp) => void;
  highlightValue: string;
  setHighlightValue: (value: string) => void;
  highlightTone: ReportHighlightTone;
  setHighlightTone: (tone: ReportHighlightTone) => void;
  addHighlight: () => void;
  canAddHighlight: boolean;
  removeHighlight: (index: number) => void;
  measureOp: NumericAggregationOp;
  setMeasureOp: (op: NumericAggregationOp) => void;
  measurePath: string;
  setMeasurePath: (path: string) => void;
  addMeasure: () => void;
  canAddMeasure: boolean;
  removeMeasure: (key: string) => void;

  shapeKind: ReportShapeKindChoice;
  setShapeKind: (kind: ReportShapeKindChoice) => void;
  columnDimension: string;
  setColumnDimension: (key: string) => void;
  groupDimensions: string[];
  setGroupDimensions: (keys: string[]) => void;

  filters: { label: string; op: string; value: string }[];
  filterPath: string;
  setFilterPath: (path: string) => void;
  filterOp: QueryOperator;
  setFilterOp: (op: QueryOperator) => void;
  /**
   * O valor do filtro NO FORMATO DO CAMPO — é ele que o controle do schema recebe. A data chega como
   * data, o booleano como booleano, a referência como o id do registro apontado.
   */
  filterValue: CustomFieldValue;
  setFilterValue: (value: CustomFieldValue) => void;
  /** O campo escolhido, visto como valor de filtro. Ausente enquanto nenhum caminho foi escolhido. */
  filterField: FieldDefinition | undefined;
  filterNeedsValue: boolean;
  addFilter: () => void;
  canAddFilter: boolean;
  removeFilter: (index: number) => void;

  /**
   * O filtro por EXPRESSÃO, e as variáveis que o editor oferece.
   *
   * As variáveis saem dos MESMOS caminhos que os seletores de campo oferecem — um salto de
   * referência —, para que a expressão fale do dado com o mesmo nome que a tela acabou de mostrar. Um
   * campo de referência entra pelo apontado (`cliente.id`), e não pelo caminho cru: a hidratação
   * troca o id pelo registro, e comparar o caminho cru com um id nunca acharia nada.
   */
  filterExpression: string;
  setFilterExpression: (expression: string) => void;
  expressionVariables: WorkflowVariable[];

  chartKind: string;
  setChartKind: (kind: string) => void;
  chartCategory: string;
  setChartCategory: (key: string) => void;
  chartSeries: string[];
  setChartSeries: (keys: string[]) => void;
  chartSplitBy: string;
  setChartSplitBy: (key: string) => void;
  chartSplitOptions: { value: string; label: string }[];
  chartStacked: boolean;
  setChartStacked: (stacked: boolean) => void;

  prompts: ReportDesignPrompt[];
  promptPath: string;
  setPromptPath: (path: string) => void;
  promptOp: ReportPromptChoice;
  setPromptOp: (op: ReportPromptChoice) => void;
  /** Os operadores do filtro do leitor — e "perguntar um período" quando o campo é data. */
  promptOpOptions: { value: ReportPromptChoice; label: string }[];
  setPromptRequired: (key: string, required: boolean) => void;
  setPromptPeriodDefault: (key: string, period: string) => void;
  periodOptions: { value: string; label: string }[];
  addPrompt: () => void;
  canAddPrompt: boolean;
  removePrompt: (key: string) => void;

  spec: ReportSpec;
  errors: string[];
  warnings: string[];
  canSave: boolean;

  preview: ReportResult | null;
  isPreviewing: boolean;
  previewError: string | null;
  runPreview: () => Promise<void>;

  save: () => Promise<void>;
  isSaving: boolean;

  canDelete: boolean;
  isConfirmingDelete: boolean;
  askDelete: () => void;
  cancelDelete: () => void;
  confirmDelete: () => Promise<void>;
  isDeleting: boolean;

  labels: {
    table: string;
    reportTitle: string;
    dimensions: string;
    dimensionsHint: string;
    measures: string;
    measuresHint: string;
    shape: string;
    columnDimension: string;
    group: string;
    groupHint: string;
    noGroup: string;
    add: string;
    remove: string;
    reorder: string;
    moveUp: string;
    moveDown: string;
    preview: string;
    save: string;
    noGranularity: string;
    measureOp: string;
    measureField: string;
    filters: string;
    filtersHint: string;
    expressionFilter: string;
    expressionFilterHint: string;
    expressionFilterPlaceholder: string;
    chart: string;
    chartHint: string;
    chartCategory: string;
    chartSeries: string;
    chartSplit: string;
    chartStacked: string;
    noChart: string;
    prompts: string;
    promptsHint: string;
    computed: string;
    computedHint: string;
    computedName: string;
    computedPlaceholder: string;
    format: string;
    decimals: string;
    distinctField: string;
    sort: string;
    limit: string;
    limitPlaceholder: string;
    others: string;
    grandTotal: string;
    emptyCell: string;
    scanLimit: string;
    scanLimitPlaceholder: string;
    permission: string;
    permissionHint: string;
    highlight: string;
    highlightHint: string;
    highlightValue: string;
    promptRequired: string;
    promptDefault: string;
    opHighlightOptions: { value: ReportHighlightOp; label: string }[];
    toneOptions: { value: ReportHighlightTone; label: string }[];
    chartOptions: { value: string; label: string }[];
    operatorOptions: { value: QueryOperator; label: string }[];
    deleteAction: string;
    deleteConfirm: string;
    shapeOptions: { value: ReportShapeKindChoice; label: string }[];
    opOptions: { value: NumericAggregationOp; label: string }[];
    granularityOptions: { value: string; label: string }[];
  };
}

/** `exists` não pede valor — pedir um faria a tela cobrar o que o operador ignora. */
const OPS_WITHOUT_VALUE: QueryOperator[] = ['exists'];

export const operatorNeedsValue = (op: QueryOperator): boolean => !OPS_WITHOUT_VALUE.includes(op);

/**
 * A chave da medida de CONTAGEM.
 *
 * Constante porque ela é identificador: `contagem` foi gravado numa versão e é palavra nossa dentro
 * de uma chave — o que viaja no `.json` e o que a dobra referencia. O rótulo traduz; a chave, não.
 */
export const MEASURE_COUNT_KEY = 'count';

/**
 * O texto reduzido a um identificador. Pode sair VAZIO — o padrão é de quem chama.
 *
 * Um padrão aqui vazaria o nome interno de um chamador para o outro: a chave de um relatório sem
 * letra nem número saía `campo`, que é o fallback de um caminho de campo.
 */
const slug = (value: string): string =>
  value.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

/** A chave de uma dimensão ou medida, derivada do caminho — legível e única no spec. */
const keyFromPath = (path: string, taken: Set<string>, suffix = ''): string => {
  const base = `${slug(path) || 'field'}${suffix}`;
  let key = base;
  let index = 2;
  while (taken.has(key)) { key = `${base}_${index}`; index += 1; }
  return key;
};

/**
 * O corte de data de um agrupamento — e "Valor exato" REMOVE a chave, nunca a grava `undefined`.
 *
 * O `spec` é gravado verbatim, e um `undefined` dentro dele derruba a gravação inteira:
 * `Unsupported field value: undefined`, dito com o texto do SDK sobre um documento que quem estava
 * desenhando o relatório nunca viu.
 */
export const withGranularity = (
  dimensions: ReportDimension[],
  key: string,
  granularity: ReportGranularity | undefined,
): ReportDimension[] => dimensions.map((one) => {
  if (one.key !== key) return one;
  const next: ReportDimension = { ...one };
  delete next.granularity;
  return granularity ? { ...next, granularity } : next;
});

/**
 * A lista de agrupamentos com `key` movido para `targetIndex`. Fora da lista, `null` — nada muda.
 *
 * A ORDEM é o relatório: ela é a ordem dos níveis do resumo e a das colunas da lista simples. Sem
 * reordenar, a única forma de trocar dois agrupamentos de lugar era remover os dois e declará-los
 * de novo, na ordem certa.
 */
export const movedDimensions = (
  dimensions: ReportDimension[],
  key: string,
  targetIndex: number,
): ReportDimension[] | null => {
  const order = [...dimensions];
  const index = order.findIndex((one) => one.key === key);
  if (index < 0 || targetIndex < 0 || targetIndex >= order.length) return null;
  const [moved] = order.splice(index, 1);
  order.splice(targetIndex, 0, moved);
  return order;
};

/**
 * A dobra de LISTA que a tela declara — as colunas, e a quebra em grupos quando há uma.
 *
 * Pura e exportada porque é a decisão que resolveu o defeito: o campo que agrupa SAI das colunas.
 * Repeti-lo em toda linha de detalhe é escrever o mesmo valor debaixo da faixa que acabou de o
 * dizer, e um teste sobre um hook inteiro não guardaria essa linha.
 */
export const tabularShapeOf = (
  dimensionKeys: string[],
  groupKeys: string[],
): ReportTabularShape => ({
  kind: 'tabular',
  columns: dimensionKeys.filter((key) => !groupKeys.includes(key)),
  // Todo nível subtotaliza: o total do grupo é a pergunta que o agrupou, e um nível que abre sem
  // fechar deixa quem lê somando de cabeça o que a máquina já sabia.
  ...(groupKeys.length > 0
    ? { groupBy: groupKeys.map((dimension) => ({ dimension, subtotal: true })) }
    : {}),
});

/**
 * A chave do DOCUMENTO, única entre os relatórios que já existem.
 *
 * Sem isto, salvar dois relatórios de nome parecido devolvia `artifact.id-taken` — uma recusa
 * correta do repositório e inútil para quem só quis dar o mesmo nome de novo.
 */
export const uniqueReportKey = (title: string, taken: Set<string>, prefix: string | null = null): string => {
  const base = withArtifactPrefix(prefix, 'artifact', slug(title.trim().toLowerCase()).slice(0, 60) || 'report');
  let key = base;
  let index = 2;
  while (taken.has(key)) { key = `${base}_${index}`; index += 1; }
  return key;
};

const shapeKindOf = (spec: ReportSpec): ReportShapeKindChoice => spec.shape.kind;

const columnDimensionOf = (spec: ReportSpec): string =>
  spec.shape.kind === 'matrix' ? (spec.shape.columns[0]?.dimension ?? '') : '';

/**
 * Os níveis que a dobra gravada agrupa nas LINHAS — a leitura única das três.
 *
 * O pivô devolve só as linhas dele: a dimensão de coluna tem seletor próprio, e trazê-la para cá
 * faria o mesmo campo aparecer nos dois lugares.
 */
const groupDimensionsOf = (spec: ReportSpec): string[] => {
  if (spec.shape.kind === 'summary') return spec.shape.groupBy.map((level) => level.dimension);
  if (spec.shape.kind === 'matrix') return spec.shape.rows.map((level) => level.dimension);
  return (spec.shape.groupBy ?? []).map((level) => level.dimension);
};

/**
 * A autoria de um relatório — criando um novo ou editando um que já existe.
 *
 * O spec é DERIVADO do rascunho a cada render, e é ele que a pré-visualização manda ao servidor: a
 * mesma função que valida aqui valida lá, então não existe relatório que a tela aceita e a execução
 * recusa.
 */
export const useReportDesignViewModel = (tabKey: string): ReportDesignViewModel => {
  const t = useT('core.reports');
  const label = useLabel();
  const schema = useSchemaContext();
  const { dynamicScreens } = useScreenDefinitions();
  const {
    reports, isLoading, getReport, createReport, updateReport, deleteReport, runReport,
  } = useReportDefinitions();
  const { notify } = useNotification();
  const { openTab, setTabTitle } = useWorkspace();

  const editingKey = useMemo(() => parseReportDesignTabKey(tabKey), [tabKey]);
  /**
   * O relatório que ESTA aba acabou de criar.
   *
   * A aba de criar não leva chave no nome, então `editing` seguia vazio depois da primeira gravação
   * e o segundo Salvar criava um SEGUNDO relatório — e o terceiro, um terceiro. Quem salva de novo
   * sem sair da tela está editando o que acabou de gravar, e é a tela que precisa saber disso: o
   * repositório só vê dois pedidos de criar.
   */
  const [createdReport, setCreatedReport] = useState<ReportDefinition | null>(null);
  const openKey = editingKey ?? createdReport?.key ?? null;
  // O documento do STORE é o mais fresco; o devolvido pela criação cobre o intervalo até a assinatura
  // trazê-lo — e é nesse intervalo que um segundo Salvar criaria a cópia.
  const editing = (openKey ? getReport(openKey) : undefined)
    ?? (editingKey === null ? createdReport ?? undefined : undefined);

  const tableOptions = useMemo(
    () => dynamicScreens.map((screen) => ({
      value: screenDataCollection(screen),
      label: label(screen.titlePlural || screen.titleSingular),
    })),
    [dynamicScreens, label],
  );

  /** O rascunho SEMEADO: o relatório carregado, ou um em branco sobre a primeira coleção. */
  const seeded = useMemo<ReportDraft>(() => (editing
    ? {
        table: editing.spec.dataset.table,
        title: label(editing.title),
        dimensions: editing.spec.dataset.dimensions ?? [],
        measures: editing.spec.dataset.measures ?? [],
        shapeKind: shapeKindOf(editing.spec),
        columnDimension: columnDimensionOf(editing.spec),
        groupDimensions: groupDimensionsOf(editing.spec),
        filters: editing.spec.dataset.where ?? [],
        filterExpression: editing.spec.dataset.includeWhen ?? '',
        chartKind: editing.spec.presentation?.chart?.kind ?? '',
        chartCategory: editing.spec.presentation?.chart?.category ?? '',
        chartSeries: editing.spec.presentation?.chart?.series ?? [],
        chartSplitBy: editing.spec.presentation?.chart?.splitBy ?? '',
        chartStacked: editing.spec.presentation?.chart?.stacked === true,
        prompts: editing.spec.presentation?.prompts ?? [],
        highlights: editing.spec.presentation?.highlight ?? [],
        grandTotal: !('grandTotal' in editing.spec.shape) || editing.spec.shape.grandTotal !== false,
        emptyCell: editing.spec.shape.kind === 'matrix' ? (editing.spec.shape.emptyCell ?? '') : '',
        scanLimit: editing.spec.dataset.scanLimit !== undefined ? String(editing.spec.dataset.scanLimit) : '',
        permission: editing.spec.access?.permission ?? '',
      }
    : {
        table: tableOptions[0]?.value ?? '',
        title: '',
        dimensions: [],
        measures: [],
        // A LISTA é o padrão: é a dobra cujo resultado se explica sozinho — uma linha por registro,
        // uma coluna por campo. O resumo continua a um clique, e agora diz na etiqueta que troca os
        // registros pelos totais.
        shapeKind: 'tabular',
        columnDimension: '',
        groupDimensions: [],
        filters: [],
        filterExpression: '',
        chartKind: '',
        chartCategory: '',
        chartSeries: [],
        chartSplitBy: '',
        chartStacked: false,
        prompts: [],
        highlights: [],
        grandTotal: true,
        emptyCell: '',
        scanLimit: '',
        permission: '',
      }), [editing, label, tableOptions]);

  const [touched, setTouched] = useState<ReportDraft | null>(null);
  const draft = touched ?? seeded;

  const [measureOp, setMeasureOp] = useState<NumericAggregationOp>('count');
  const [measurePath, setMeasurePath] = useState('');
  const [filterPath, setFilterPath] = useState('');
  const [filterOp, setFilterOp] = useState<QueryOperator>('eq');
  const [filterText, setFilterText] = useState('');
  const [promptPath, setPromptPath] = useState('');
  const [promptOp, setPromptOp] = useState<ReportPromptChoice>('eq');
  const [computedName, setComputedName] = useState('');
  const [computedExpression, setComputedExpression] = useState('');
  const [highlightMeasure, setHighlightMeasure] = useState('');
  const [highlightOp, setHighlightOp] = useState<ReportHighlightOp>('lt');
  const [highlightValue, setHighlightValue] = useState('');
  const [highlightTone, setHighlightTone] = useState<ReportHighlightTone>('negative');
  const [draggedDimension, setDraggedDimension] = useState<string | null>(null);
  const [dragOverDimension, setDragOverDimension] = useState<string | null>(null);
  const [preview, setPreview] = useState<ReportResult | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const pathOptions = useReportPathOptions(draft.table);
  const valueLabel = useReportValueLabel(pathOptions);

  /** O campo do caminho escolhido — é ele que decide o CONTROLE com que o valor é informado. */
  const filterField = useMemo(
    () => pathOptions.find((one) => one.value === filterPath)?.field,
    [pathOptions, filterPath],
  );

  // Trocar o campo descarta o valor: o que foi informado responde ao tipo ANTERIOR, e a data de um
  // filtro trocado por uma lista entraria nela como uma opção que não existe.
  const chooseFilterPath = useCallback((path: string) => {
    setFilterPath(path);
    setFilterText('');
  }, []);

  const setFilterValue = useCallback(
    (value: CustomFieldValue) => setFilterText(filterTextOf(value)),
    [],
  );

  // A aba se chama como o relatório que se está editando, pelo mesmo motivo da aba de leitura.
  useEffect(() => {
    if (editing) setTabTitle(tabKey, label(editing.title));
  }, [editing, tabKey, setTabTitle, label]);
  const isManaged = editing?.managed === true;

  const change = useCallback(
    (patch: Partial<ReportDraft>) => setTouched((current) => ({ ...(current ?? seeded), ...patch })),
    [seeded],
  );

  // Trocar a coleção descarta agrupamentos e números: eles apontam para campos que a coleção nova
  // não tem, e manter o que sobrou daria um relatório meio certo — o pior resultado possível.
  const setTable = useCallback((table: string) => {
    change({
      table,
      dimensions: [],
      measures: [],
      columnDimension: '',
      groupDimensions: [],
      filters: [],
      filterExpression: '',
      chartKind: '',
      chartCategory: '',
      chartSeries: [],
      chartSplitBy: '',
      prompts: [],
      highlights: [],
    });
    setFilterPath('');
    setFilterText('');
    setPreview(null);
  }, [change]);

  const setReportTitle = useCallback((title: string) => change({ title }), [change]);

  const addDimension = useCallback((path: string) => {
    if (!path) return;
    const taken = new Set([...draft.dimensions, ...draft.measures].map((one) => one.key));
    const option = pathOptions.find((one) => one.value === path);
    change({
      dimensions: [...draft.dimensions, {
        key: keyFromPath(path, taken),
        path,
        label: option?.label,
        ...(option?.isDate ? { granularity: 'month' as const } : {}),
      }],
    });
  }, [draft, pathOptions, change]);

  const patchDimension = useCallback((key: string, patch: (one: ReportDimension) => ReportDimension) => {
    change({ dimensions: draft.dimensions.map((one) => (one.key === key ? patch(one) : one)) });
  }, [draft, change]);

  const setDimensionSort = useCallback(
    (key: string, value: string) => patchDimension(key, (one) => withSortValue(one, value)),
    [patchDimension],
  );

  const setDimensionLimit = useCallback(
    (key: string, limit: string) => patchDimension(key, (one) => withLimit(one, limit, one.others === true)),
    [patchDimension],
  );

  const setDimensionOthers = useCallback(
    (key: string, others: boolean) =>
      patchDimension(key, (one) => withLimit(one, one.limit !== undefined ? String(one.limit) : '', others)),
    [patchDimension],
  );

  const removeDimension = useCallback((key: string) => {
    change({
      dimensions: draft.dimensions.filter((one) => one.key !== key),
      columnDimension: draft.columnDimension === key ? '' : draft.columnDimension,
      groupDimensions: draft.groupDimensions.filter((one) => one !== key),
      chartCategory: draft.chartCategory === key ? '' : draft.chartCategory,
      chartSplitBy: draft.chartSplitBy === key ? '' : draft.chartSplitBy,
    });
  }, [draft, change]);

  const setGranularity = useCallback((key: string, granularity: ReportGranularity | undefined) => {
    change({ dimensions: withGranularity(draft.dimensions, key, granularity) });
  }, [draft, change]);

  const moveDimension = useCallback((key: string, direction: -1 | 1) => {
    const index = draft.dimensions.findIndex((one) => one.key === key);
    const order = index < 0 ? null : movedDimensions(draft.dimensions, key, index + direction);
    if (order) change({ dimensions: order });
  }, [draft, change]);

  const startDragDimension = useCallback((key: string) => setDraggedDimension(key), []);

  const dragOverDimensionAt = useCallback(
    (key: string) => setDragOverDimension((current) => (current === key ? current : key)),
    [],
  );

  const endDragDimension = useCallback(() => {
    setDraggedDimension(null);
    setDragOverDimension(null);
  }, []);

  const dropDimension = useCallback((targetKey: string) => {
    const sourceKey = draggedDimension;
    setDraggedDimension(null);
    setDragOverDimension(null);
    if (!sourceKey || sourceKey === targetKey) return;
    const targetIndex = draft.dimensions.findIndex((one) => one.key === targetKey);
    const order = targetIndex < 0 ? null : movedDimensions(draft.dimensions, sourceKey, targetIndex);
    if (order) change({ dimensions: order });
  }, [draggedDimension, draft, change]);

  const addMeasure = useCallback(() => {
    if (measureOp !== 'count' && !measurePath) return;
    const taken = new Set([...draft.dimensions, ...draft.measures].map((one) => one.key));
    const option = pathOptions.find((one) => one.value === measurePath);
    // A chave é IDENTIFICADOR, e identificador é em inglês — ela não se traduz, e é ela que aparece
    // no `.json` de um relatório exportado e nas referências da dobra. O que traduz é o `label`.
    // A contagem com campo é a DISTINTA: "quantos clientes", e não "quantos lançamentos". Sem campo,
    // é a contagem de registros de sempre.
    const distinct = measureOp === 'count' && measurePath !== '';
    const key = measureOp === 'count'
      ? keyFromPath(distinct ? `${measurePath}_distinct` : MEASURE_COUNT_KEY, taken)
      : keyFromPath(measurePath, taken, `_${measureOp}`);

    change({
      measures: [...draft.measures, {
        key,
        op: measureOp,
        label: measureOp === 'count' && !distinct
          ? t('op.count')
          : `${t(`op.${measureOp}`)} — ${option?.label ?? measurePath}`,
        ...(measurePath !== '' ? { path: measurePath } : {}),
        ...(distinct ? { distinct: true } : {}),
      }],
    });
    setMeasurePath('');
  }, [measureOp, measurePath, draft, pathOptions, change, t]);

  const removeMeasure = useCallback((key: string) => {
    change({
      measures: draft.measures.filter((one) => one.key !== key),
      // O destaque e a ordem que citavam a medida saem junto: ficariam apontando para o que não existe,
      // e o aviso que isso gera falaria de um gesto que a pessoa já desfez.
      highlights: draft.highlights.filter((one) => one.measure !== key),
      dimensions: draft.dimensions.map((one) => (one.sort?.by === key ? withSortValue(one, '') : one)),
    });
  }, [draft, change]);

  const patchMeasure = useCallback((key: string, patch: (one: ReportMeasure) => ReportMeasure) => {
    change({ measures: draft.measures.map((one) => (one.key === key ? patch(one) : one)) });
  }, [draft, change]);

  const setMeasureFormat = useCallback((key: string, kind: string) => patchMeasure(key, (one) => {
    const next = { ...one };
    delete next.format;
    const decimals = one.format?.decimals;
    return kind === ''
      ? next
      : { ...next, format: { kind, ...(decimals !== undefined ? { decimals } : {}) } };
  }), [patchMeasure]);

  const setMeasureDecimals = useCallback((key: string, text: string) => patchMeasure(key, (one) => {
    const parsed = Number.parseInt(text, 10);
    const format = { ...(one.format ?? {}) };
    delete format.decimals;
    const nextFormat = Number.isFinite(parsed) && parsed >= 0 ? { ...format, decimals: Math.min(parsed, 6) } : format;
    const next = { ...one };
    delete next.format;
    return Object.keys(nextFormat).length > 0 ? { ...next, format: nextFormat } : next;
  }), [patchMeasure]);

  const addComputed = useCallback(() => {
    const name = computedName.trim();
    const expression = computedExpression.trim();
    if (name === '' || expression === '') return;
    const taken = new Set([...draft.dimensions, ...draft.measures].map((one) => one.key));
    change({
      measures: [...draft.measures, {
        key: keyFromPath(slug(name.toLowerCase()) || 'calc', taken),
        kind: 'computed',
        label: name,
        expression,
      }],
    });
    setComputedName('');
    setComputedExpression('');
  }, [computedName, computedExpression, draft, change]);

  const addHighlight = useCallback(() => {
    const value = Number(highlightValue.replace(',', '.'));
    if (!highlightMeasure || highlightValue.trim() === '' || !Number.isFinite(value)) return;
    change({
      highlights: [...draft.highlights, { measure: highlightMeasure, op: highlightOp, value, tone: highlightTone }],
    });
    setHighlightValue('');
  }, [highlightMeasure, highlightOp, highlightValue, highlightTone, draft, change]);

  const removeHighlight = useCallback((index: number) => {
    change({ highlights: draft.highlights.filter((_, at) => at !== index) });
  }, [draft, change]);

  const addFilter = useCallback(() => {
    if (!filterPath) return;
    if (operatorNeedsValue(filterOp) && filterText.trim() === '') return;
    change({
      filters: [...draft.filters, {
        path: filterPath,
        op: filterOp,
        // `Literal` porque é valor FIXO, escrito na autoria. O mesmo `resolveMapping` do resto do
        // caminho o resolve — não existe um segundo jeito de um valor chegar à consulta.
        // O valor vai NO TIPO DO CAMPO: um `eq` raso é resolvido pelo Firestore, e a string
        // "true" não encontra o booleano gravado no documento.
        ...(operatorNeedsValue(filterOp)
          ? { value: { kind: 'Literal' as const, value: filterLiteralOf(filterField, filterText.trim()) } }
          : {}),
      }],
    });
    setFilterText('');
  }, [filterPath, filterOp, filterText, filterField, draft, change]);

  const removeFilter = useCallback((index: number) => {
    change({ filters: draft.filters.filter((_, at) => at !== index) });
  }, [draft, change]);

  const addPrompt = useCallback(() => {
    if (!promptPath) return;
    const option = pathOptions.find((one) => one.value === promptPath);
    const taken = new Set(draft.prompts.map((one) => one.key));
    const isPeriod = promptOp === REPORT_PROMPT_PERIOD_CONTROL;
    change({
      prompts: [...draft.prompts, {
        key: keyFromPath(promptPath, taken, `_${promptOp}`),
        path: promptPath,
        // O período já É a comparação; `op` fica com o valor que um kernel que não conhece o controle
        // entenderia — "a partir de" —, o mais próximo do que o autor pediu.
        op: isPeriod ? 'gte' : promptOp,
        label: option?.label,
        ...(isPeriod ? { control: REPORT_PROMPT_PERIOD_CONTROL } : {}),
      }],
    });
  }, [promptPath, promptOp, pathOptions, draft, change]);

  const patchPrompt = useCallback((key: string, patch: (one: ReportPrompt) => ReportPrompt) => {
    change({ prompts: draft.prompts.map((one) => (one.key === key ? patch(one) : one)) });
  }, [draft, change]);

  const setPromptRequired = useCallback((key: string, required: boolean) => patchPrompt(key, (one) => {
    const next = { ...one };
    delete next.required;
    return required ? { ...next, required: true } : next;
  }), [patchPrompt]);

  const setPromptPeriodDefault = useCallback((key: string, period: string) => patchPrompt(key, (one) => {
    const next = { ...one };
    delete next.default;
    return period ? { ...next, default: { kind: 'Literal', value: period } } : next;
  }), [patchPrompt]);

  const removePrompt = useCallback((key: string) => {
    change({ prompts: draft.prompts.filter((one) => one.key !== key) });
  }, [draft, change]);

  const expressionVariables = useMemo<WorkflowVariable[]>(
    () => reportExpressionVariables(pathOptions, t('design.expression.record-id')),
    [pathOptions, t],
  );

  /**
   * O agrupamento com o que a TELA precisa saber sobre ele: se é data, e onde está na ordem.
   *
   * O `isDate` sai do CAMPO, e não de já haver corte escolhido — é o que devolve o caminho de volta
   * a quem escolheu "Valor exato" e viu o seletor desaparecer.
   */
  const designDimensions = useMemo<ReportDesignDimension[]>(
    () => draft.dimensions.map((dimension, index) => ({
      key: dimension.key,
      label: dimension.label ?? dimension.key,
      granularity: dimension.granularity ?? '',
      isDate: pathOptions.find((one) => one.value === dimension.path)?.isDate === true,
      canMoveUp: index > 0,
      canMoveDown: index < draft.dimensions.length - 1,
      isGroup: draft.groupDimensions.includes(dimension.key)
        || (draft.shapeKind === 'matrix' && draft.columnDimension === dimension.key),
      sortValue: sortValueOf(dimension),
      limit: dimension.limit !== undefined ? String(dimension.limit) : '',
      others: dimension.others === true,
    })),
    [draft, pathOptions],
  );

  const designMeasures = useMemo<ReportDesignMeasure[]>(
    () => draft.measures.map((measure) => ({
      key: measure.key,
      label: measure.label ? label(measure.label) : measure.key,
      detail: isAggregateMeasure(measure) ? '' : measure.expression,
      formatKind: measure.format?.kind ?? '',
      decimals: measure.format?.decimals !== undefined ? String(measure.format.decimals) : '',
    })),
    [draft, label],
  );

  const measureName = useCallback(
    (key: string): string => designMeasures.find((one) => one.key === key)?.label ?? key,
    [designMeasures],
  );

  const sortOptions = useMemo(
    () => [
      { value: 'key:asc', label: t('design.sort.key-asc') },
      { value: 'key:desc', label: t('design.sort.key-desc') },
      ...designMeasures.flatMap((measure) => [
        { value: `m:${measure.key}:desc`, label: t('design.sort.measure-desc', { measure: measure.label }) },
        { value: `m:${measure.key}:asc`, label: t('design.sort.measure-asc', { measure: measure.label }) },
      ]),
    ],
    [designMeasures, t],
  );

  const measureVariables = useMemo<WorkflowVariable[]>(
    () => designMeasures.map((measure) => ({ name: measure.key, definedBy: measure.label })),
    [designMeasures],
  );

  const { catalog: permissionCatalog } = useAuthorization();

  /** As permissões do escritório, com o nome QUALIFICADO — a ação sozinha não diz do quê. */
  const permissionOptions = useMemo(() => {
    const options = permissionCatalog.list.map((permission) => {
      const resource = permissionCatalog.resourceLabels.get(permission.resource);
      return {
        value: permission.id,
        label: label('@core.access/role.qualified-name', {
          action: label(permission.name),
          resource: resource ? label(resource.name, resource.nameParams) : permission.resource,
        }),
      };
    });
    // A permissão gravada que o catálogo não conhece mais continua visível — sumir com ela do seletor
    // seria removê-la na próxima gravação sem ninguém ter pedido.
    const stored = draft.permission;
    return [
      { value: '', label: t('design.permission.none') },
      ...options,
      ...(stored && !options.some((option) => option.value === stored) ? [{ value: stored, label: stored }] : []),
    ];
  }, [permissionCatalog, label, draft.permission, t]);

  const promptIsDate = pathOptions.find((one) => one.value === promptPath)?.isDate === true;
  const promptOpOptions = useMemo<{ value: ReportPromptChoice; label: string }[]>(
    () => [
      ...(promptIsDate ? [{ value: REPORT_PROMPT_PERIOD_CONTROL as ReportPromptChoice, label: t('design.prompt.period') }] : []),
      ...QUERY_OPERATORS.map((op) => ({ value: op as ReportPromptChoice, label: t(`operator.${op}`) })),
    ],
    [promptIsDate, t],
  );

  const periodOptions = useMemo(
    () => [
      { value: '', label: t('period.any') },
      ...REPORT_PERIODS.map((period) => ({ value: period, label: t(`period.${period}`) })),
    ],
    [t],
  );

  const chartSplitOptions = useMemo(
    () => [
      { value: '', label: t('design.chart-no-split') },
      ...designDimensions.map((dimension) => ({ value: dimension.key, label: dimension.label })),
    ],
    [designDimensions, t],
  );

  const spec = useMemo<ReportSpec>(() => {
    const valueKeys = draft.measures.map((one) => one.key);
    const columnKeys = draft.shapeKind === 'matrix' && draft.columnDimension
      ? [draft.columnDimension]
      : [];
    /*
     * Os níveis das LINHAS, e a razão de eles serem escolhidos em vez de herdados.
     *
     * Antes, `rowKeys` era a lista INTEIRA de campos: quem declarava dez campos para vê-los como
     * colunas recebia dez níveis de recuo, no resumo e no pivô. Agrupar é uma escolha; declarar um
     * campo é outra. O campo que já está atravessado nas colunas do pivô sai daqui — ele não pode
     * ser eixo duas vezes.
     */
    const rowKeys = draft.groupDimensions
      .filter((key) => draft.dimensions.some((one) => one.key === key))
      .filter((key) => !columnKeys.includes(key));

    // O total geral é LIGADO por padrão no contrato; só a escolha de desligá-lo vai para o `spec`.
    const totalChoice = draft.grandTotal ? {} : { grandTotal: false };
    const original = editing?.spec;

    const shape: ReportShape = draft.shapeKind === 'tabular'
      ? {
          // O que a autoria não edita na lista — a ordem da consulta e o teto da dobra — sobrevive à
          // gravação: um relatório escrito por uma extensão ou pelo agente e aberto aqui perderia
          // esses recortes no primeiro Salvar.
          ...(original?.shape.kind === 'tabular' && original.shape.orderBy ? { orderBy: original.shape.orderBy } : {}),
          ...(original?.shape.kind === 'tabular' && original.shape.limit !== undefined ? { limit: original.shape.limit } : {}),
          ...tabularShapeOf(draft.dimensions.map((one) => one.key), rowKeys),
        }
      : (draft.shapeKind === 'matrix'
        ? {
            kind: 'matrix',
            rows: rowKeys.map((dimension) => ({ dimension })),
            columns: columnKeys.map((dimension) => ({ dimension })),
            values: valueKeys,
            ...totalChoice,
            ...(draft.emptyCell ? { emptyCell: draft.emptyCell } : {}),
          }
        : {
            kind: 'summary',
            groupBy: rowKeys.map((dimension, index) => ({
              dimension,
              // O nível de cima subtotaliza quando há mais de um: sem isso um relatório de dois
              // níveis não mostra o total de cada grupo, que é a pergunta que o agrupou.
              subtotal: index < rowKeys.length - 1,
            })),
            values: valueKeys,
            ...totalChoice,
          });

    // `presentation` só existe quando há o que dizer nela. Um objeto vazio no spec seria ruído no
    // `.json` e uma camada a mais para quem lê o relatório entender.
    const chart = draft.chartKind
      ? {
          kind: draft.chartKind,
          ...(draft.chartCategory ? { category: draft.chartCategory } : {}),
          ...(draft.chartSeries.length > 0 ? { series: draft.chartSeries } : {}),
          ...(draft.chartSplitBy ? { splitBy: draft.chartSplitBy } : {}),
          ...(draft.chartStacked ? { stacked: true } : {}),
        }
      : undefined;

    /*
     * O que a autoria ainda NÃO edita na apresentação — `fields`, o detalhamento, a exportação — é
     * levado como estava. Reconstruir o `spec` só a partir do rascunho apagava, no primeiro Salvar, o
     * que o relatório dizia e a tela não mostrava.
     */
    const kept: ReportPresentation = { ...(original?.presentation ?? {}) };
    delete kept.chart;
    delete kept.prompts;
    delete kept.highlight;
    const presentation: ReportPresentation = {
      ...kept,
      ...(chart ? { chart } : {}),
      ...(draft.prompts.length > 0 ? { prompts: draft.prompts } : {}),
      ...(draft.highlights.length > 0 ? { highlight: draft.highlights } : {}),
    };

    const scan = Number.parseInt(draft.scanLimit, 10);
    const keptAccess = { ...(original?.access ?? {}) };
    delete keptAccess.permission;
    const access = {
      ...keptAccess,
      ...(draft.permission ? { permission: draft.permission } : {}),
    };

    return {
      v: REPORT_SPEC_VERSION,
      dataset: {
        // `kind` é o discriminante de onde as linhas vêm: um relatório que não seja de coleção não é
        // editado aqui, mas perder o discriminante o transformaria em outro relatório.
        ...(original?.dataset.kind ? { kind: original.dataset.kind } : {}),
        table: draft.table,
        ...(draft.filters.length > 0 ? { where: draft.filters } : {}),
        // Chave AUSENTE quando não há expressão, nunca vazia: o `spec` é gravado verbatim, e uma
        // string vazia ali seria uma capacidade declarada que o relatório não usa.
        ...(draft.filterExpression.trim() !== ''
          ? { includeWhen: draft.filterExpression.trim() }
          : {}),
        dimensions: draft.dimensions,
        measures: draft.measures,
        ...(Number.isFinite(scan) && scan > 0 ? { scanLimit: scan } : {}),
      },
      shape,
      ...(Object.keys(presentation).length > 0 ? { presentation } : {}),
      ...(Object.keys(access).length > 0 ? { access } : {}),
      ...(original?.schedule ? { schedule: original.schedule } : {}),
    };
  }, [draft, editing]);

  const issues = useMemo(() => validateReportSpec(spec, { schema }), [spec, schema]);

  const errors = useMemo(
    () => issues
      .filter((issue) => (issue.severity ?? 'error') === 'error')
      .map((issue) => label(issue.error, issue.errorParams)),
    [issues, label],
  );

  const warnings = useMemo(
    () => issues
      .filter((issue) => issue.severity === 'warning')
      .map((issue) => label(issue.error, issue.errorParams)),
    [issues, label],
  );

  const reportProblem = useCallback((caught: unknown) => {
    // Um `LocalizedError` traz a REFERÊNCIA na mensagem. Mostrá-la crua foi o que apareceu na tela
    // como `@core.reports/artifact.id-taken` — quem lê não tem o que fazer com isso.
    const raw = caught instanceof Error ? caught.message : String(caught);
    notify(label(raw, errorParamsOf(caught)), 'error');
  }, [notify, label]);

  const runPreview = useCallback(async () => {
    if (hasBlockingReportIssue(issues)) return;
    setIsPreviewing(true);
    setPreviewError(null);
    try {
      const outcome = await runReport({ spec });
      setPreview(outcome.result);
      setPreviewError(outcome.error ? label(outcome.error, outcome.errorParams) : null);
    } catch (caught) {
      setPreview(null);
      setPreviewError(caught instanceof Error ? label(caught.message, errorParamsOf(caught)) : String(caught));
    } finally {
      setIsPreviewing(false);
    }
  }, [issues, spec, runReport, label]);

  const artifactPrefix = useArtifactPrefix();

  const save = useCallback(async () => {
    if (hasBlockingReportIssue(issues) || draft.title.trim() === '') return;
    setIsSaving(true);
    try {
      if (editing) {
        await updateReport(editing.id, { title: draft.title.trim(), spec });
      } else {
        const taken = new Set(reports.map((report) => report.key));
        const key = uniqueReportKey(draft.title, taken, artifactPrefix);
        const created = await createReport({
          key,
          title: draft.title.trim(),
          icon: 'fileChart',
          spec,
          origin: 'design',
          enabled: true,
        }, key);
        // A partir daqui esta aba EDITA. Sem esta linha, cada Salvar seguinte criava outro relatório.
        setCreatedReport(created);
      }
      notify(t('save.done'), 'success');
    } catch (caught) {
      reportProblem(caught);
    } finally {
      setIsSaving(false);
    }
  }, [artifactPrefix, issues, draft, spec, editing, reports, createReport, updateReport, notify, t, reportProblem]);

  const confirmDelete = useCallback(async () => {
    if (!editing) return;
    setIsDeleting(true);
    try {
      await deleteReport(editing.id);
      notify(t('delete.done'), 'success');
      setIsConfirmingDelete(false);
      // Volta para a lista em vez de fechar a aba: fechar exigiria saber em que painel ela está, e
      // depois de excluir o que a pessoa quer ver é o que sobrou.
      openTab(REPORT_DESIGN_RETURN_TAB);
    } catch (caught) {
      reportProblem(caught);
    } finally {
      setIsDeleting(false);
    }
  }, [editing, deleteReport, notify, t, openTab, reportProblem]);

  return {
    title: t('page.design'),
    isEditing: editing !== undefined,
    // Só o de PACOTE: ele explica um bloqueio. Dizer "você está editando" a quem clicou em Editar
    // é ocupar a tela com o que a pessoa acabou de fazer.
    editingNotice: isManaged ? t('design.managed') : null,
    // Enquanto a lista carrega, "não achei" seria mentira: o relatório pode estar a caminho.
    notFound: editingKey !== null && editing === undefined && !isLoading
      ? t('design.not-found', { key: editingKey })
      : null,
    isManaged,
    tableOptions,
    table: draft.table,
    setTable,
    reportTitle: draft.title,
    setReportTitle,
    pathOptions,
    dimensions: designDimensions,
    addDimension,
    removeDimension,
    setGranularity,
    moveDimension,
    draggedDimension,
    dragOverDimension,
    startDragDimension,
    dragOverDimensionAt,
    endDragDimension,
    dropDimension,
    measures: designMeasures,
    setMeasureFormat,
    setMeasureDecimals,
    formatOptions: [
      { value: '', label: t('format.number') },
      ...DESIGN_FORMAT_KINDS.filter((kind) => kind !== 'number').map((kind) => ({ value: kind, label: t(`format.${kind}`) })),
    ],
    distinctOptions: pathOptions.map((option) => ({ value: option.value, label: option.label })),
    computedName,
    setComputedName,
    computedExpression,
    setComputedExpression,
    measureVariables,
    addComputed,
    canAddComputed: computedName.trim() !== '' && computedExpression.trim() !== '',
    setDimensionSort,
    setDimensionLimit,
    setDimensionOthers,
    sortOptions,
    grandTotal: draft.grandTotal,
    setGrandTotal: (grandTotal) => change({ grandTotal }),
    emptyCell: draft.emptyCell,
    setEmptyCell: (value) => change({ emptyCell: value === 'blank' || value === 'zero' ? value : '' }),
    emptyCellOptions: [
      { value: '', label: t('design.empty-cell.default') },
      { value: 'zero', label: t('design.empty-cell.zero') },
      { value: 'blank', label: t('design.empty-cell.blank') },
    ],
    scanLimit: draft.scanLimit,
    setScanLimit: (scanLimit) => change({ scanLimit: scanLimit.replace(/\D+/g, '') }),
    permission: draft.permission,
    setPermission: (permission) => change({ permission }),
    permissionOptions,
    highlights: draft.highlights.map((rule) => ({
      label: t('design.highlight.summary', {
        measure: measureName(rule.measure),
        op: t(`operator.${rule.op}`),
        value: String(rule.value),
        tone: t(`tone.${rule.tone}`),
      }),
    })),
    highlightMeasure,
    setHighlightMeasure,
    highlightOp,
    setHighlightOp,
    highlightValue,
    setHighlightValue,
    highlightTone,
    setHighlightTone,
    addHighlight,
    canAddHighlight: highlightMeasure !== '' && highlightValue.trim() !== ''
      && Number.isFinite(Number(highlightValue.replace(',', '.'))),
    removeHighlight,
    measureOp,
    setMeasureOp,
    measurePath,
    setMeasurePath,
    addMeasure,
    canAddMeasure: measureOp === 'count' || measurePath !== '',
    removeMeasure,
    shapeKind: draft.shapeKind,
    setShapeKind: (shapeKind) => change({ shapeKind }),
    columnDimension: draft.columnDimension,
    setColumnDimension: (columnDimension) => change({ columnDimension }),
    groupDimensions: draft.groupDimensions,
    setGroupDimensions: (groupDimensions) => change({ groupDimensions }),

    filters: draft.filters.map((filter) => ({
      label: pathOptions.find((one) => one.value === filter.path)?.label ?? filter.path,
      op: t(`operator.${filter.op}`),
      value: filter.value && filter.value.kind === 'Literal'
        ? valueLabel(filter.path, filterTextOf(filter.value.value as CustomFieldValue))
        : '',
    })),
    filterPath,
    setFilterPath: chooseFilterPath,
    filterOp,
    setFilterOp,
    filterValue: filterValueOf(filterField, filterText),
    setFilterValue,
    filterField,
    filterNeedsValue: operatorNeedsValue(filterOp),
    addFilter,
    canAddFilter: filterPath !== '' && (!operatorNeedsValue(filterOp) || filterText.trim() !== ''),
    removeFilter,

    filterExpression: draft.filterExpression,
    setFilterExpression: (filterExpression) => change({ filterExpression }),
    expressionVariables,

    chartKind: draft.chartKind,
    setChartKind: (chartKind) => change({ chartKind }),
    chartCategory: draft.chartCategory,
    setChartCategory: (chartCategory) => change({ chartCategory }),
    chartSeries: draft.chartSeries,
    setChartSeries: (chartSeries) => change({ chartSeries }),
    chartSplitBy: draft.chartSplitBy,
    setChartSplitBy: (chartSplitBy) => change({ chartSplitBy }),
    chartSplitOptions,
    chartStacked: draft.chartStacked,
    setChartStacked: (chartStacked) => change({ chartStacked }),

    prompts: draft.prompts.map((prompt) => {
      const isPeriod = prompt.control === REPORT_PROMPT_PERIOD_CONTROL;
      return {
        key: prompt.key,
        label: prompt.label ? label(prompt.label) : prompt.path,
        op: isPeriod ? t('design.prompt.period') : t(`operator.${prompt.op}`),
        required: prompt.required === true,
        isPeriod,
        periodDefault: isPeriod && prompt.default?.kind === 'Literal' && typeof prompt.default.value === 'string'
          ? prompt.default.value
          : '',
      };
    }),
    promptPath,
    // Trocar o campo devolve o operador ao padrão: o período só existe para data, e ficar escolhido
    // sobre um campo de texto pediria ao servidor um período de um nome.
    setPromptPath: (path) => { setPromptPath(path); setPromptOp('eq'); },
    promptOp,
    setPromptOp,
    promptOpOptions,
    setPromptRequired,
    setPromptPeriodDefault,
    periodOptions,
    addPrompt,
    canAddPrompt: promptPath !== '',
    removePrompt,
    spec,
    errors,
    warnings,
    canSave: errors.length === 0 && draft.title.trim() !== '' && !isManaged,
    preview,
    isPreviewing,
    previewError,
    runPreview,
    save,
    isSaving,
    canDelete: editing !== undefined && !isManaged,
    isConfirmingDelete,
    askDelete: () => setIsConfirmingDelete(true),
    cancelDelete: () => setIsConfirmingDelete(false),
    confirmDelete,
    isDeleting,
    labels: {
      table: t('design.table'),
      reportTitle: t('design.title'),
      dimensions: t('design.dimensions'),
      dimensionsHint: t('design.dimensions.hint'),
      measures: t('design.measures'),
      measuresHint: t('design.measures.hint'),
      shape: t('design.shape'),
      columnDimension: t('design.column-dimension'),
      group: t('design.group'),
      groupHint: t('design.group.hint'),
      noGroup: t('design.no-group'),
      add: t('design.add'),
      remove: t('design.remove'),
      reorder: t('design.reorder'),
      moveUp: t('design.move-up'),
      moveDown: t('design.move-down'),
      preview: t('design.preview'),
      save: t('design.save'),
      noGranularity: t('design.no-granularity'),
      measureOp: t('design.measure-op'),
      measureField: t('design.measure-field'),
      filters: t('design.filters'),
      filtersHint: t('design.filters.hint'),
      expressionFilter: t('design.expression'),
      expressionFilterHint: t('design.expression.hint'),
      expressionFilterPlaceholder: t('design.expression.placeholder'),
      chart: t('design.chart'),
      chartHint: t('design.chart.hint'),
      chartCategory: t('design.chart-category'),
      chartSeries: t('design.chart-series'),
      chartSplit: t('design.chart-split'),
      chartStacked: t('design.chart-stacked'),
      noChart: t('design.no-chart'),
      prompts: t('design.prompts'),
      promptsHint: t('design.prompts.hint'),
      computed: t('design.computed'),
      computedHint: t('design.computed.hint'),
      computedName: t('design.computed.name'),
      computedPlaceholder: t('design.computed.placeholder'),
      format: t('design.format'),
      decimals: t('design.decimals'),
      distinctField: t('design.distinct-field'),
      sort: t('design.sort'),
      limit: t('design.limit'),
      limitPlaceholder: t('design.limit.placeholder'),
      others: t('design.others'),
      grandTotal: t('design.grand-total'),
      emptyCell: t('design.empty-cell'),
      scanLimit: t('design.scan-limit'),
      scanLimitPlaceholder: t('design.scan-limit.placeholder'),
      permission: t('design.permission'),
      permissionHint: t('design.permission.hint'),
      highlight: t('design.highlight'),
      highlightHint: t('design.highlight.hint'),
      highlightValue: t('design.highlight.value'),
      promptRequired: t('design.prompt.required'),
      promptDefault: t('design.prompt.default'),
      opHighlightOptions: REPORT_HIGHLIGHT_OPS.map((op) => ({ value: op, label: t(`operator.${op}`) })),
      toneOptions: REPORT_HIGHLIGHT_TONES.map((tone) => ({ value: tone, label: t(`tone.${tone}`) })),
      chartOptions: REPORT_CHART_KINDS.map((kind) => ({ value: kind, label: t(`chart.${kind}`) })),
      operatorOptions: QUERY_OPERATORS.map((op) => ({ value: op, label: t(`operator.${op}`) })),
      deleteAction: t('design.delete'),
      deleteConfirm: t('design.delete.confirm', { name: draft.title || '—' }),
      shapeOptions: [
        { value: 'tabular', label: t('shape.tabular') },
        { value: 'summary', label: t('shape.summary') },
        { value: 'matrix', label: t('shape.matrix') },
      ],
      opOptions: NUMERIC_AGGREGATION_OPS.map((op) => ({ value: op, label: t(`op.${op}`) })),
      granularityOptions: REPORT_GRANULARITIES.map((one) => ({
        value: one,
        label: t(`granularity.${one}`),
      })),
    },
  };
};
