import { createContext, useContext } from 'react';
import type { ReportDefinition } from '../domain/entities/Report';
import type {
  ReportDefinitionInput,
  RunReportInput,
  RunReportResult,
} from '../domain/repositories/IReportDefinitionRepository';

export type ReportSaveInput = Omit<ReportDefinitionInput, 'createdBy' | 'ownerId'>;

export interface ReportDefinitionStoreState {
  reports: ReportDefinition[];
  isLoading: boolean;
  getReport: (key: string) => ReportDefinition | undefined;
  /** `personal` grava em `personalReports`, com quem está logado como autor; o `id` é então ignorado. */
  createReport: (data: ReportSaveInput, id?: string, options?: { personal?: boolean }) => Promise<ReportDefinition>;
  updateReport: (reportId: string, data: Partial<ReportSaveInput>) => Promise<void>;
  deleteReport: (reportId: string) => Promise<void>;
  /** Leva um relatório pessoal para os do escritório, com a chave `key`. */
  shareReport: (reportId: string, key: string) => Promise<void>;
  /** Executa no servidor. O `tenantId` é do escritório corrente — quem chama não o informa. */
  runReport: (input: Omit<RunReportInput, 'tenantId'>) => Promise<RunReportResult>;
  refresh: () => Promise<void>;
}

export const ReportDefinitionContext = createContext<ReportDefinitionStoreState | null>(null);

export const useReportDefinitions = (): ReportDefinitionStoreState => {
  const ctx = useContext(ReportDefinitionContext);
  if (!ctx) throw new Error('useReportDefinitions must be used within ReportDefinitionStoreProvider');
  return ctx;
};

/** O store QUANDO ele pode não existir — um relatório desenhado fora da pilha do escritório (testes, portal). */
export const useOptionalReportDefinitions = (): ReportDefinitionStoreState | null => useContext(ReportDefinitionContext);
