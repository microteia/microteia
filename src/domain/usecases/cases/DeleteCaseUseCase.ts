import type { ICaseRepository } from '../../repositories/ICaseRepository';
import type { DeletionActor } from '../../entities';

export type DeleteCaseUseCase = {
  execute: (tenantId: string, caseId: string, actor: DeletionActor) => Promise<void>;
};

export const makeDeleteCaseUseCase = (repo: ICaseRepository): DeleteCaseUseCase => ({
  execute: (tenantId, caseId, actor) => repo.deleteCase(tenantId, caseId, actor),
});
