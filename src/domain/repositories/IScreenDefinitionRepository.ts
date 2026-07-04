import type { DeletionActor, ScreenDefinition, ScreenFieldOption } from '../entities';

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
}
