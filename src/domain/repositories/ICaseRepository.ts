import type { Case, CaseStatus, DeletionActor } from '../entities';

export interface ICaseRepository {
  getCases(tenantId: string): Promise<Case[]>;
  getCasesByPerson(tenantId: string, personId: string): Promise<Case[]>;
  getCaseById(tenantId: string, caseId: string): Promise<Case | null>;
  createCase(tenantId: string, data: Omit<Case, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>): Promise<Case>;
  updateCase(tenantId: string, caseId: string, data: Partial<Omit<Case, 'id' | 'tenantId' | 'createdAt' | 'createdBy'>>): Promise<void>;
  updateCaseStatus(tenantId: string, caseId: string, status: CaseStatus): Promise<void>;
  deleteCase(tenantId: string, caseId: string, actor: DeletionActor): Promise<void>;
  unlinkCasesFromContract(tenantId: string, contractId: string): Promise<void>;
}
