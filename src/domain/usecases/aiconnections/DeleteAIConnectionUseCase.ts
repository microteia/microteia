import type { IAIConnectionRepository } from '../../repositories/IAIConnectionRepository';

export type DeleteAIConnectionUseCase = {
  execute: (tenantId: string, id: string) => Promise<void>;
};

export const makeDeleteAIConnectionUseCase = (repo: IAIConnectionRepository): DeleteAIConnectionUseCase => ({
  execute: (tenantId, id) => repo.deleteConnection(tenantId, id),
});
