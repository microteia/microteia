import type { DeletionActor, Tag } from '../entities';

export type TagInput = Pick<Tag, 'name' | 'color'> & Partial<Pick<Tag, 'createdBy' | 'createdByName' | 'createdByPhotoURL'>>;

/**
 * Etiquetas de UMA coleção. Um repositório só serve a do kernel (`caseTags`), a de uma tela do Form
 * Design e a de extensão — a origem não muda o caminho.
 */
export interface ITagRepository {
  subscribe(tenantId: string, collection: string, onChange: (tags: Tag[]) => void): () => void;
  getAll(tenantId: string, collection: string): Promise<Tag[]>;
  create(tenantId: string, collection: string, data: TagInput): Promise<Tag>;
  update(tenantId: string, collection: string, tagId: string, data: { name: string; color: string }): Promise<void>;
  delete(tenantId: string, collection: string, tagId: string, actor: DeletionActor): Promise<void>;
}
