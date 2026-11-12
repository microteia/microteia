import type { ReportDefinition } from '../../entities/Report';
import type {
  IReportDefinitionRepository,
  ReportDefinitionInput,
  RunReportInput,
  RunReportResult,
} from '../../repositories/IReportDefinitionRepository';
import type { IPersonalReportRepository, PersonalReportInput } from '../../repositories/IPersonalReportRepository';

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

export type SubscribeToPersonalReportsUseCase = {
  execute: (tenantId: string, ownerId: string, onUpdate: (reports: ReportDefinition[]) => void) => () => void;
};

export const makeSubscribeToPersonalReportsUseCase = (
  repo: IPersonalReportRepository,
): SubscribeToPersonalReportsUseCase => ({
  execute: (tenantId, ownerId, onUpdate) => repo.subscribe(tenantId, ownerId, onUpdate),
});

export type GetPersonalReportsUseCase = {
  execute: (tenantId: string, ownerId: string) => Promise<ReportDefinition[]>;
};

export const makeGetPersonalReportsUseCase = (repo: IPersonalReportRepository): GetPersonalReportsUseCase => ({
  execute: (tenantId, ownerId) => repo.getAll(tenantId, ownerId),
});

export type CreatePersonalReportUseCase = {
  execute: (tenantId: string, ownerId: string, data: PersonalReportInput) => Promise<ReportDefinition>;
};

export const makeCreatePersonalReportUseCase = (repo: IPersonalReportRepository): CreatePersonalReportUseCase => ({
  execute: (tenantId, ownerId, data) => repo.create(tenantId, ownerId, data),
});

export type UpdatePersonalReportUseCase = {
  execute: (tenantId: string, reportId: string, data: Partial<PersonalReportInput>) => Promise<void>;
};

export const makeUpdatePersonalReportUseCase = (repo: IPersonalReportRepository): UpdatePersonalReportUseCase => ({
  execute: (tenantId, reportId, data) => repo.update(tenantId, reportId, data),
});

export type DeletePersonalReportUseCase = {
  execute: (tenantId: string, reportId: string) => Promise<void>;
};

export const makeDeletePersonalReportUseCase = (repo: IPersonalReportRepository): DeletePersonalReportUseCase => ({
  execute: (tenantId, reportId) => repo.delete(tenantId, reportId),
});

export type SharePersonalReportUseCase = {
  execute: (tenantId: string, reportId: string, key: string) => Promise<void>;
};

export const makeSharePersonalReportUseCase = (repo: IPersonalReportRepository): SharePersonalReportUseCase => ({
  execute: (tenantId, reportId, key) => repo.share(tenantId, reportId, key),
});
