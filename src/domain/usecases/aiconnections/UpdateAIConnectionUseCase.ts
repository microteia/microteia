import type { AIConnectionData, IAIConnectionRepository } from '../../repositories/IAIConnectionRepository';

export type UpdateAIConnectionUseCase = {
  execute: (tenantId: string, id: string, data: Partial<AIConnectionData>, apiKey?: string) => Promise<void>;
};

export const makeUpdateAIConnectionUseCase = (repo: IAIConnectionRepository): UpdateAIConnectionUseCase => ({
  execute: (tenantId, id, data, apiKey) => repo.updateConnection(tenantId, id, data, apiKey),
});
