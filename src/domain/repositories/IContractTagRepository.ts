import type { ContractTag, DeletionActor } from '../entities';

export interface IContractTagRepository {
  getContractTags(tenantId: string): Promise<ContractTag[]>;
  createContractTag(tenantId: string, data: Omit<ContractTag, 'id' | 'tenantId' | 'createdAt'>): Promise<ContractTag>;
  updateContractTag(tenantId: string, tagId: string, data: { name: string; color: string }): Promise<void>;
  deleteContractTag(tenantId: string, tagId: string, actor: DeletionActor): Promise<void>;
}
