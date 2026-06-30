import type { Push } from '../entities/Push';
import type { IPushRepository } from '../repositories/IPushRepository';

export type UpdatePushUseCase = {
  execute: (
    tenantId: string,
    pushId: string,
    updates: Partial<Omit<Push, 'id' | 'tenantId' | 'createdAt' | 'createdBy'>>
  ) => Promise<void>;
};

export const makeUpdatePushUseCase = (repo: IPushRepository): UpdatePushUseCase => ({
  execute: (tenantId, pushId, updates) => repo.update(tenantId, pushId, updates),
});
