import type { ICaseLookupRepository } from '../../repositories/ICaseLookupRepository';
import type { CaseLookupItem, CaseLookupKind } from '../../entities';

export type CreateCaseLookupUseCase = {
  execute: (tenantId: string, kind: CaseLookupKind, name: string, createdBy: string) => Promise<CaseLookupItem>;
};

export const makeCreateCaseLookupUseCase = (repo: ICaseLookupRepository): CreateCaseLookupUseCase => ({
  execute: (tenantId, kind, name, createdBy) => repo.createItem(tenantId, kind, name, createdBy),
});
