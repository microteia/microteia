import type { PersonTag } from '../entities';

export interface IPersonTagRepository {
  getPersonTags(tenantId: string): Promise<PersonTag[]>;
  createPersonTag(tenantId: string, data: Omit<PersonTag, 'id' | 'tenantId' | 'createdAt'>): Promise<PersonTag>;
  updatePersonTag(tenantId: string, tagId: string, data: { name: string; color: string }): Promise<void>;
  deletePersonTag(tenantId: string, tagId: string): Promise<void>;
}
