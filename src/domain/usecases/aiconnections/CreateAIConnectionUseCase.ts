import type { IAIConnectionRepository } from '../../repositories/IAIConnectionRepository';
import type { AIConnection } from '../../entities';

export type CreateAIConnectionUseCase = {
  execute: (tenantId: string, data: Omit<AIConnection, 'id' | 'tenantId' | 'createdAt'>) => Promise<AIConnection>;
};

export const makeCreateAIConnectionUseCase = (repo: IAIConnectionRepository): CreateAIConnectionUseCase => ({
  execute: (tenantId, data) => repo.createConnection(tenantId, data),
});
