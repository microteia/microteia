import type { Contract } from '../entities';

export interface IContractRepository {
  getContracts(tenantId: string): Promise<Contract[]>;
  getContractById(tenantId: string, contractId: string): Promise<Contract | null>;
  createContract(tenantId: string, data: Omit<Contract, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>): Promise<Contract>;
  updateContract(tenantId: string, contractId: string, data: Partial<Omit<Contract, 'id' | 'tenantId' | 'createdAt' | 'createdBy'>>): Promise<void>;
  updateContractTags(tenantId: string, contractId: string, tagIds: string[]): Promise<void>;
  deleteContract(tenantId: string, contractId: string): Promise<void>;
}
