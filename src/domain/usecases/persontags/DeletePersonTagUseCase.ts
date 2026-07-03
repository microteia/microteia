import type { IPersonTagRepository } from '../../repositories/IPersonTagRepository';
import type { DeletionActor } from '../../entities';

export type DeletePersonTagUseCase = {
  execute: (tenantId: string, tagId: string, actor: DeletionActor) => Promise<void>;
};

export const makeDeletePersonTagUseCase = (repo: IPersonTagRepository): DeletePersonTagUseCase => ({
  execute: (tenantId, tagId, actor) => repo.deletePersonTag(tenantId, tagId, actor),
});
