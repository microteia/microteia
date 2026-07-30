import type { DeletionActor, Tag, TagDefinition } from '../../entities';
import type { ITagRepository, TagInput } from '../../repositories/ITagRepository';
import type { ITagDefinitionRepository, TagDefinitionInput } from '../../repositories/ITagDefinitionRepository';

export type SubscribeTagsUseCase = {
  execute: (tenantId: string, collection: string, onChange: (tags: Tag[]) => void) => () => void;
};

export const makeSubscribeTagsUseCase = (repo: ITagRepository): SubscribeTagsUseCase => ({
  execute: (tenantId, collection, onChange) => repo.subscribe(tenantId, collection, onChange),
});

export type CreateTagUseCase = {
  execute: (tenantId: string, collection: string, data: TagInput) => Promise<Tag>;
};

export const makeCreateTagUseCase = (repo: ITagRepository): CreateTagUseCase => ({
  execute: (tenantId, collection, data) => repo.create(tenantId, collection, data),
});

export type UpdateTagUseCase = {
  execute: (tenantId: string, collection: string, tagId: string, data: { name: string; color: string }) => Promise<void>;
};

export const makeUpdateTagUseCase = (repo: ITagRepository): UpdateTagUseCase => ({
  execute: (tenantId, collection, tagId, data) => repo.update(tenantId, collection, tagId, data),
});

export type DeleteTagUseCase = {
  execute: (tenantId: string, collection: string, tagId: string, actor: DeletionActor) => Promise<void>;
};

export const makeDeleteTagUseCase = (repo: ITagRepository): DeleteTagUseCase => ({
  execute: (tenantId, collection, tagId, actor) => repo.delete(tenantId, collection, tagId, actor),
});

export type SubscribeTagDefinitionsUseCase = {
  execute: (tenantId: string, onChange: (definitions: TagDefinition[]) => void) => () => void;
};

export const makeSubscribeTagDefinitionsUseCase = (
  repo: ITagDefinitionRepository,
): SubscribeTagDefinitionsUseCase => ({
  execute: (tenantId, onChange) => repo.subscribe(tenantId, onChange),
});

export type DeclareTagListUseCase = {
  execute: (tenantId: string, definition: TagDefinitionInput) => Promise<TagDefinition>;
};

export const makeDeclareTagListUseCase = (repo: ITagDefinitionRepository): DeclareTagListUseCase => ({
  execute: (tenantId, definition) => repo.upsert(tenantId, definition),
});

export type UndeclareTagListUseCase = {
  execute: (tenantId: string, collection: string) => Promise<void>;
};

/** Remove só a declaração — as etiquetas continuam na coleção, prontas para quando a tela voltar. */
export const makeUndeclareTagListUseCase = (repo: ITagDefinitionRepository): UndeclareTagListUseCase => ({
  execute: (tenantId, collection) => repo.delete(tenantId, collection),
});
