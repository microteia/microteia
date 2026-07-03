import type { Tenant } from '../entities/Tenant';

export interface AddTenantMemberInput {
  userId: string;
  role: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  addedBy: string;
}

export interface CreateTenantInput {
  name: string;
  ownerId: string;
  email: string;
  memberLimit: number | null;
}

export interface ITenantRepository {
  getById(tenantId: string): Promise<Tenant | null>;
  createTenant(data: CreateTenantInput): Promise<Tenant>;
  addMemberIfWithinLimit(tenantId: string, member: AddTenantMemberInput): Promise<void>;
  removeMember(tenantId: string, userId: string, removedBy: string): Promise<void>;
}
