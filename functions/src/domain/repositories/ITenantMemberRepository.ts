export interface TenantMemberInfo {
  role: string | null;
  displayName: string;
}

export interface ITenantMemberRepository {
  isMember(tenantId: string, userId: string): Promise<boolean>;
  getMemberRole(tenantId: string, userId: string): Promise<string | null>;
  /** O papel e o NOME de quem age — uma leitura só, para quem precisa dos dois. */
  getMember(tenantId: string, userId: string): Promise<TenantMemberInfo | null>;
}
