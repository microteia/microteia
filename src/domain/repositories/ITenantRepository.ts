import type { Tenant, TenantMember, TenantRole } from '../entities';

export interface TenantMemberRoleActor {
  uid: string;
  name: string;
  photoURL: string | null;
}

export interface ITenantRepository {
  createTenant(data: Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'>): Promise<Tenant>;
  getTenantById(tenantId: string): Promise<Tenant | null>;
  updateTenant(tenantId: string, data: Partial<Omit<Tenant, 'id' | 'ownerId' | 'createdAt'>>): Promise<void>;

  addMember(tenantId: string, member: Omit<TenantMember, 'addedAt'>): Promise<void>;
  updateMemberRole(tenantId: string, userId: string, role: TenantRole, actor: TenantMemberRoleActor): Promise<void>;
  removeMember(tenantId: string, userId: string): Promise<void>;
  getMembers(tenantId: string): Promise<TenantMember[]>;
  getMemberRole(tenantId: string, userId: string): Promise<TenantRole | null>;

  getTenantsForUser(userId: string): Promise<Tenant[]>;
  /** Somente para uso por usuários com role global SYSTEM (ex: filtro "Todos os Escritórios" em Auditoria). */
  getAllTenants(): Promise<Tenant[]>;
}
