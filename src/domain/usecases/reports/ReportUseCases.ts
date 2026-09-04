import type { ReportDefinition } from '../../entities/Report';
import type {
  IReportDefinitionRepository,
  ReportDefinitionInput,
  RunReportInput,
  RunReportResult,
} from '../../repositories/IReportDefinitionRepository';

export type GetReportsUseCase = {
  execute: (tenantId: string) => Promise<ReportDefinition[]>;
};

export const makeGetReportsUseCase = (repo: IReportDefinitionRepository): GetReportsUseCase => ({
  execute: (tenantId) => repo.getAll(tenantId),
});

export type SubscribeToReportsUseCase = {
  execute: (tenantId: string, onUpdate: (reports: ReportDefinition[]) => void) => () => void;
};

export const makeSubscribeToReportsUseCase = (
  repo: IReportDefinitionRepository,
): SubscribeToReportsUseCase => ({
  execute: (tenantId, onUpdate) => repo.subscribeToReports(tenantId, onUpdate),
});

export type CreateReportUseCase = {
  execute: (tenantId: string, data: ReportDefinitionInput, id?: string) => Promise<ReportDefinition>;
};

export const makeCreateReportUseCase = (repo: IReportDefinitionRepository): CreateReportUseCase => ({
  execute: (tenantId, data, id) => repo.create(tenantId, data, id),
});

export type UpdateReportUseCase = {
  execute: (tenantId: string, reportId: string, data: Partial<ReportDefinitionInput>) => Promise<void>;
};

export const makeUpdateReportUseCase = (repo: IReportDefinitionRepository): UpdateReportUseCase => ({
  execute: (tenantId, reportId, data) => repo.update(tenantId, reportId, data),
});

export type DeleteReportUseCase = {
  execute: (tenantId: string, reportId: string) => Promise<void>;
};

export const makeDeleteReportUseCase = (repo: IReportDefinitionRepository): DeleteReportUseCase => ({
  execute: (tenantId, reportId) => repo.delete(tenantId, reportId),
});

export type RunReportUseCase = {
  execute: (input: RunReportInput) => Promise<RunReportResult>;
};

export const makeRunReportUseCase = (repo: IReportDefinitionRepository): RunReportUseCase => ({
  execute: (input) => repo.runReport(input),
});
