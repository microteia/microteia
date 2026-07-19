import type { PersonLookupConfig, PersonLookupKind } from '../entities';

export interface IPersonLookupRepository {
  getAll(tenantId: string, kind: PersonLookupKind): Promise<PersonLookupConfig[]>;
  subscribe(tenantId: string, kind: PersonLookupKind, onChange: (items: PersonLookupConfig[]) => void): () => void;
  create(tenantId: string, kind: PersonLookupKind, name: string, createdBy: string, color?: string): Promise<PersonLookupConfig>;
  delete(tenantId: string, kind: PersonLookupKind, key: string): Promise<void>;
}
