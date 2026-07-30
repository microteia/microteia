import type { TagDefinition } from '../entities';

export type TagDefinitionInput = Omit<TagDefinition, 'createdAt'>;

/**
 * As coleções de etiquetas que ESTE tenant declarou. Nunca inclui as do kernel: aquelas são
 * declaração de código (`EntityMetadata.tagCollection`) e não têm documento.
 */
export interface ITagDefinitionRepository {
  subscribe(tenantId: string, onChange: (definitions: TagDefinition[]) => void): () => void;
  getAll(tenantId: string): Promise<TagDefinition[]>;
  upsert(tenantId: string, definition: TagDefinitionInput): Promise<TagDefinition>;
  /** Remove só a DECLARAÇÃO. As etiquetas já criadas ficam na coleção, prontas para reuso. */
  delete(tenantId: string, collection: string): Promise<void>;
}
