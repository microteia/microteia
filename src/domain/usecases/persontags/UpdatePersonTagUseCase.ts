import type { IPersonTagRepository } from '../../repositories/IPersonTagRepository';

export type UpdatePersonTagUseCase = {
  execute: (tenantId: string, tagId: string, data: { name: string; color: string }) => Promise<void>;
};

export const makeUpdatePersonTagUseCase = (repo: IPersonTagRepository): UpdatePersonTagUseCase => ({
  execute: (tenantId, tagId, data) => repo.updatePersonTag(tenantId, tagId, data),
});
