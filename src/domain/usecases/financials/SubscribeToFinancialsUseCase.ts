import type { Financial } from '../../entities';
import type { IFinancialRepository } from '../../repositories/IFinancialRepository';

export type SubscribeToFinancialsUseCase = {
  execute: (tenantId: string, onUpdate: (financials: Financial[]) => void) => () => void;
};

export const makeSubscribeToFinancialsUseCase = (repo: IFinancialRepository): SubscribeToFinancialsUseCase => ({
  execute: (tenantId, onUpdate) => repo.subscribeToFinancials(tenantId, onUpdate),
});
