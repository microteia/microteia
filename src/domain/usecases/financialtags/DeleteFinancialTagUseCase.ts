import type { IFinancialTagRepository } from '../../repositories/IFinancialTagRepository';
import type { DeletionActor } from '../../entities';

export type DeleteFinancialTagUseCase = {
  execute: (tenantId: string, tagId: string, actor: DeletionActor) => Promise<void>;
};

export const makeDeleteFinancialTagUseCase = (repo: IFinancialTagRepository): DeleteFinancialTagUseCase => ({
  execute: (tenantId, tagId, actor) => repo.deleteFinancialTag(tenantId, tagId, actor),
});
