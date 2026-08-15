export class TenantMemberLimitReachedError extends Error {
  constructor() {
    super('@core.admin/member.limit-reached-error');
    this.name = 'TenantMemberLimitReachedError';
  }
}
