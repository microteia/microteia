import { useCallback, useEffect, useState } from 'react';
import { useReportDefinitions } from '../../../stores/useReportDefinitions';
import type { ReportDefinition } from '../../../domain/entities/Report';
import type { ReportResult } from '../../../domain/schema/report/reportResult';
import type { ReportSpecIssue } from '../../../domain/schema/report/validateReportSpec';

export interface UseReportResult {
  report: ReportDefinition | undefined;
  result: ReportResult | null;
  issues: ReportSpecIssue[];
  isLoading: boolean;
  /** REFERÊNCIA de mensagem, ou `null`. Quem mostra resolve com `useLabel`. */
  error: string | null;
  errorParams?: Record<string, string>;
  /** Roda de novo — com outros valores de filtro, por exemplo. */
  run: (prompts?: Record<string, unknown>) => Promise<void>;
}

/**
 * Executa um relatório do catálogo, pela CHAVE dele.
 *
 * É a única porta pela qual um relatório escrito em código recebe números, e é de propósito: cada
 * execução é uma chamada ao servidor, onde a leitura de cada coleção que o relatório toca é cobrada.
 * Um autor que pudesse buscar as linhas por conta própria escaparia disso.
 */
export const useReport = (
  reportKey: string,
  prompts?: Record<string, unknown>,
): UseReportResult => {
  const { getReport, runReport } = useReportDefinitions();
  const report = getReport(reportKey);

  const [result, setResult] = useState<ReportResult | null>(null);
  const [issues, setIssues] = useState<ReportSpecIssue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [errorParams, setErrorParams] = useState<Record<string, string> | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);

  const run = useCallback(async (override?: Record<string, unknown>) => {
    if (!report) return;
    setIsLoading(true);
    setError(null);
    try {
      const outcome = await runReport({ reportId: report.id, prompts: override ?? prompts });
      setResult(outcome.result);
      setIssues(outcome.issues ?? []);
      setError(outcome.error);
      setErrorParams(outcome.errorParams);
    } catch (caught) {
      setResult(null);
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsLoading(false);
    }
  }, [report, runReport, prompts]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- estado de carga antes da chamada
  useEffect(() => { void run(); }, [run]);

  return { report, result, issues, isLoading, error, errorParams, run };
};
