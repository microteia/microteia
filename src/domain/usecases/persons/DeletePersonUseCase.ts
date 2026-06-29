import type { IPersonRepository } from '../../repositories/IPersonRepository';

export type DeletePersonUseCase = {
  execute: (tenantId: string, personId: string) => Promise<void>;
};

export const makeDeletePersonUseCase = (repo: IPersonRepository): DeletePersonUseCase => ({
  execute: (tenantId, personId) => repo.deletePerson(tenantId, personId),
});
