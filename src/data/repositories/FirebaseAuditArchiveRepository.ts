import { httpsCallable } from 'firebase/functions';
import { functions } from '../../infrastructure/firebase/config';
import type { IAuditArchiveRepository } from '../../domain/repositories/IAuditArchiveRepository';
import type {
  AuditArchiveDayPage,
  AuditChainLink,
  AuditChainVerification,
  AuditRetentionPolicy,
  AuditRetentionStatus,
} from '../../domain/schema/auditRetention';

const CALLABLE = 'manageAuditArchive';

type Request =
  | { tenantId: string; op: 'status' }
  | { tenantId: string; op: 'save'; policy: AuditRetentionPolicy }
  | { tenantId: string; op: 'day'; day: string; offset: number; limit: number }
  | { tenantId: string; op: 'verify'; resume: AuditChainLink | null };

const call = async <T>(request: Request): Promise<T> =>
  (await httpsCallable<Request, T>(functions, CALLABLE)(request)).data;

export class FirebaseAuditArchiveRepository implements IAuditArchiveRepository {
  getStatus(tenantId: string): Promise<AuditRetentionStatus> {
    return call({ tenantId, op: 'status' });
  }

  savePolicy(tenantId: string, policy: AuditRetentionPolicy): Promise<AuditRetentionStatus> {
    return call({ tenantId, op: 'save', policy });
  }

  readDay(tenantId: string, day: string, offset: number, limit: number): Promise<AuditArchiveDayPage> {
    return call({ tenantId, op: 'day', day, offset, limit });
  }

  verify(tenantId: string, resume: AuditChainLink | null): Promise<AuditChainVerification> {
    return call({ tenantId, op: 'verify', resume });
  }
}
