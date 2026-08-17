export class TenantMemberLimitReachedError extends Error {
  constructor() {
    super('@core.tenant/member.limit-reached-error');
    this.name = 'TenantMemberLimitReachedError';
  }
}
