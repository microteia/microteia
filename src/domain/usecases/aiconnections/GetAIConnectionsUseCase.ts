import type { IAIConnectionRepository } from '../../repositories/IAIConnectionRepository';
import type { AIConnection } from '../../entities';

export type GetAIConnectionsUseCase = {
  execute: (tenantId: string) => Promise<AIConnection[]>;
};

export const makeGetAIConnectionsUseCase = (repo: IAIConnectionRepository): GetAIConnectionsUseCase => ({
  execute: (tenantId) => repo.getConnections(tenantId),
});
