import type { Deadline } from '../../entities';
import type { IDeadlineRepository } from '../../repositories/IDeadlineRepository';

export type CreateDeadlineUseCase = {
  execute: (tenantId: string, data: Omit<Deadline, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>) => Promise<Deadline>;
};

export const makeCreateDeadlineUseCase = (repo: IDeadlineRepository): CreateDeadlineUseCase => ({
  execute: (tenantId, data) => repo.createDeadline(tenantId, data),
});
