import type { ScreenTag, DeletionActor, ScreenDefinition } from '../entities';

export type ScreenDefinitionInput = Omit<
  ScreenDefinition,
  'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'deletedBy' | 'deletedByName' | 'deletedByPhotoURL'
>;

export interface IScreenDefinitionRepository {
  getAll(tenantId: string): Promise<ScreenDefinition[]>;
  upsert(tenantId: string, screenKey: string, data: ScreenDefinitionInput): Promise<ScreenDefinition>;
  delete(tenantId: string, screenKey: string, actor: DeletionActor): Promise<void>;
  getTags(tenantId: string, screenKey: string): Promise<ScreenTag[]>;
  createTag(tenantId: string, screenKey: string, data: Omit<ScreenTag, 'id' | 'tenantId' | 'screenKey' | 'createdAt'>): Promise<ScreenTag>;
  updateTag(tenantId: string, screenKey: string, tagId: string, data: { name: string; color: string }): Promise<void>;
  deleteTag(tenantId: string, screenKey: string, tagId: string, actor: DeletionActor): Promise<void>;
}
