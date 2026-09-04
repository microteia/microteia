import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNotification } from '../../../stores/useNotification';
import { useReportDefinitions } from '../../../stores/useReportDefinitions';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useSchemaContext } from '../../shared/useSchemaContext';
import { useLabel, useT } from '../../shared/i18n/useT';
import { useReportPathOptions } from '../../shared/report/useReportPathOptions';
import type { ReportPathOption } from '../../shared/report/useReportPathOptions';
import { screenDataCollection } from '../../../domain/services/screenDataCollection';
import { parseReportDesignTabKey } from '../../../shared/constants/reportKeys';

/** A lista, para onde a autoria volta depois de excluir. */
const REPORT_DESIGN_RETURN_TAB = 'reports';
import {
  REPORT_CHART_KINDS,
  REPORT_GRANULARITIES,
  REPORT_SPEC_VERSION,
} from '../../../domain/schema/report/reportSpec';
import { QUERY_OPERATORS } from '../../../domain/schema/querySpec';
import type { QueryOperator, QueryPredicate } from '../../../domain/schema/querySpec';
import type {
  ReportDimension,
  ReportGranularity,
  ReportMeasure,
  ReportPresentation,
  ReportPrompt,
  ReportShape,
  ReportSpec,
} from '../../../domain/schema/report/reportSpec';
import { hasBlockingReportIssue, validateReportSpec } from '../../../domain/schema/report/validateReportSpec';
import type { ReportResult } from '../../../domain/schema/report/reportResult';
import type { AggregationOp } from '../../../domain/schema/fieldRules';
import { errorParamsOf } from '../../../domain/errors/LocalizedError';

export type ReportShapeKindChoice = 'tabular' | 'summary' | 'matrix';

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
  /** O filtro FIXO: vale sempre, e quem lê o relatório não o vê nem o muda. */
  filters: QueryPredicate[];
  /** Vazio = sem gráfico. A tabela sozinha é um relatório legítimo. */
  chartKind: string;
  chartCategory: string;
  chartSeries: string[];
  chartStacked: boolean;
  /** Os filtros que o LEITOR preenche ao abrir. */
  prompts: ReportPrompt[];
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

  dimensions: ReportDimension[];
  addDimension: (path: string) => void;
  removeDimension: (key: string) => void;
  setGranularity: (key: string, granularity: ReportGranularity | undefined) => void;

  measures: ReportMeasure[];
  measureOp: AggregationOp;
  setMeasureOp: (op: AggregationOp) => void;
  measurePath: string;
  setMeasurePath: (path: string) => void;
  addMeasure: () => void;
  canAddMeasure: boolean;
  removeMeasure: (key: string) => void;

  shapeKind: ReportShapeKindChoice;
  setShapeKind: (kind: ReportShapeKindChoice) => void;
  columnDimension: string;
  setColumnDimension: (key: string) => void;

  filters: { label: string; op: string; value: string }[];
  filterPath: string;
  setFilterPath: (path: string) => void;
  filterOp: QueryOperator;
  setFilterOp: (op: QueryOperator) => void;
  filterValue: string;
  setFilterValue: (value: string) => void;
  /** O valor escolhido é uma DATA — o campo então é o de data, nunca um texto livre. */
  filterIsDate: boolean;
  filterNeedsValue: boolean;
  addFilter: () => void;
  canAddFilter: boolean;
  removeFilter: (index: number) => void;

  chartKind: string;
  setChartKind: (kind: string) => void;
  chartCategory: string;
  setChartCategory: (key: string) => void;
  chartSeries: string[];
  setChartSeries: (keys: string[]) => void;
  chartStacked: boolean;
  setChartStacked: (stacked: boolean) => void;

  prompts: { key: string; label: string; op: string }[];
  promptPath: string;
  setPromptPath: (path: string) => void;
  promptOp: QueryOperator;
  setPromptOp: (op: QueryOperator) => void;
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
    add: string;
    remove: string;
    preview: string;
    save: string;
    noGranularity: string;
    measureOp: string;
    measureField: string;
    filters: string;
    filtersHint: string;
    filterValue: string;
    chart: string;
    chartHint: string;
    chartCategory: string;
    chartSeries: string;
    chartStacked: string;
    noChart: string;
    prompts: string;
    promptsHint: string;
    chartOptions: { value: string; label: string }[];
    operatorOptions: { value: QueryOperator; label: string }[];
    deleteAction: string;
    deleteConfirm: string;
    shapeOptions: { value: ReportShapeKindChoice; label: string }[];
    opOptions: { value: AggregationOp; label: string }[];
    granularityOptions: { value: string; label: string }[];
  };
}

const OPS: AggregationOp[] = ['sum', 'count', 'avg', 'min', 'max'];

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
 * A chave do DOCUMENTO, única entre os relatórios que já existem.
 *
 * Sem isto, salvar dois relatórios de nome parecido devolvia `artifact.id-taken` — uma recusa
 * correta do repositório e inútil para quem só quis dar o mesmo nome de novo.
 */
export const uniqueReportKey = (title: string, taken: Set<string>): string => {
  const base = slug(title.trim().toLowerCase()).slice(0, 60) || 'report';
  let key = base;
  let index = 2;
  while (taken.has(key)) { key = `${base}_${index}`; index += 1; }
  return key;
};

const shapeKindOf = (spec: ReportSpec): ReportShapeKindChoice => spec.shape.kind;

const columnDimensionOf = (spec: ReportSpec): string =>
  spec.shape.kind === 'matrix' ? (spec.shape.columns[0]?.dimension ?? '') : '';

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
  const editing = editingKey ? getReport(editingKey) : undefined;

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
        filters: editing.spec.dataset.where ?? [],
        chartKind: editing.spec.presentation?.chart?.kind ?? '',
        chartCategory: editing.spec.presentation?.chart?.category ?? '',
        chartSeries: editing.spec.presentation?.chart?.series ?? [],
        chartStacked: editing.spec.presentation?.chart?.stacked === true,
        prompts: editing.spec.presentation?.prompts ?? [],
      }
    : {
        table: tableOptions[0]?.value ?? '',
        title: '',
        dimensions: [],
        measures: [],
        shapeKind: 'summary',
        columnDimension: '',
        filters: [],
        chartKind: '',
        chartCategory: '',
        chartSeries: [],
        chartStacked: false,
        prompts: [],
      }), [editing, label, tableOptions]);

  const [touched, setTouched] = useState<ReportDraft | null>(null);
  const draft = touched ?? seeded;

  const [measureOp, setMeasureOp] = useState<AggregationOp>('count');
  const [measurePath, setMeasurePath] = useState('');
  const [filterPath, setFilterPath] = useState('');
  const [filterOp, setFilterOp] = useState<QueryOperator>('eq');
  const [filterValue, setFilterValue] = useState('');
  const [promptPath, setPromptPath] = useState('');
  const [promptOp, setPromptOp] = useState<QueryOperator>('eq');
  const [preview, setPreview] = useState<ReportResult | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const pathOptions = useReportPathOptions(draft.table);

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
      filters: [],
      chartKind: '',
      chartCategory: '',
      chartSeries: [],
      prompts: [],
    });
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

  const removeDimension = useCallback((key: string) => {
    change({
      dimensions: draft.dimensions.filter((one) => one.key !== key),
      columnDimension: draft.columnDimension === key ? '' : draft.columnDimension,
    });
  }, [draft, change]);

  const setGranularity = useCallback((key: string, granularity: ReportGranularity | undefined) => {
    change({
      dimensions: draft.dimensions.map((one) => (one.key === key ? { ...one, granularity } : one)),
    });
  }, [draft, change]);

  const addMeasure = useCallback(() => {
    if (measureOp !== 'count' && !measurePath) return;
    const taken = new Set([...draft.dimensions, ...draft.measures].map((one) => one.key));
    const option = pathOptions.find((one) => one.value === measurePath);
    // A chave é IDENTIFICADOR, e identificador é em inglês — ela não se traduz, e é ela que aparece
    // no `.json` de um relatório exportado e nas referências da dobra. O que traduz é o `label`.
    const key = measureOp === 'count'
      ? keyFromPath(MEASURE_COUNT_KEY, taken)
      : keyFromPath(measurePath, taken, `_${measureOp}`);

    change({
      measures: [...draft.measures, {
        key,
        op: measureOp,
        label: measureOp === 'count'
          ? t('op.count')
          : `${t(`op.${measureOp}`)} — ${option?.label ?? measurePath}`,
        ...(measureOp === 'count' ? {} : { path: measurePath }),
      }],
    });
    setMeasurePath('');
  }, [measureOp, measurePath, draft, pathOptions, change, t]);

  const removeMeasure = useCallback((key: string) => {
    change({ measures: draft.measures.filter((one) => one.key !== key) });
  }, [draft, change]);

  const addFilter = useCallback(() => {
    if (!filterPath) return;
    if (operatorNeedsValue(filterOp) && filterValue.trim() === '') return;
    change({
      filters: [...draft.filters, {
        path: filterPath,
        op: filterOp,
        // `Literal` porque é valor FIXO, escrito na autoria. O mesmo `resolveMapping` do resto do
        // caminho o resolve — não existe um segundo jeito de um valor chegar à consulta.
        ...(operatorNeedsValue(filterOp)
          ? { value: { kind: 'Literal' as const, value: filterValue.trim() } }
          : {}),
      }],
    });
    setFilterValue('');
  }, [filterPath, filterOp, filterValue, draft, change]);

  const removeFilter = useCallback((index: number) => {
    change({ filters: draft.filters.filter((_, at) => at !== index) });
  }, [draft, change]);

  const addPrompt = useCallback(() => {
    if (!promptPath) return;
    const option = pathOptions.find((one) => one.value === promptPath);
    const taken = new Set(draft.prompts.map((one) => one.key));
    change({
      prompts: [...draft.prompts, {
        key: keyFromPath(promptPath, taken, `_${promptOp}`),
        path: promptPath,
        op: promptOp,
        label: option?.label,
      }],
    });
  }, [promptPath, promptOp, pathOptions, draft, change]);

  const removePrompt = useCallback((key: string) => {
    change({ prompts: draft.prompts.filter((one) => one.key !== key) });
  }, [draft, change]);

  const spec = useMemo<ReportSpec>(() => {
    const valueKeys = draft.measures.map((one) => one.key);
    const columnKeys = draft.columnDimension ? [draft.columnDimension] : [];
    const rowKeys = draft.dimensions
      .map((one) => one.key)
      .filter((key) => !columnKeys.includes(key));

    const shape: ReportShape = draft.shapeKind === 'tabular'
      ? { kind: 'tabular', columns: draft.dimensions.map((one) => one.key) }
      : (draft.shapeKind === 'matrix'
        ? {
            kind: 'matrix',
            rows: rowKeys.map((dimension) => ({ dimension })),
            columns: columnKeys.map((dimension) => ({ dimension })),
            values: valueKeys,
          }
        : {
            kind: 'summary',
            groupBy: draft.dimensions.map((one, index) => ({
              dimension: one.key,
              // O nível de cima subtotaliza quando há mais de um: sem isso um relatório de dois
              // níveis não mostra o total de cada grupo, que é a pergunta que o agrupou.
              subtotal: index < draft.dimensions.length - 1,
            })),
            values: valueKeys,
          });

    // `presentation` só existe quando há o que dizer nela. Um objeto vazio no spec seria ruído no
    // `.json` e uma camada a mais para quem lê o relatório entender.
    const chart = draft.chartKind
      ? {
          kind: draft.chartKind,
          ...(draft.chartCategory ? { category: draft.chartCategory } : {}),
          ...(draft.chartSeries.length > 0 ? { series: draft.chartSeries } : {}),
          ...(draft.chartStacked ? { stacked: true } : {}),
        }
      : undefined;

    const presentation: ReportPresentation | undefined = chart || draft.prompts.length > 0
      ? { ...(chart ? { chart } : {}), ...(draft.prompts.length > 0 ? { prompts: draft.prompts } : {}) }
      : undefined;

    return {
      v: REPORT_SPEC_VERSION,
      dataset: {
        table: draft.table,
        ...(draft.filters.length > 0 ? { where: draft.filters } : {}),
        dimensions: draft.dimensions,
        measures: draft.measures,
      },
      shape,
      ...(presentation ? { presentation } : {}),
    };
  }, [draft]);

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

  const save = useCallback(async () => {
    if (hasBlockingReportIssue(issues) || draft.title.trim() === '') return;
    setIsSaving(true);
    try {
      if (editing) {
        await updateReport(editing.id, { title: draft.title.trim(), spec });
      } else {
        const taken = new Set(reports.map((report) => report.key));
        const key = uniqueReportKey(draft.title, taken);
        await createReport({
          key,
          title: draft.title.trim(),
          icon: 'fileChart',
          spec,
          origin: 'design',
          enabled: true,
        }, key);
      }
      notify(t('save.done'), 'success');
    } catch (caught) {
      reportProblem(caught);
    } finally {
      setIsSaving(false);
    }
  }, [issues, draft, spec, editing, reports, createReport, updateReport, notify, t, reportProblem]);

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
    dimensions: draft.dimensions,
    addDimension,
    removeDimension,
    setGranularity,
    measures: draft.measures,
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

    filters: draft.filters.map((filter) => ({
      label: pathOptions.find((one) => one.value === filter.path)?.label ?? filter.path,
      op: t(`operator.${filter.op}`),
      value: filter.value && filter.value.kind === 'Literal' ? String(filter.value.value) : '',
    })),
    filterPath,
    setFilterPath,
    filterOp,
    setFilterOp,
    filterValue,
    setFilterValue,
    filterIsDate: pathOptions.find((one) => one.value === filterPath)?.isDate === true,
    filterNeedsValue: operatorNeedsValue(filterOp),
    addFilter,
    canAddFilter: filterPath !== '' && (!operatorNeedsValue(filterOp) || filterValue.trim() !== ''),
    removeFilter,

    chartKind: draft.chartKind,
    setChartKind: (chartKind) => change({ chartKind }),
    chartCategory: draft.chartCategory,
    setChartCategory: (chartCategory) => change({ chartCategory }),
    chartSeries: draft.chartSeries,
    setChartSeries: (chartSeries) => change({ chartSeries }),
    chartStacked: draft.chartStacked,
    setChartStacked: (chartStacked) => change({ chartStacked }),

    prompts: draft.prompts.map((prompt) => ({
      key: prompt.key,
      label: prompt.label ?? prompt.path,
      op: t(`operator.${prompt.op}`),
    })),
    promptPath,
    setPromptPath,
    promptOp,
    setPromptOp,
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
      add: t('design.add'),
      remove: t('design.remove'),
      preview: t('design.preview'),
      save: t('design.save'),
      noGranularity: t('design.no-granularity'),
      measureOp: t('design.measure-op'),
      measureField: t('design.measure-field'),
      filters: t('design.filters'),
      filtersHint: t('design.filters.hint'),
      filterValue: t('design.filter-value'),
      chart: t('design.chart'),
      chartHint: t('design.chart.hint'),
      chartCategory: t('design.chart-category'),
      chartSeries: t('design.chart-series'),
      chartStacked: t('design.chart-stacked'),
      noChart: t('design.no-chart'),
      prompts: t('design.prompts'),
      promptsHint: t('design.prompts.hint'),
      chartOptions: REPORT_CHART_KINDS.map((kind) => ({ value: kind, label: t(`chart.${kind}`) })),
      operatorOptions: QUERY_OPERATORS.map((op) => ({ value: op, label: t(`operator.${op}`) })),
      deleteAction: t('design.delete'),
      deleteConfirm: t('design.delete.confirm', { name: draft.title || '—' }),
      shapeOptions: [
        { value: 'tabular', label: t('shape.tabular') },
        { value: 'summary', label: t('shape.summary') },
        { value: 'matrix', label: t('shape.matrix') },
      ],
      opOptions: OPS.map((op) => ({ value: op, label: t(`op.${op}`) })),
      granularityOptions: REPORT_GRANULARITIES.map((one) => ({
        value: one,
        label: t(`granularity.${one}`),
      })),
    },
  };
};
