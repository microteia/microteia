import type { PersonLookupConfig, PersonLookupKind } from '../entities';

export interface IPersonLookupRepository {
  getAll(tenantId: string, kind: PersonLookupKind): Promise<PersonLookupConfig[]>;
  create(tenantId: string, kind: PersonLookupKind, name: string, createdBy: string, color?: string): Promise<PersonLookupConfig>;
  delete(tenantId: string, kind: PersonLookupKind, key: string): Promise<void>;
}
