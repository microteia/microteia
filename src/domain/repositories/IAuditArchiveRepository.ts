import type {
  AuditArchiveDayPage,
  AuditChainLink,
  AuditChainVerification,
  AuditRetentionPolicy,
  AuditRetentionStatus,
} from '../schema/auditRetention';

/** A retenção da Auditoria e o arquivo dela — tudo pelo servidor, que cobra a permissão e audita. */
export interface IAuditArchiveRepository {
  getStatus(tenantId: string): Promise<AuditRetentionStatus>;
  savePolicy(tenantId: string, policy: AuditRetentionPolicy): Promise<AuditRetentionStatus>;
  readDay(tenantId: string, day: string, offset: number, limit: number): Promise<AuditArchiveDayPage>;
  verify(tenantId: string, resume: AuditChainLink | null): Promise<AuditChainVerification>;
}
