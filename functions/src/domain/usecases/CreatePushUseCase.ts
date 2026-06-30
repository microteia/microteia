import type { Push } from '../entities/Push';
import type { IPushRepository } from '../repositories/IPushRepository';

export type CreatePushUseCase = {
  execute: (tenantId: string, push: Omit<Push, 'id' | 'tenantId' | 'createdAt'>) => Promise<Push>;
};

export const makeCreatePushUseCase = (repo: IPushRepository): CreatePushUseCase => ({
  execute: (tenantId, push) => repo.create(tenantId, push),
});
