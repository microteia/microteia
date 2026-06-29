import type { IAIConnectionRepository } from '../../repositories/IAIConnectionRepository';
import type { AIConnection } from '../../entities';

export type UpdateAIConnectionUseCase = {
  execute: (tenantId: string, id: string, data: Partial<Omit<AIConnection, 'id' | 'tenantId' | 'createdAt'>>) => Promise<void>;
};

export const makeUpdateAIConnectionUseCase = (repo: IAIConnectionRepository): UpdateAIConnectionUseCase => ({
  execute: (tenantId, id, data) => repo.updateConnection(tenantId, id, data),
});
