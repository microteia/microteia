import type { IAuditArchiveStore, AuditArchivePutResult } from './IAuditArchiveStore';
import type { IAuditLogDaySource } from './IAuditLogDaySource';
import type { AuditRetentionAuthor, IAuditRetentionRepository, StoredAuditRetention } from './IAuditRetentionRepository';
import type { AuditArchiveProtection, AuditArchiveState, AuditRetentionPolicy } from '../schema/auditRetention';
import { DEFAULT_AUDIT_RETENTION_POLICY, EMPTY_AUDIT_ARCHIVE_STATE } from '../schema/auditRetention';

/** O bucket em memória, com a mesma recusa de sobrescrever que o de verdade. */
export class FakeAuditArchiveStore implements IAuditArchiveStore {
  readonly objects = new Map<string, { content: string; retainUntil: Date | null }>();
  configured = true;
  bucketProtection: AuditArchiveProtection = { bucketRetentionLocked: true, bucketRetentionDays: 3650, objectRetentionLock: false };
  failPut: ((path: string) => Error | null) | null = null;
  reads = 0;

  isConfigured(): boolean {
    return this.configured;
  }

  async protection(): Promise<AuditArchiveProtection> {
    return this.bucketProtection;
  }

  async put(path: string, content: string, retainUntil: Date | null): Promise<AuditArchivePutResult> {
    const failure = this.failPut?.(path);
    if (failure) throw failure;
    const existing = this.objects.get(path);
    if (existing) return existing.content === content ? 'identical' : 'conflict';
    this.objects.set(path, { content, retainUntil });
    return 'created';
  }

  async read(path: string): Promise<string | null> {
    this.reads += 1;
    return this.objects.get(path)?.content ?? null;
  }

  async list(prefix: string): Promise<string[]> {
    return [...this.objects.keys()].filter((path) => path.startsWith(prefix)).sort();
  }
}

export class FakeAuditRetentionRepository implements IAuditRetentionRepository {
  readonly entries = new Map<string, StoredAuditRetention>();
  readonly authors: AuditRetentionAuthor[] = [];

  seed(tenantId: string, policy: Partial<AuditRetentionPolicy> = {}, state: Partial<AuditArchiveState> = {}): void {
    this.entries.set(tenantId, {
      tenantId,
      policy: { ...DEFAULT_AUDIT_RETENTION_POLICY, ...policy },
      state: { ...EMPTY_AUDIT_ARCHIVE_STATE, ...state },
    });
  }

  async get(tenantId: string): Promise<StoredAuditRetention> {
    return this.entries.get(tenantId)
      ?? { tenantId, policy: DEFAULT_AUDIT_RETENTION_POLICY, state: EMPTY_AUDIT_ARCHIVE_STATE };
  }

  async listArchiving(): Promise<StoredAuditRetention[]> {
    return [...this.entries.values()].filter((entry) => entry.policy.archive.enabled);
  }

  async savePolicy(tenantId: string, policy: AuditRetentionPolicy, state: AuditArchiveState, author: AuditRetentionAuthor): Promise<void> {
    this.entries.set(tenantId, { tenantId, policy, state });
    this.authors.push(author);
  }

  async saveState(tenantId: string, state: AuditArchiveState): Promise<void> {
    const current = await this.get(tenantId);
    this.entries.set(tenantId, { ...current, state });
  }
}

export class FakeAuditLogDaySource implements IAuditLogDaySource {
  readonly logs: Record<string, unknown>[] = [];

  add(tenantId: string, id: string, createdAt: string, extra: Record<string, unknown> = {}): void {
    this.logs.push({ id, tenantId, createdAt, title: '@core.admin/audit.retention.changed.title', action: 'UPDATE', ...extra });
  }

  async logsBetween(tenantId: string, start: Date, end: Date): Promise<Record<string, unknown>[]> {
    return this.logs.filter((log) => log.tenantId === tenantId
      && String(log.createdAt) >= start.toISOString()
      && String(log.createdAt) < end.toISOString());
  }
}
