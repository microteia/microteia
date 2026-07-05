import type { Person } from '../../entities';
import type { IPersonRepository } from '../../repositories/IPersonRepository';

export type SubscribeToPersonsUseCase = {
  execute: (tenantId: string, onUpdate: (persons: Person[]) => void) => () => void;
};

export const makeSubscribeToPersonsUseCase = (repo: IPersonRepository): SubscribeToPersonsUseCase => ({
  execute: (tenantId, onUpdate) => repo.subscribeToPersons(tenantId, onUpdate),
});
