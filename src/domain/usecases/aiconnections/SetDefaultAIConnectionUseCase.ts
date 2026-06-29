import type { IAIConnectionRepository } from '../../repositories/IAIConnectionRepository';

export type SetDefaultAIConnectionUseCase = {
  execute: (tenantId: string, id: string) => Promise<void>;
};

export const makeSetDefaultAIConnectionUseCase = (repo: IAIConnectionRepository): SetDefaultAIConnectionUseCase => ({
  execute: (tenantId, id) => repo.setDefault(tenantId, id),
});
