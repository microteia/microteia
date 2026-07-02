import type { Financial, FinancialStatus, FinancialType } from '../entities';

export interface IFinancialRepository {
  getFinancials(tenantId: string): Promise<Financial[]>;
  getFinancialsByCase(tenantId: string, caseId: string): Promise<Financial[]>;
  getFinancialsByType(tenantId: string, type: FinancialType): Promise<Financial[]>;
  getFinancialById(tenantId: string, financialId: string): Promise<Financial | null>;
  createFinancial(tenantId: string, data: Omit<Financial, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>): Promise<Financial>;
  updateFinancial(tenantId: string, financialId: string, data: Partial<Omit<Financial, 'id' | 'tenantId' | 'createdAt' | 'createdBy'>>): Promise<void>;
  updateFinancialStatus(tenantId: string, financialId: string, status: FinancialStatus, paymentDate?: Date): Promise<void>;
  updateFinancialTags(tenantId: string, financialId: string, tagIds: string[]): Promise<void>;
  cancelFinancial(tenantId: string, financialId: string, cancelDate: Date): Promise<void>;
  deleteFinancial(tenantId: string, financialId: string): Promise<void>;
  unlinkFinancialsFromContract(tenantId: string, contractId: string): Promise<void>;
}
