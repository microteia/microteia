import type { Person, PersonStatus, DeletionActor } from '../entities';

export interface IPersonRepository {
  getPersons(tenantId: string): Promise<Person[]>;
  subscribeToPersons(tenantId: string, onUpdate: (persons: Person[]) => void): () => void;
  getPersonById(tenantId: string, personId: string): Promise<Person | null>;
  createPerson(tenantId: string, data: Omit<Person, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>): Promise<Person>;
  updatePerson(tenantId: string, personId: string, data: Partial<Omit<Person, 'id' | 'tenantId' | 'createdAt' | 'createdBy'>>): Promise<void>;
  updatePersonStatus(tenantId: string, personId: string, status: PersonStatus): Promise<void>;
  updatePersonTags(tenantId: string, personId: string, tagIds: string[]): Promise<void>;
  deletePerson(tenantId: string, personId: string, actor: DeletionActor): Promise<void>;
}
