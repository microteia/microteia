export class TenantMemberLimitReachedError extends Error {
  constructor() {
    super('Limite de membros do escritório atingido.');
    this.name = 'TenantMemberLimitReachedError';
  }
}
