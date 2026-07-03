import type { ICaseRepository } from '../../repositories/ICaseRepository';
import type { IDeadlineRepository } from '../../repositories/IDeadlineRepository';
import type { IFinancialRepository } from '../../repositories/IFinancialRepository';
import type { DeletionActor } from '../../entities';

export type DeleteCaseUseCase = {
  execute: (tenantId: string, caseId: string, actor: DeletionActor) => Promise<void>;
};

export const makeDeleteCaseUseCase = (
  repo: ICaseRepository,
  deadlineRepo: IDeadlineRepository,
  financialRepo: IFinancialRepository,
): DeleteCaseUseCase => ({
  execute: async (tenantId, caseId, actor) => {
    const [deadlines, financials] = await Promise.all([
      deadlineRepo.getDeadlinesByCase(tenantId, caseId),
      financialRepo.getFinancialsByCase(tenantId, caseId),
    ]);
    await Promise.all([
      ...deadlines.map((d) => deadlineRepo.deleteDeadline(tenantId, d.id, actor)),
      ...financials.map((f) => financialRepo.deleteFinancial(tenantId, f.id, actor)),
    ]);
    await repo.deleteCase(tenantId, caseId, actor);
  },
});
