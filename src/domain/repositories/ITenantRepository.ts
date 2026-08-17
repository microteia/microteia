import type { Tenant, TenantMember, TenantRole, TenantUpdate } from '../entities';

export interface TenantMemberRoleActor {
  uid: string;
  name: string;
  photoURL: string | null;
}

export interface ITenantRepository {
  getTenantById(tenantId: string): Promise<Tenant | null>;
  updateTenant(tenantId: string, data: TenantUpdate): Promise<void>;
  updateMemberLimit(tenantId: string, memberLimit: number | null): Promise<void>;
  addMember(tenantId: string, member: Omit<TenantMember, 'addedAt'>): Promise<void>;
  updateMemberRole(tenantId: string, userId: string, role: TenantRole, actor: TenantMemberRoleActor): Promise<void>;
  removeMember(tenantId: string, userId: string): Promise<void>;
  getMembers(tenantId: string): Promise<TenantMember[]>;
  getMemberRole(tenantId: string, userId: string): Promise<TenantRole | null>;
  getTenantsForUser(userId: string): Promise<Tenant[]>;
  getAllTenants(): Promise<Tenant[]>;
}
