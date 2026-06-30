import type { IPushRepository } from '../../repositories/IPushRepository';
import type { Push } from '../../entities';

export type GetPushesUseCase = {
  execute: (tenantId: string) => Promise<Push[]>;
};

export const makeGetPushesUseCase = (repo: IPushRepository): GetPushesUseCase => ({
  execute: (tenantId) => repo.getPushes(tenantId),
});
