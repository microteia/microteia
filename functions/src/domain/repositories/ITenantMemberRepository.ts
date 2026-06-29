export interface ITenantMemberRepository {
  isMember(tenantId: string, userId: string): Promise<boolean>;
  getMemberRole(tenantId: string, userId: string): Promise<string | null>;
}
