import type { IPersonTagRepository } from '../../repositories/IPersonTagRepository';

export type DeletePersonTagUseCase = {
  execute: (tenantId: string, tagId: string) => Promise<void>;
};

export const makeDeletePersonTagUseCase = (repo: IPersonTagRepository): DeletePersonTagUseCase => ({
  execute: (tenantId, tagId) => repo.deletePersonTag(tenantId, tagId),
});
