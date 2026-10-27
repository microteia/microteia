import type { MemberMfaRequirement } from '../schema/memberMfa';

export interface TenantMemberInfo {
  role: string | null;
  displayName: string;
}

/**
 * O que decide o acesso de um membro, numa leitura só do documento dele: o conjunto materializado e a
 * exigência de segundo fator — os dois campos que as Security Rules também leem.
 */
export interface MemberAccess {
  userId: string;
  displayName: string;
  email: string;
  roleIds: string[];
  permissions: string[];
  mfa: MemberMfaRequirement | null;
}

export interface ITenantMemberRepository {
  isMember(tenantId: string, userId: string): Promise<boolean>;
  getMemberRole(tenantId: string, userId: string): Promise<string | null>;
  /** O papel e o NOME de quem age — uma leitura só, para quem precisa dos dois. */
  getMember(tenantId: string, userId: string): Promise<TenantMemberInfo | null>;
  /**
   * As permissões EFETIVAS já materializadas no documento de membro — as mesmas que as Security
   * Rules leem. Vazio quando o membro não existe: a ausência não concede nada.
   */
  getMemberPermissions(tenantId: string, userId: string): Promise<string[]>;
  /**
   * A digital do catálogo de código com que este membro foi materializado pela última vez. `null`
   * quando ele nunca o foi — e a ausência é o que faz um escritório recém-criado se compor sozinho.
   * Ver `KERNEL_CATALOG_FINGERPRINT`.
   */
  getMemberCatalogStamp(tenantId: string, userId: string): Promise<string | null>;
  /** `null` quando não é membro. */
  getMemberAccess(tenantId: string, userId: string): Promise<MemberAccess | null>;
  listMemberAccess(tenantId: string): Promise<MemberAccess[]>;
}
