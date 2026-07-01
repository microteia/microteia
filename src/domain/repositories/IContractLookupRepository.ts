import type { ContractLookupConfig, ContractLookupKind } from '../entities';

export interface IContractLookupRepository {
  getAll(tenantId: string, kind: ContractLookupKind): Promise<ContractLookupConfig[]>;
  create(tenantId: string, kind: ContractLookupKind, name: string, createdBy: string, color?: string): Promise<ContractLookupConfig>;
  delete(tenantId: string, kind: ContractLookupKind, key: string): Promise<void>;
}
