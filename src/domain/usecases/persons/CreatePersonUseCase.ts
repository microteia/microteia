import type { Person } from '../../entities';
import type { IPersonRepository } from '../../repositories/IPersonRepository';

export type CreatePersonUseCase = {
  execute: (tenantId: string, data: Omit<Person, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>) => Promise<Person>;
};

export const makeCreatePersonUseCase = (repo: IPersonRepository): CreatePersonUseCase => ({
  execute: (tenantId, data) => repo.createPerson(tenantId, data),
});
