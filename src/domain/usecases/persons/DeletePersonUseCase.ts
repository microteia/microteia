import type { IPersonRepository } from '../../repositories/IPersonRepository';
import type { DeletionActor } from '../../entities';

export type DeletePersonUseCase = {
  execute: (tenantId: string, personId: string, actor: DeletionActor) => Promise<void>;
};

export const makeDeletePersonUseCase = (repo: IPersonRepository): DeletePersonUseCase => ({
  execute: (tenantId, personId, actor) => repo.deletePerson(tenantId, personId, actor),
});
