import type { ICaseLookupRepository } from '../../repositories/ICaseLookupRepository';
import type { CaseLookupItem, CaseLookupKind } from '../../entities';

export type GetCaseLookupUseCase = {
  execute: (tenantId: string, kind: CaseLookupKind) => Promise<CaseLookupItem[]>;
};

export const makeGetCaseLookupUseCase = (repo: ICaseLookupRepository): GetCaseLookupUseCase => ({
  execute: (tenantId, kind) => repo.getItems(tenantId, kind),
});
