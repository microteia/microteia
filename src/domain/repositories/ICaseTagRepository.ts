import type { CaseTag } from '../entities';

export interface ICaseTagRepository {
  getCaseTags(tenantId: string): Promise<CaseTag[]>;
  createCaseTag(tenantId: string, data: Omit<CaseTag, 'id' | 'tenantId' | 'createdAt'>): Promise<CaseTag>;
  updateCaseTag(tenantId: string, tagId: string, data: { name: string; color: string }): Promise<void>;
  deleteCaseTag(tenantId: string, tagId: string): Promise<void>;
}
