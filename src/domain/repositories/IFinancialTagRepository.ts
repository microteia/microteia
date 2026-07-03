import type { FinancialTag, DeletionActor } from '../entities';

export interface IFinancialTagRepository {
  getFinancialTags(tenantId: string): Promise<FinancialTag[]>;
  createFinancialTag(tenantId: string, data: Omit<FinancialTag, 'id' | 'tenantId' | 'createdAt'>): Promise<FinancialTag>;
  updateFinancialTag(tenantId: string, tagId: string, data: { name: string; color: string }): Promise<void>;
  deleteFinancialTag(tenantId: string, tagId: string, actor: DeletionActor): Promise<void>;
}
