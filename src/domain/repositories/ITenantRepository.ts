import type { Tenant, TenantMember, TenantUpdate } from '../entities';

export interface TenantMemberRoleActor {
  uid: string;
  name: string;
  photoURL: string | null;
}

export interface ITenantRepository {
  getTenantById(tenantId: string): Promise<Tenant | null>;
  updateTenant(tenantId: string, data: TenantUpdate): Promise<void>;
  /** Guarda o logo no Storage e devolve a URL de download (que carrega o próprio token). */
  uploadLogo(tenantId: string, image: Blob, fileName: string): Promise<string>;
  updateMemberLimit(tenantId: string, memberLimit: number | null): Promise<void>;
  addMember(tenantId: string, member: Omit<TenantMember, 'addedAt' | 'permissions'>): Promise<void>;
  updateMemberRoles(tenantId: string, userId: string, roleIds: string[], actor: TenantMemberRoleActor): Promise<void>;
  removeMember(tenantId: string, userId: string): Promise<void>;
  getMembers(tenantId: string): Promise<TenantMember[]>;
  getTenantsForUser(userId: string): Promise<Tenant[]>;
  getAllTenants(): Promise<Tenant[]>;
}
