import type { Person } from '../../entities';
import type { IPersonRepository } from '../../repositories/IPersonRepository';

export type GetPersonsUseCase = {
  execute: (tenantId: string) => Promise<Person[]>;
};

export const makeGetPersonsUseCase = (repo: IPersonRepository): GetPersonsUseCase => ({
  execute: (tenantId) => repo.getPersons(tenantId),
});
