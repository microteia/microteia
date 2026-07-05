import type { Contract, DeletionActor } from '../entities';

export interface IContractRepository {
  getContracts(tenantId: string): Promise<Contract[]>;
  subscribeToContracts(tenantId: string, onUpdate: (contracts: Contract[]) => void): () => void;
  getContractById(tenantId: string, contractId: string): Promise<Contract | null>;
  createContract(tenantId: string, data: Omit<Contract, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>): Promise<Contract>;
  updateContract(tenantId: string, contractId: string, data: Partial<Omit<Contract, 'id' | 'tenantId' | 'createdAt' | 'createdBy'>>): Promise<void>;
  updateContractTags(tenantId: string, contractId: string, tagIds: string[]): Promise<void>;
  deleteContract(tenantId: string, contractId: string, actor: DeletionActor): Promise<void>;
}
