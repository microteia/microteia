import type { CustomRecordTag, DeletionActor, ScreenDefinition, ScreenFieldOption } from '../entities';

export type ScreenDefinitionInput = Omit<
  ScreenDefinition,
  'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'deletedBy' | 'deletedByName' | 'deletedByPhotoURL'
>;

export interface IScreenDefinitionRepository {
  getAll(tenantId: string): Promise<ScreenDefinition[]>;
  upsert(tenantId: string, screenKey: string, data: ScreenDefinitionInput): Promise<ScreenDefinition>;
  delete(tenantId: string, screenKey: string, actor: DeletionActor): Promise<void>;
  getFieldOptions(tenantId: string, screenKey: string): Promise<ScreenFieldOption[]>;
  addFieldOption(tenantId: string, screenKey: string, fieldKey: string, label: string, userId: string): Promise<ScreenFieldOption>;
  removeFieldOption(tenantId: string, screenKey: string, optionId: string): Promise<void>;
  getTags(tenantId: string, screenKey: string): Promise<CustomRecordTag[]>;
  createTag(tenantId: string, screenKey: string, data: Omit<CustomRecordTag, 'id' | 'tenantId' | 'screenKey' | 'createdAt'>): Promise<CustomRecordTag>;
  updateTag(tenantId: string, screenKey: string, tagId: string, data: { name: string; color: string }): Promise<void>;
  deleteTag(tenantId: string, screenKey: string, tagId: string, actor: DeletionActor): Promise<void>;
}
