import { createContext, useContext } from 'react';
import type { ReportDefinition } from '../domain/entities/Report';
import type {
  ReportDefinitionInput,
  RunReportInput,
  RunReportResult,
} from '../domain/repositories/IReportDefinitionRepository';

export type ReportSaveInput = Omit<ReportDefinitionInput, 'createdBy'>;

export interface ReportDefinitionStoreState {
  reports: ReportDefinition[];
  isLoading: boolean;
  getReport: (key: string) => ReportDefinition | undefined;
  createReport: (data: ReportSaveInput, id?: string) => Promise<ReportDefinition>;
  updateReport: (reportId: string, data: Partial<ReportSaveInput>) => Promise<void>;
  deleteReport: (reportId: string) => Promise<void>;
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
