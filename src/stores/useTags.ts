import { createContext, useContext } from 'react';
import type { Tag, TagDefinition } from '../domain/entities';
import type { SchemaTagList } from '../domain/schema/screenEntity';

export interface TagStoreState {
  /** Etiquetas por nome de coleção — do kernel e do tenant, no mesmo mapa. */
  tagsByCollection: Record<string, Tag[]>;
  /** Só os conjuntos declarados por ESTE tenant. Os do kernel vivem no `ENTITY_REGISTRY`. */
  definitions: TagDefinition[];
  /** Todos os conjuntos disponíveis, para o seletor do Form Design e para o `SchemaContext`. */
  availableTagLists: SchemaTagList[];
  getTags: (collection: string) => Tag[];
  createTag: (collection: string, name: string, color: string) => Promise<Tag>;
  updateTag: (collection: string, tagId: string, data: { name: string; color: string }) => Promise<void>;
  deleteTag: (collection: string, tagId: string) => Promise<void>;
  declareTagList: (collection: string, label: string) => Promise<void>;
}

export const TagContext = createContext<TagStoreState | null>(null);

export const useTags = (): TagStoreState => {
  const ctx = useContext(TagContext);
  if (!ctx) throw new Error('useTags must be used within TagStoreProvider');
  return ctx;
};
