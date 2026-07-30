import type { LookupOption } from '../../entities';
import type { ILookupRepository } from '../../repositories/ILookupRepository';
import type {
  ILookupDefinitionRepository,
  LookupDefinitionInput,
} from '../../repositories/ILookupDefinitionRepository';
import type { LookupDefinition } from '../../entities';

export type SubscribeLookupOptionsUseCase = {
  execute: (tenantId: string, collection: string, onChange: (options: LookupOption[]) => void) => () => void;
};

export const makeSubscribeLookupOptionsUseCase = (repo: ILookupRepository): SubscribeLookupOptionsUseCase => ({
  execute: (tenantId, collection, onChange) => repo.subscribe(tenantId, collection, onChange),
});

export type AddLookupOptionUseCase = {
  execute: (tenantId: string, collection: string, option: LookupOption, createdBy: string) => Promise<LookupOption>;
};

export const makeAddLookupOptionUseCase = (repo: ILookupRepository): AddLookupOptionUseCase => ({
  execute: (tenantId, collection, option, createdBy) => repo.create(tenantId, collection, option, createdBy),
});

export type RemoveLookupOptionUseCase = {
  execute: (tenantId: string, collection: string, key: string) => Promise<void>;
};

export const makeRemoveLookupOptionUseCase = (repo: ILookupRepository): RemoveLookupOptionUseCase => ({
  execute: (tenantId, collection, key) => repo.delete(tenantId, collection, key),
});

export type SubscribeLookupDefinitionsUseCase = {
  execute: (tenantId: string, onChange: (definitions: LookupDefinition[]) => void) => () => void;
};

export const makeSubscribeLookupDefinitionsUseCase = (
  repo: ILookupDefinitionRepository,
): SubscribeLookupDefinitionsUseCase => ({
  execute: (tenantId, onChange) => repo.subscribe(tenantId, onChange),
});

export type DeclareLookupUseCase = {
  execute: (tenantId: string, definition: LookupDefinitionInput) => Promise<LookupDefinition>;
};

export const makeDeclareLookupUseCase = (repo: ILookupDefinitionRepository): DeclareLookupUseCase => ({
  execute: (tenantId, definition) => repo.upsert(tenantId, definition),
});

export type UndeclareLookupUseCase = {
  execute: (tenantId: string, collection: string) => Promise<void>;
};

/** Remove só a declaração — as opções continuam na coleção, prontas para quando a lista voltar. */
export const makeUndeclareLookupUseCase = (repo: ILookupDefinitionRepository): UndeclareLookupUseCase => ({
  execute: (tenantId, collection) => repo.delete(tenantId, collection),
});
