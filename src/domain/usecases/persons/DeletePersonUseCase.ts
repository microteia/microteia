import type { IPersonRepository } from '../../repositories/IPersonRepository';
import type { ICaseRepository } from '../../repositories/ICaseRepository';
import type { IDeadlineRepository } from '../../repositories/IDeadlineRepository';
import type { IFinancialRepository } from '../../repositories/IFinancialRepository';
import type { DeletionActor } from '../../entities';

export type DeletePersonUseCase = {
  execute: (tenantId: string, personId: string, actor: DeletionActor) => Promise<void>;
};

export const makeDeletePersonUseCase = (
  repo: IPersonRepository,
  caseRepo: ICaseRepository,
  deadlineRepo: IDeadlineRepository,
  financialRepo: IFinancialRepository,
): DeletePersonUseCase => ({
  execute: async (tenantId, personId, actor) => {
    const cases = await caseRepo.getCasesByPerson(tenantId, personId);
    for (const c of cases) {
      const [deadlines, financials] = await Promise.all([
        deadlineRepo.getDeadlinesByCase(tenantId, c.id),
        financialRepo.getFinancialsByCase(tenantId, c.id),
      ]);
      await Promise.all([
        ...deadlines.map((d) => deadlineRepo.deleteDeadline(tenantId, d.id, actor)),
        ...financials.map((f) => financialRepo.deleteFinancial(tenantId, f.id, actor)),
      ]);
      await caseRepo.deleteCase(tenantId, c.id, actor);
    }

    const personFinancials = await financialRepo.getFinancialsByPerson(tenantId, personId);
    await Promise.all(personFinancials.map((f) => financialRepo.deleteFinancial(tenantId, f.id, actor)));

    await repo.deletePerson(tenantId, personId, actor);
  },
});
