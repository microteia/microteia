import type { Person } from '../../entities';
import type { IPersonRepository } from '../../repositories/IPersonRepository';

export type UpdatePersonUseCase = {
  execute: (tenantId: string, personId: string, data: Partial<Omit<Person, 'id' | 'tenantId' | 'createdAt' | 'createdBy'>>) => Promise<void>;
};

export const makeUpdatePersonUseCase = (repo: IPersonRepository): UpdatePersonUseCase => ({
  execute: (tenantId, personId, data) => repo.updatePerson(tenantId, personId, data),
});
