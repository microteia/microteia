import type { CaseLookupItem, CaseLookupKind } from '../entities';

export interface ICaseLookupRepository {
  getItems(tenantId: string, kind: CaseLookupKind): Promise<CaseLookupItem[]>;
  createItem(tenantId: string, kind: CaseLookupKind, name: string, createdBy: string): Promise<CaseLookupItem>;
  deleteItem(tenantId: string, kind: CaseLookupKind, id: string): Promise<void>;
}
