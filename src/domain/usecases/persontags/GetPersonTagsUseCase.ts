import type { IPersonTagRepository } from '../../repositories/IPersonTagRepository';
import type { PersonTag } from '../../entities';

export type GetPersonTagsUseCase = {
  execute: (tenantId: string) => Promise<PersonTag[]>;
};

export const makeGetPersonTagsUseCase = (repo: IPersonTagRepository): GetPersonTagsUseCase => ({
  execute: (tenantId) => repo.getPersonTags(tenantId),
});
