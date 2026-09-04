import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLabel, useLocaleFormat, useT } from '../../../shared/i18n/useT';
import { useReportDefinitions } from '../../../../stores/useReportDefinitions';
import { useWorkspace } from '../../../../stores/useWorkspace';
import type { ReportDefinition } from '../../../../domain/entities/Report';
import type { ReportResult } from '../../../../domain/schema/report/reportResult';
import type { ReportPrompt, ReportSpec } from '../../../../domain/schema/report/reportSpec';
import { useReportPathOptions } from '../../../shared/report/useReportPathOptions';
import type { ReportSpecIssue } from '../../../../domain/schema/report/validateReportSpec';
import { useReportCsv } from '../../../shared/report/useReportCsv';

/** Um filtro que o LEITOR preenche, já com o que a tela precisa para desenhá-lo. */
export interface ReportPromptField {
  key: string;
  label: string;
  /** Campo de data usa o controle de data, como em qualquer outro lugar do produto. */
  isDate: boolean;
  value: string;
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
  setPromptValue: (key: string, value: string) => void;
  applyLabel: string;
  clearLabel: string;
  clearPrompts: () => void;
  hasPromptValues: boolean;
  exportLabel: string;
  printLabel: string;
  canExport: boolean;
  exportCsv: () => void;
  print: () => void;
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

export const useReportViewViewModel = (reportKey: string, tabKey?: string): ReportViewViewModel => {
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
  const [promptValues, setPromptValues] = useState<Record<string, string>>({});

  const run = useCallback(async () => {
    if (!report) return;
    setIsLoading(true);
    setError(null);
    try {
      // Só o que foi preenchido vai. Um filtro em branco não restringe nada — mandá-lo vazio faria
      // o servidor comparar com string vazia, que é uma pergunta diferente.
      const filled = Object.fromEntries(
        Object.entries(promptValues).filter(([, value]) => value.trim() !== ''),
      );
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
  }, [report, runReport, label, promptValues]);

  // O relatório é executado ao abrir a aba, e refeito quando ela troca de relatório. O `setState`
  // síncrono aqui é o `setIsLoading(true)` de dentro de `run` — ele PRECISA acontecer antes do
  // await, senão a tela fica parada sem dizer que está buscando.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- estado de carga antes da chamada
  useEffect(() => { void run(); }, [run]);

  const reportTitle = report ? label(report.title) : '';

  // Memoizado, e não derivado solto: um `?? []` cria um array novo a cada render, e o `useMemo`
  // abaixo passaria a recalcular sempre — refazendo a lista a cada tecla digitada num filtro.
  const declaredPrompts = useMemo<ReportPrompt[]>(
    () => spec?.presentation?.prompts ?? [],
    [spec],
  );
  const pathOptions = useReportPathOptions(spec?.dataset.table ?? '');

  const prompts = useMemo<ReportPromptField[]>(
    () => declaredPrompts.map((prompt) => ({
      key: prompt.key,
      label: prompt.label ? label(prompt.label) : prompt.path,
      isDate: pathOptions.find((option) => option.value === prompt.path)?.isDate === true,
      value: promptValues[prompt.key] ?? '',
    })),
    [declaredPrompts, pathOptions, promptValues, label],
  );

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
    ? t('result.partial', { scanned: formatters.formatNumber(result.scanned, { maximumFractionDigits: 0 }) })
    : (result && !result.completeGroups ? t('result.partial-groups') : null);

  const exportCsv = useReportCsv(spec ?? EMPTY_SPEC, result, report ? label(report.title) : '');

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
    setPromptValue: (key, value) => setPromptValues((current) => ({ ...current, [key]: value })),
    applyLabel: t('prompts.apply'),
    clearLabel: t('prompts.clear'),
    clearPrompts: () => setPromptValues({}),
    hasPromptValues: Object.values(promptValues).some((value) => value.trim() !== ''),
    exportLabel: t('toolbar.export'),
    printLabel: t('toolbar.print'),
    canExport: result !== null,
    exportCsv,
    // O navegador compõe a página e oferece "Salvar como PDF". A folha de impressão está no
    // `GlobalStyles`, e é ela que decide o que aparece no papel.
    print: () => window.print(),
  };
};
