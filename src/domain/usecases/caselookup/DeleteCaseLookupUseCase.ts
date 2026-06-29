import type { ICaseLookupRepository } from '../../repositories/ICaseLookupRepository';
import type { CaseLookupKind } from '../../entities';

export type DeleteCaseLookupUseCase = {
  execute: (tenantId: string, kind: CaseLookupKind, id: string) => Promise<void>;
};

export const makeDeleteCaseLookupUseCase = (repo: ICaseLookupRepository): DeleteCaseLookupUseCase => ({
  execute: (tenantId, kind, id) => repo.deleteItem(tenantId, kind, id),
});
