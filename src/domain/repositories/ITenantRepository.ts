import type { MemberMfaRequirement } from '../schema/memberMfa';
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
  /**
   * A exigência de segundo fator que o escritório tem para ESTA pessoa, ao vivo. Lê o próprio documento
   * de membro — o único que as regras liberam antes de a sessão provar o fator — e avisa quando a
   * política muda com a tela aberta. `null`: não exigido (ou não é membro).
   */
  /** A mesma leitura, uma vez — a que decide, na entrada, se a lista de membros já pode ser lida. */
  getSecondFactorRequirement(tenantId: string, userId: string): Promise<MemberMfaRequirement | null>;
  subscribeSecondFactorRequirement(
    tenantId: string,
    userId: string,
    onChange: (requirement: MemberMfaRequirement | null) => void,
    onError: (error: Error) => void,
  ): () => void;
  /** Só o administrador global: abre um escritório em nome de quem já tem conta. Devolve o id. */
  createOrganization(name: string, ownerEmail: string): Promise<string>;
}
