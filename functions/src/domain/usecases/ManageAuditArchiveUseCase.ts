import type { IAuditRetentionRepository } from '../repositories/IAuditRetentionRepository';
import type { IAuditArchiveStore } from '../repositories/IAuditArchiveStore';
import type { CreateAuditLogInput, CreateAuditLogUseCase } from './CreateAuditLogUseCase';
import type { DispatchNotificationUseCase } from './DispatchNotificationUseCase';
import type {
  AuditArchiveDayPage,
  AuditArchiveProtection,
  AuditArchiveState,
  AuditChainLink,
  AuditChainVerification,
  AuditRetentionPolicy,
  AuditRetentionStatus,
} from '../schema/auditRetention';
import {
  AUDIT_ARCHIVE_PAGE_MAX,
  auditArchivePath,
  auditArchivePrefix,
  auditDayOf,
  auditDayOfArchivePath,
  auditRetentionPolicyIssue,
  auditRetentionPolicyOf,
  isAuditDay,
} from '../schema/auditRetention';
import { parseAuditArchiveDay, verifyAuditChain } from '../services/auditArchiveChain';
import type { Sha256 } from '../services/auditArchiveChain';
import {
  AUDIT_ARCHIVE_ENTITY,
  auditArchiveDivergenceLog,
  auditArchiveDivergenceNotice,
} from '../services/auditArchiveNotice';
import type { AuditArchiveActor } from '../services/auditArchiveNotice';
import { AUDIT_ARCHIVE_UNAVAILABLE } from './ExportAuditArchiveUseCase';
import { failedPrecondition, invalidArgument } from '../errors/DomainError';

export interface ManageAuditArchiveDeps {
  retention: IAuditRetentionRepository;
  store: IAuditArchiveStore;
  sha256: Sha256;
  now: () => Date;
  audit: CreateAuditLogUseCase;
  dispatch: DispatchNotificationUseCase;
  warn: (message: string, detail?: unknown) => void;
}

export interface ManageAuditArchiveUseCase {
  status(tenantId: string): Promise<AuditRetentionStatus>;
  save(input: { tenantId: string; actor: AuditArchiveActor; policy: unknown }): Promise<AuditRetentionStatus>;
  day(input: { tenantId: string; day: unknown; offset?: unknown; limit?: unknown }): Promise<AuditArchiveDayPage>;
  verify(input: {
    tenantId: string;
    actor: AuditArchiveActor;
    resume?: unknown;
    outOfTime: () => boolean;
  }): Promise<AuditChainVerification>;
}

const DEFAULT_PAGE = 50;

const HASH_PATTERN = /^[0-9a-f]{64}$/;

const asResume = (value: unknown): AuditChainLink | null => {
  if (typeof value !== 'object' || value === null) return null;
  const { day, dayHash } = value as Record<string, unknown>;
  return isAuditDay(day) && typeof dayHash === 'string' && HASH_PATTERN.test(dayHash) ? { day, dayHash } : null;
};

const pageNumber = (value: unknown, fallback: number, min: number, max: number): number =>
  (typeof value === 'number' && Number.isInteger(value) ? Math.min(Math.max(value, min), max) : fallback);

/**
 * O que a mudança de política deixa na Auditoria. Uma linha por decisão, e a severidade é a do que
 * ela tira: desligar o arquivo é `CRITICAL` (aparece no badge de todo leitor); encurtar um prazo é
 * `HIGH`; o resto é `LOW`. A própria linha entra no arquivo — enquanto ele está ligado.
 */
export const auditRetentionChangeLogs = (
  tenantId: string,
  actor: AuditArchiveActor,
  before: AuditRetentionPolicy,
  after: AuditRetentionPolicy,
  state: AuditArchiveState,
): CreateAuditLogInput[] => {
  const base = { tenantId, ...actor, action: 'UPDATE' as const, type: 'AUDIT' as const, entity: AUDIT_ARCHIVE_ENTITY, entityId: tenantId };
  const logs: CreateAuditLogInput[] = [];

  if (!before.archive.enabled && after.archive.enabled) {
    logs.push({
      ...base,
      severity: 'LOW',
      title: '@core.admin/audit.archive.enabled.title',
      text: '@core.admin/audit.archive.enabled.text',
      textParams: { day: state.startDay ?? '', years: String(after.archive.retentionYears) },
    });
  }
  if (before.archive.enabled && !after.archive.enabled) {
    logs.push({
      ...base,
      severity: 'CRITICAL',
      title: '@core.admin/audit.archive.disabled.title',
      text: '@core.admin/audit.archive.disabled.text',
    });
  }

  // Os anos só travam o que se exporta com o arquivo ligado; ao ligá-lo, a linha acima já os diz.
  const daysChanged = before.retentionDays !== after.retentionDays;
  const yearsChanged = before.archive.enabled && after.archive.enabled
    && before.archive.retentionYears !== after.archive.retentionYears;
  if (daysChanged || yearsChanged) {
    const shortened = after.retentionDays < before.retentionDays || after.archive.retentionYears < before.archive.retentionYears;
    logs.push({
      ...base,
      severity: shortened ? 'HIGH' : 'LOW',
      title: '@core.admin/audit.retention.changed.title',
      text: '@core.admin/audit.retention.changed.text',
      textParams: {
        beforeDays: String(before.retentionDays),
        afterDays: String(after.retentionDays),
        beforeYears: String(before.archive.retentionYears),
        afterYears: String(after.archive.retentionYears),
      },
    });
  }
  return logs;
};

/**
 * A porta do escritório para a retenção e o arquivo: ver como está, mudar, ler um dia arquivado e
 * conferir a cadeia. A permissão é cobrada pela callable — `audit.manage` para mudar, `audit.read`
 * para o resto —, e aqui mora só o que vale para qualquer chamador.
 */
export const makeManageAuditArchiveUseCase = (deps: ManageAuditArchiveDeps): ManageAuditArchiveUseCase => {
  const protection = async (): Promise<AuditArchiveProtection | null> => {
    if (!deps.store.isConfigured()) return null;
    return deps.store.protection().catch((error: unknown) => {
      deps.warn('[audit-archive] could not read the bucket protection', error);
      return null;
    });
  };

  const status = async (tenantId: string): Promise<AuditRetentionStatus> => {
    const [entry, bucket] = await Promise.all([deps.retention.get(tenantId), protection()]);
    return { policy: entry.policy, archiveAvailable: deps.store.isConfigured(), protection: bucket, state: entry.state };
  };

  return {
    status,

    save: async ({ tenantId, actor, policy: raw }) => {
      const issue = auditRetentionPolicyIssue(raw);
      if (issue) throw invalidArgument(issue);
      const policy = auditRetentionPolicyOf(raw);
      if (policy.archive.enabled && !deps.store.isConfigured()) throw failedPrecondition(AUDIT_ARCHIVE_UNAVAILABLE);

      const current = await deps.retention.get(tenantId);
      const turningOn = policy.archive.enabled && !current.policy.archive.enabled;
      const state: AuditArchiveState = turningOn
        ? { ...current.state, startDay: auditDayOf(deps.now()), failure: null }
        : current.state;

      await deps.retention.savePolicy(tenantId, policy, state, { userId: actor.userId, userName: actor.userName });
      for (const log of auditRetentionChangeLogs(tenantId, actor, current.policy, policy, state)) {
        await deps.audit.execute(log);
      }
      return status(tenantId);
    },

    day: async ({ tenantId, day, offset, limit }) => {
      if (!isAuditDay(day)) throw invalidArgument('@core.admin/audit.archive.day-invalid');
      const from = pageNumber(offset, 0, 0, Number.MAX_SAFE_INTEGER);
      const size = pageNumber(limit, DEFAULT_PAGE, 1, AUDIT_ARCHIVE_PAGE_MAX);
      const absent: AuditArchiveDayPage = { day, exported: false, header: null, lines: [], offset: from, total: 0 };
      if (!deps.store.isConfigured()) return absent;

      const content = await deps.store.read(auditArchivePath(tenantId, day));
      if (content === null) return absent;
      const parsed = parseAuditArchiveDay(content);
      if (!parsed) throw failedPrecondition('@core.admin/audit.archive.unreadable');
      return {
        day,
        exported: true,
        header: parsed.header,
        lines: parsed.lines.slice(from, from + size),
        offset: from,
        total: parsed.lines.length,
      };
    },

    verify: async ({ tenantId, actor, resume, outOfTime }) => {
      if (!deps.store.isConfigured()) throw failedPrecondition(AUDIT_ARCHIVE_UNAVAILABLE);
      const [entry, paths, bucket] = await Promise.all([
        deps.retention.get(tenantId),
        deps.store.list(auditArchivePrefix(tenantId)),
        protection(),
      ]);
      const days = paths
        .map((path) => auditDayOfArchivePath(tenantId, path))
        .filter((day): day is string => day !== null)
        .sort();
      const { lastDay, headHash } = entry.state;

      const result = await verifyAuditChain({
        tenantId,
        days,
        read: (day) => deps.store.read(auditArchivePath(tenantId, day)),
        resume: asResume(resume),
        expectedHead: lastDay && headHash ? { day: lastDay, dayHash: headHash } : null,
        protection: bucket,
        outOfTime,
      }, deps.sha256);

      // Quem viu a divergência não pode ser o único a saber dela.
      if (result.divergence) {
        await deps.audit.execute(auditArchiveDivergenceLog(tenantId, actor, result.divergence))
          .catch((error: unknown) => deps.warn('[audit-archive] could not record the divergence', error));
        await deps.dispatch.execute(auditArchiveDivergenceNotice(tenantId, result.divergence))
          .catch((error: unknown) => deps.warn('[audit-archive] could not send the divergence notice', error));
      }
      return result;
    },
  };
};
