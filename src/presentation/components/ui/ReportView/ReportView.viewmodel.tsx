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
import { useReportCsv } from '../../../shared/report/useReportCsv';

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
  runLabel: string;
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

  // Memoizado, e não derivado solto: um `?? []` cria um array novo a cada render, e o `useMemo`
  // abaixo passaria a recalcular sempre — refazendo a lista a cada tecla digitada num filtro.
  const declaredPrompts = useMemo<ReportPrompt[]>(
    () => spec?.presentation?.prompts ?? [],
    [spec],
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
  const runWith = useCallback(async (values: Record<string, string>) => {
    if (!report) return;
    setIsLoading(true);
    setError(null);
    try {
      // Só o que foi preenchido vai, e vai NO TIPO DO CAMPO. Um filtro em branco não restringe nada
      // — mandá-lo vazio faria o servidor comparar com string vazia, que é outra pergunta; e mandar
      // "true" onde o documento guarda um booleano não encontra nada, sem uma palavra na tela.
      const filled: Record<string, unknown> = {};
      for (const prompt of declaredPrompts) {
        const text = (values[prompt.key] ?? '').trim();
        if (text !== '') filled[prompt.key] = filterLiteralOf(fieldByPath(prompt.path), text);
      }
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
  }, [report, declaredPrompts, fieldByPath, runReport, label]);

  const run = useCallback(() => runWith(promptValues), [runWith, promptValues]);

  const reportTitle = report ? label(report.title) : '';

  const prompts = useMemo<ReportPromptField[]>(
    () => declaredPrompts.map((prompt) => ({
      key: prompt.key,
      label: prompt.label ? label(prompt.label) : prompt.path,
      field: fieldByPath(prompt.path),
      value: filterValueOf(fieldByPath(prompt.path), promptValues[prompt.key] ?? ''),
    })),
    [declaredPrompts, fieldByPath, promptValues, label],
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
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- estado de carga antes da chamada
    if (declaredPrompts.length === 0) void runWith({});
  }, [declaredPrompts, runWith]);

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
    setPromptValue: (key, value) =>
      setPromptValues((current) => ({ ...current, [key]: filterTextOf(value) })),
    runLabel: t('prompts.run'),
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
