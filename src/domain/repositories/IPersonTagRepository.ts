import type { PersonTag, DeletionActor } from '../entities';

export interface IPersonTagRepository {
  getPersonTags(tenantId: string): Promise<PersonTag[]>;
  createPersonTag(tenantId: string, data: Omit<PersonTag, 'id' | 'tenantId' | 'createdAt'>): Promise<PersonTag>;
  updatePersonTag(tenantId: string, tagId: string, data: { name: string; color: string }): Promise<void>;
  deletePersonTag(tenantId: string, tagId: string, actor: DeletionActor): Promise<void>;
}
