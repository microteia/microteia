import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLabel, useLocaleFormat, useT } from '../../../shared/i18n/useT';
import { useReportDefinitions } from '../../../../stores/useReportDefinitions';
import { useWorkspace } from '../../../../stores/useWorkspace';
import type { ReportDefinition } from '../../../../domain/entities/Report';
import type { ReportResult } from '../../../../domain/schema/report/reportResult';
import type { ReportPrompt, ReportSpec } from '../../../../domain/schema/report/reportSpec';
import { useReportPathOptions } from '../../../shared/report/useReportPathOptions';
import { filterLiteralOf, filterTextOf, filterValueOf } from '../../../shared/report/reportFilterFields';
import type { CustomFieldValue, FieldDefinition } from '../../../../domain/entities/entitySchemas';
import type { ReportSpecIssue } from '../../../../domain/schema/report/validateReportSpec';
import { REPORT_PERIODS, REPORT_PROMPT_PERIOD_CONTROL } from '../../../../domain/schema/report/reportPeriod';
import { reportDrillEnabled } from '../../../../domain/schema/report/reportSpec';
import type { ReportDrillTarget } from '../../../../domain/schema/report/aggregateRows';
import { useOpenRecord } from '../../../shared/useOpenRecord';
import { useReportGroupLabels } from '../../../shared/report/useReportGroupLabels';
import { useReportExport } from '../../../shared/report/useReportCsv';
import { useAuthorization } from '../../../../stores/useAuthorization';
import { PERMISSION_AUTOMATION_MANAGE } from '../../../../domain/schema/access/kernelPermissions';
import { resolveWidgetAnswers } from '../../../../domain/schema/ui/widgetSpec';
import type { WidgetReportAnswers, WidgetReportView } from '../../../../domain/schema/ui/widgetSpec';
import { useWidgetFilterValues } from '../../../shared/widgetFilterContext';

/** Um filtro que o LEITOR preenche, já com o que a tela precisa para desenhá-lo. */
export interface ReportPromptField {
  key: string;
  label: string;
  /**
   * O campo do schema que o filtro compara — é ele que decide o controle. Ausente quando o caminho
   * declarado não descreve campo nenhum: aí o valor é pedido como texto, que é o que sobra.
   */
  field: FieldDefinition | undefined;
  /** O valor no FORMATO DO CAMPO, como o controle o entende. */
  value: CustomFieldValue;
  /**
   * O filtro pede um PERÍODO relativo, e não um valor: a tela oferece a lista de períodos em vez do
   * controle do campo. `periodValue` é a chave escolhida, vazia = qualquer período.
   */
  isPeriod: boolean;
  periodValue: string;
  required: boolean;
}

export interface ReportViewViewModel {
  report: ReportDefinition | undefined;
  spec: ReportSpec | null;
  title: string;
  description: string | null;
  result: ReportResult | null;
  isLoading: boolean;
  /** REFERÊNCIA de mensagem já resolvida, ou `null`. */
  error: string | null;
  /** Os avisos do que degradou sem impedir o relatório de rodar. */
  warnings: string[];
  /** O aviso de resultado PARCIAL — presente só quando ele é parcial de fato. */
  partial: string | null;
  meta: string | null;
  run: () => Promise<void>;

  prompts: ReportPromptField[];
  setPromptValue: (key: string, value: CustomFieldValue) => void;
  setPromptPeriod: (key: string, period: string) => void;
  periodOptions: { value: string; label: string }[];
  /** Falta resposta a um filtro obrigatório — o servidor recusaria, então a tela nem pergunta. */
  canRun: boolean;
  runLabel: string;
  clearLabel: string;
  clearPrompts: () => void;
  hasPromptValues: boolean;
  exportLabel: string;
  exportXlsxLabel: string;
  printLabel: string;
  canExport: boolean;
  /** Os formatos que o relatório OFERECE — `export.<formato>: false` esconde o botão. */
  offersCsv: boolean;
  offersXlsx: boolean;
  offersPrint: boolean;
  exportCsv: () => void;
  exportXlsx: () => void;
  print: () => void;
  /** O detalhamento, quando o relatório o permite. Ausente, tabela e pivô não são clicáveis. */
  drill: ((target: ReportDrillTarget) => void) | undefined;
  drillOpen: boolean;
  drillTitle: string;
  drillRecords: Record<string, unknown>[];
  drillMatched: number;
  drillLoading: boolean;
  closeDrill: () => void;
  openDrillRecord: (recordId: string) => void;
  /** Cabeçalho e barra de filtros: só na vista inteira — a compacta é peça de um painel. */
  showChrome: boolean;
  showChart: boolean;
  showTable: boolean;
  /** Assinar cria uma AUTOMAÇÃO: só aparece para quem pode criá-la. */
  canSubscribe: boolean;
  subscribeLabel: string;
  subscribeOpen: boolean;
  openSubscribe: () => void;
  closeSubscribe: () => void;
  /** Os filtros como estão agora — a assinatura os repete em cada execução. */
  subscribePrompts: Record<string, unknown>;
}

/**
 * Executa um relatório do catálogo e prepara o que a tela mostra.
 *
 * O `run` é chamado por efeito ao abrir, e é refeito a cada troca de relatório. Não há cache: cada
 * execução é uma pergunta ao servidor, porque é lá que a permissão de cada coleção é cobrada.
 */
/** Um spec vazio, só para o hook de CSV existir antes de o relatório ser encontrado. */
const EMPTY_SPEC: ReportSpec = {
  v: 1,
  dataset: { table: '' },
  shape: { kind: 'tabular', columns: [] },
};

export const useReportViewViewModel = (
  reportKey: string,
  tabKey?: string,
  answers?: WidgetReportAnswers,
  view: WidgetReportView = 'full',
): ReportViewViewModel => {
  const { getReport, runReport } = useReportDefinitions();
  const { setTabTitle } = useWorkspace();
  const label = useLabel();
  const formatters = useLocaleFormat();
  const t = useT('core.reports');

  const report = getReport(reportKey);
  const spec = report?.spec ?? null;

  const [result, setResult] = useState<ReportResult | null>(null);
  const [issues, setIssues] = useState<ReportSpecIssue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  /**
   * O que o LEITOR mexeu, por chave. Ausente = ainda não tocou, e vale o padrão do autor.
   *
   * A diferença entre "não tocou" e "apagou" é o que decide se o padrão volta: a chave tocada vai ao
   * servidor como resposta — vazia quer dizer "sem restrição" —, e a não tocada vai com o padrão.
   */
  const [promptValues, setPromptValues] = useState<Record<string, string>>({});
  const [drillState, setDrillState] = useState<{
    title: string;
    records: Record<string, unknown>[];
    matched: number;
    loading: boolean;
  } | null>(null);
  const openRecord = useOpenRecord();
  const { can } = useAuthorization();
  const [subscribeOpen, setSubscribeOpen] = useState(false);

  /*
   * As respostas que vêm de FORA — as fixas de um nó do painel e as da barra que ele liga. Por texto,
   * pela mesma razão do `useMemo` abaixo: remontadas a cada render, elas mudariam a identidade de quem
   * executa e o relatório rodaria de novo sem nada ter mudado.
   */
  const filterValues = useWidgetFilterValues();
  const fixedKey = JSON.stringify(resolveWidgetAnswers(answers ?? {}, filterValues));
  const fixed = useMemo(() => JSON.parse(fixedKey) as Record<string, unknown>, [fixedKey]);

  // Memoizado, e não derivado solto: um `?? []` cria um array novo a cada render, e o `useMemo`
  // abaixo passaria a recalcular sempre — refazendo a lista a cada tecla digitada num filtro. O filtro
  // já respondido de fora não é perguntado de novo ao leitor.
  const declaredPrompts = useMemo<ReportPrompt[]>(
    () => (spec?.presentation?.prompts ?? [])
      .filter((prompt) => !Object.prototype.hasOwnProperty.call(fixed, prompt.key)),
    [spec, fixed],
  );
  const pathOptions = useReportPathOptions(spec?.dataset.table ?? '');

  const fieldByPath = useCallback(
    (path: string): FieldDefinition | undefined =>
      pathOptions.find((option) => option.value === path)?.field,
    [pathOptions],
  );

  /**
   * Executa com os valores que LHE PASSAM, e não com os que estão no estado.
   *
   * A diferença não é de estilo: enquanto o valor dos filtros era dependência desta função, ela
   * mudava de identidade a cada tecla — e o efeito que executa ao abrir a aba disparava junto. Um
   * relatório sobre dez mil registros era refeito no servidor letra por letra, e a resposta que
   * chegava por último nem sempre era a da última pergunta.
   */
  /**
   * O texto inicial de um filtro: o padrão LITERAL do autor. Um padrão por expressão (`today()`) não
   * tem texto a mostrar — ele é resolvido no servidor, e o filtro aparece vazio até o leitor mexer.
   */
  const literalDefault = useCallback((prompt: ReportPrompt): string => {
    if (prompt.default?.kind !== 'Literal') return '';
    const value = prompt.default.value;
    return prompt.control === REPORT_PROMPT_PERIOD_CONTROL
      ? (typeof value === 'string' ? value : '')
      : filterTextOf(value as CustomFieldValue);
  }, []);

  const effectiveText = useCallback(
    (prompt: ReportPrompt, values: Record<string, string>): string =>
      (Object.prototype.hasOwnProperty.call(values, prompt.key) ? values[prompt.key] : literalDefault(prompt)),
    [literalDefault],
  );

  /**
   * Os filtros como vão ao servidor. Vai NO TIPO DO CAMPO o que tem resposta. O filtro que o leitor
   * tocou e deixou vazio vai como `null` — "sem restrição", e o padrão não volta por cima dele —; o que
   * ninguém tocou e tem padrão por expressão nem vai, para o servidor resolver o padrão.
   *
   * Uma função só para a execução e para o detalhamento: o recorte detalhado TEM de ser o do número
   * clicado, com os mesmos filtros.
   */
  const promptPayload = useCallback((values: Record<string, string>): Record<string, unknown> => {
    const filled: Record<string, unknown> = {};
    for (const prompt of declaredPrompts) {
      const touched = Object.prototype.hasOwnProperty.call(values, prompt.key);
      if (!touched && prompt.default && prompt.default.kind !== 'Literal') continue;
      const text = effectiveText(prompt, values).trim();
      if (text === '') {
        if (touched) filled[prompt.key] = null;
        continue;
      }
      filled[prompt.key] = prompt.control === REPORT_PROMPT_PERIOD_CONTROL
        ? text
        : filterLiteralOf(fieldByPath(prompt.path), text);
    }
    return { ...filled, ...fixed };
  }, [declaredPrompts, effectiveText, fieldByPath, fixed]);

  const runWith = useCallback(async (values: Record<string, string>) => {
    if (!report) return;
    setIsLoading(true);
    setError(null);
    try {
      const filled = promptPayload(values);
      const outcome = await runReport({ reportId: report.id, prompts: filled });
      setResult(outcome.result);
      setIssues(outcome.issues ?? []);
      setError(outcome.error ? label(outcome.error, outcome.errorParams) : null);
    } catch (caught) {
      setResult(null);
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsLoading(false);
    }
  }, [report, promptPayload, runReport, label]);

  const run = useCallback(() => runWith(promptValues), [runWith, promptValues]);

  const reportTitle = report ? label(report.title) : '';

  const prompts = useMemo<ReportPromptField[]>(
    () => declaredPrompts.map((prompt) => {
      const name = prompt.label ? label(prompt.label) : prompt.path;
      const isPeriod = prompt.control === REPORT_PROMPT_PERIOD_CONTROL;
      const text = effectiveText(prompt, promptValues);
      return {
        key: prompt.key,
        label: prompt.required === true ? t('prompts.required', { label: name }) : name,
        field: isPeriod ? undefined : fieldByPath(prompt.path),
        value: isPeriod ? '' : filterValueOf(fieldByPath(prompt.path), text),
        isPeriod,
        periodValue: isPeriod ? text : '',
        required: prompt.required === true,
      };
    }),
    [declaredPrompts, fieldByPath, promptValues, label, effectiveText, t],
  );

  const missingRequired = useMemo(
    () => declaredPrompts.some((prompt) => prompt.required === true
      && !(prompt.default && prompt.default.kind !== 'Literal'
        && !Object.prototype.hasOwnProperty.call(promptValues, prompt.key))
      && effectiveText(prompt, promptValues).trim() === ''),
    [declaredPrompts, promptValues, effectiveText],
  );

  const periodOptions = useMemo(
    () => [
      { value: '', label: t('period.any') },
      ...REPORT_PERIODS.map((period) => ({ value: period, label: t(`period.${period}`) })),
    ],
    [t],
  );

  /**
   * Abrir a aba executa o relatório — MENOS quando ele pergunta algo a quem o abre.
   *
   * Executá-lo antes da resposta é gastar a varredura inteira do servidor para mostrar o que ninguém
   * pediu: o relatório que existe PARA ser filtrado por mês abria com o ano todo, e quem o abriu
   * esperava por um número que ia trocar. Com pergunta, a tela espera o gesto de executar; sem
   * pergunta, não há o que esperar.
   *
   * O `setState` síncrono é o `setIsLoading(true)` de dentro de `runWith` — ele PRECISA acontecer
   * antes do await, senão a tela fica parada sem dizer que está buscando.
   */
  /*
   * O relatório cujos filtros TODOS têm padrão também abre executado: o autor já escolheu o recorte
   * de abertura ("este mês"), e esperar o gesto seria pedir ao leitor que confirmasse o óbvio.
   */
  const opensAnswered = declaredPrompts.every((prompt) => prompt.default !== undefined);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- estado de carga antes da chamada
    if (opensAnswered) void runWith({});
  }, [opensAnswered, runWith]);

  // A aba passa a se chamar como o RELATÓRIO. É por esse nome que a pessoa reconhece a aba aberta —
  // "Relatório" é o nome do tipo, e três abas com o mesmo nome não se distinguem.
  useEffect(() => {
    if (tabKey && reportTitle) setTabTitle(tabKey, reportTitle);
  }, [tabKey, reportTitle, setTabTitle]);

  const warnings = useMemo(
    () => issues
      .filter((issue) => issue.severity === 'warning')
      .map((issue) => label(issue.error, issue.errorParams)),
    [issues, label],
  );

  // O aviso de PARCIAL só existe quando o resultado é parcial. Um relatório que não diz que é
  // parcial é a única falha deste desenho que o leitor não teria como notar.
  const partial = result && !result.complete
    ? t(result.totalsExact ? 'result.partial-total-exact' : 'result.partial', {
        scanned: formatters.formatNumber(result.scanned, { maximumFractionDigits: 0 }),
      })
    : (result && !result.completeGroups ? t('result.partial-groups') : null);

  const groupLabel = useReportGroupLabels(spec ?? EMPTY_SPEC);

  const drill = useCallback(async (target: ReportDrillTarget) => {
    if (!report) return;
    const path = [...target.keys, ...(target.column ?? [])];
    const title = path.length > 0
      ? path.map((entry) => groupLabel(entry)).join(' / ')
      : t('table.total');
    setDrillState({ title, records: [], matched: 0, loading: true });
    try {
      const outcome = await runReport({ reportId: report.id, prompts: promptPayload(promptValues), drill: target });
      if (outcome.error) {
        setDrillState(null);
        setError(label(outcome.error, outcome.errorParams));
        return;
      }
      setDrillState({
        title,
        records: outcome.drill?.records ?? [],
        matched: outcome.drill?.matched ?? 0,
        loading: false,
      });
    } catch (caught) {
      setDrillState(null);
      setError(caught instanceof Error ? label(caught.message) : String(caught));
    }
  }, [report, groupLabel, t, runReport, promptPayload, promptValues, label]);

  const exportAs = useReportExport(spec ?? EMPTY_SPEC, result, report ? label(report.title) : '');
  const offered = spec?.presentation?.export;

  return {
    report,
    spec,
    title: reportTitle,
    description: report?.description ? label(report.description) : null,
    result,
    isLoading,
    error,
    warnings,
    partial,
    meta: result ? t('result.meta', {
      count: formatters.formatNumber(result.scanned, { maximumFractionDigits: 0 }),
      at: formatters.formatDateTime(result.generatedAt),
    }) : null,
    run,
    prompts,
    setPromptValue: (key, value) =>
      setPromptValues((current) => ({ ...current, [key]: filterTextOf(value) })),
    setPromptPeriod: (key, period) =>
      setPromptValues((current) => ({ ...current, [key]: period })),
    periodOptions,
    canRun: !missingRequired,
    runLabel: t('prompts.run'),
    clearLabel: t('prompts.clear'),
    // Limpar é RESPONDER "sem restrição" a cada filtro — e não voltar aos padrões: quem limpa quer ver
    // tudo, e o padrão que reaparecesse desfaria o gesto.
    clearPrompts: () => setPromptValues(Object.fromEntries(declaredPrompts.map((prompt) => [prompt.key, '']))),
    hasPromptValues: declaredPrompts.some((prompt) => effectiveText(prompt, promptValues).trim() !== ''),
    exportLabel: t('toolbar.export'),
    exportXlsxLabel: t('toolbar.export-xlsx'),
    printLabel: t('toolbar.print'),
    canExport: result !== null,
    offersCsv: offered?.csv !== false,
    offersXlsx: offered?.xlsx !== false,
    offersPrint: offered?.pdf !== false,
    exportCsv: () => exportAs('csv'),
    exportXlsx: () => exportAs('xlsx'),
    // O navegador compõe a página e oferece "Salvar como PDF". A folha de impressão está no
    // `GlobalStyles`, e é ela que decide o que aparece no papel.
    print: () => window.print(),
    drill: spec && reportDrillEnabled(spec) ? (target) => { void drill(target); } : undefined,
    drillOpen: drillState !== null,
    drillTitle: drillState?.title ?? '',
    drillRecords: drillState?.records ?? [],
    drillMatched: drillState?.matched ?? 0,
    drillLoading: drillState?.loading === true,
    closeDrill: () => setDrillState(null),
    openDrillRecord: (recordId) => {
      if (spec) openRecord(spec.dataset.table, recordId);
    },
    showChrome: view === 'full',
    showChart: view !== 'table',
    showTable: view !== 'chart',
    // O pessoal fica fora das automações: a assinatura roda como sistema e avisa outras pessoas.
    canSubscribe: report !== undefined && !report.ownerId && can(PERMISSION_AUTOMATION_MANAGE),
    subscribeLabel: t('subscribe.action'),
    subscribeOpen,
    openSubscribe: () => setSubscribeOpen(true),
    closeSubscribe: () => setSubscribeOpen(false),
    subscribePrompts: subscribeOpen ? promptPayload(promptValues) : {},
  };
};
