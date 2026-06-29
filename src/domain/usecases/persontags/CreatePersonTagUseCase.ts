import type { IPersonTagRepository } from '../../repositories/IPersonTagRepository';
import type { PersonTag } from '../../entities';

export type CreatePersonTagUseCase = {
  execute: (tenantId: string, data: Omit<PersonTag, 'id' | 'tenantId' | 'createdAt'>) => Promise<PersonTag>;
};

export const makeCreatePersonTagUseCase = (repo: IPersonTagRepository): CreatePersonTagUseCase => ({
  execute: (tenantId, data) => repo.createPersonTag(tenantId, data),
});
