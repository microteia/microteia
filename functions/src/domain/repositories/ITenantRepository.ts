import type { Tenant } from '../entities/Tenant';

export interface AddTenantMemberInput {
  userId: string;
  /** Os perfis de acesso do membro NESTE escritório. Vazio = entra sem poder nada até receber um. */
  roleIds: string[];
  displayName: string;
  email: string;
  photoURL: string | null;
  addedBy: string;
}

export interface CreateTenantInput {
  name: string;
  ownerId: string;
  email: string;
  plan: string;
  memberLimit: number | null;
}

export interface ITenantRepository {
  getById(tenantId: string): Promise<Tenant | null>;
  createTenant(data: CreateTenantInput): Promise<Tenant>;
  addMemberIfWithinLimit(tenantId: string, member: AddTenantMemberInput): Promise<void>;
  removeMember(tenantId: string, userId: string, removedBy: string): Promise<void>;
}
