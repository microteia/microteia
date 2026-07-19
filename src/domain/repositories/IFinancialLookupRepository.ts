import type { FinancialLookupConfig, FinancialLookupKind } from '../entities';

export interface IFinancialLookupRepository {
  getAll(tenantId: string, kind: FinancialLookupKind): Promise<FinancialLookupConfig[]>;
  subscribe(tenantId: string, kind: FinancialLookupKind, onChange: (items: FinancialLookupConfig[]) => void): () => void;
  create(tenantId: string, kind: FinancialLookupKind, name: string, createdBy: string, color?: string): Promise<FinancialLookupConfig>;
  delete(tenantId: string, kind: FinancialLookupKind, key: string): Promise<void>;
}
