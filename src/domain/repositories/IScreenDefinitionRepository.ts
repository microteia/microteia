import type { DeletionActor, ScreenDefinition } from '../entities';

export type ScreenDefinitionInput = Omit<
  ScreenDefinition,
  'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'deletedBy' | 'deletedByName' | 'deletedByPhotoURL'
>;

export interface IScreenDefinitionRepository {
  getAll(tenantId: string): Promise<ScreenDefinition[]>;
  upsert(tenantId: string, screenKey: string, data: ScreenDefinitionInput): Promise<ScreenDefinition>;
  delete(tenantId: string, screenKey: string, actor: DeletionActor): Promise<void>;
}
