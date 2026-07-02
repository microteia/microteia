import type { Financial, FinancialStatus } from '../../entities';
import type { IFinancialRepository } from '../../repositories/IFinancialRepository';

export type UpdateFinancialUseCase = {
  execute: (tenantId: string, financialId: string, data: Partial<Omit<Financial, 'id' | 'tenantId' | 'createdAt' | 'createdBy'>>) => Promise<void>;
};

export type MarkFinancialPaidUseCase = {
  execute: (tenantId: string, financialId: string, paymentDate: Date) => Promise<void>;
};

export type UpdateFinancialStatusUseCase = {
  execute: (tenantId: string, financialId: string, status: FinancialStatus, paymentDate?: Date) => Promise<void>;
};

export type CancelFinancialUseCase = {
  execute: (tenantId: string, financialId: string, cancelDate: Date) => Promise<void>;
};

export const makeUpdateFinancialUseCase = (repo: IFinancialRepository): UpdateFinancialUseCase => ({
  execute: (tenantId, financialId, data) => repo.updateFinancial(tenantId, financialId, data),
});

export const makeMarkFinancialPaidUseCase = (repo: IFinancialRepository): MarkFinancialPaidUseCase => ({
  execute: (tenantId, financialId, paymentDate) =>
    repo.updateFinancialStatus(tenantId, financialId, 'Pago', paymentDate),
});

export const makeUpdateFinancialStatusUseCase = (repo: IFinancialRepository): UpdateFinancialStatusUseCase => ({
  execute: (tenantId, financialId, status, paymentDate) =>
    repo.updateFinancialStatus(tenantId, financialId, status, paymentDate),
});

export const makeCancelFinancialUseCase = (repo: IFinancialRepository): CancelFinancialUseCase => ({
  execute: (tenantId, financialId, cancelDate) =>
    repo.cancelFinancial(tenantId, financialId, cancelDate),
});
