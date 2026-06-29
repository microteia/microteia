import type { Deadline, DeadlineStatus } from '../../entities';
import type { IDeadlineRepository } from '../../repositories/IDeadlineRepository';

export type UpdateDeadlineUseCase = {
  execute: (tenantId: string, deadlineId: string, data: Partial<Omit<Deadline, 'id' | 'tenantId' | 'createdAt' | 'createdBy'>>) => Promise<void>;
};

export type CompleteDeadlineUseCase = {
  execute: (tenantId: string, deadlineId: string, completedBy: string) => Promise<void>;
};

export type UpdateDeadlineStatusUseCase = {
  execute: (tenantId: string, deadlineId: string, status: DeadlineStatus) => Promise<void>;
};

export const makeUpdateDeadlineUseCase = (repo: IDeadlineRepository): UpdateDeadlineUseCase => ({
  execute: (tenantId, deadlineId, data) => repo.updateDeadline(tenantId, deadlineId, data),
});

export const makeCompleteDeadlineUseCase = (repo: IDeadlineRepository): CompleteDeadlineUseCase => ({
  execute: (tenantId, deadlineId, completedBy) =>
    repo.updateDeadlineStatus(tenantId, deadlineId, 'Concluído', completedBy),
});

export const makeUpdateDeadlineStatusUseCase = (repo: IDeadlineRepository): UpdateDeadlineStatusUseCase => ({
  execute: (tenantId, deadlineId, status) => repo.updateDeadlineStatus(tenantId, deadlineId, status),
});
