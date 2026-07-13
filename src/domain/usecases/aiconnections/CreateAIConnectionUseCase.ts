import type { AIConnectionData, IAIConnectionRepository } from '../../repositories/IAIConnectionRepository';
import type { AIConnection } from '../../entities';

export type CreateAIConnectionUseCase = {
  execute: (tenantId: string, data: AIConnectionData, apiKey: string) => Promise<AIConnection>;
};

export const makeCreateAIConnectionUseCase = (repo: IAIConnectionRepository): CreateAIConnectionUseCase => ({
  execute: (tenantId, data, apiKey) => repo.createConnection(tenantId, data, apiKey),
});
