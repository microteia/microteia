import type { DispatchNotificationRequest } from '../usecases/DispatchNotificationUseCase';
import type { CreateAuditLogInput } from '../usecases/CreateAuditLogUseCase';
import type { AuditArchiveFailure, AuditChainDivergence } from '../schema/auditRetention';
import { AUDIT_CHAIN_DIVERGENCE_MESSAGES, AUDIT_RETENTION_COLLECTION } from '../schema/auditRetention';
import { PERMISSION_AUDIT_MANAGE } from '../schema/access/kernelPermissions';

/** O tipo do aviso, declarado pelo dono do ponto (`core.automation`) em `notification.category`. */
export const AUDIT_ARCHIVE_CATEGORY = 'core.automation/audit-archive';

/** A entidade que os registros de auditoria do próprio arquivo carregam. */
export const AUDIT_ARCHIVE_ENTITY = AUDIT_RETENTION_COLLECTION;

const AUDIT_LOGS_TAB = 'audit-logs';

/** Quem escreve o que nenhuma pessoa causou — o mesmo autor de máquina das outras rotinas do kernel. */
const SYSTEM_AUTHOR = { userId: 'system', userName: '', photoURL: '' };

/**
 * Uma falha da exportação na AUDITORIA: `CRITICAL`, porque é o badge de não lidas que todo leitor da
 * Auditoria vê. E é a própria linha que, no dia seguinte, entra no arquivo — a falha fica registrada
 * na cadeia que ela atrasou.
 */
export const auditArchiveFailureLog = (tenantId: string, failure: AuditArchiveFailure): CreateAuditLogInput => ({
  tenantId,
  ...SYSTEM_AUTHOR,
  title: '@core.admin/audit.archive.failed.title',
  text: '@core.admin/audit.archive.failed.text',
  textParams: { day: failure.day, attempts: String(failure.attempts), error: failure.message },
  action: 'SYSTEM',
  severity: 'CRITICAL',
  type: 'ERROR',
  entity: AUDIT_ARCHIVE_ENTITY,
  entityId: tenantId,
});

/**
 * O aviso a quem RESPONDE pelo arquivo (`audit.manage`). O badge só chega a quem abre a Auditoria;
 * uma exportação parada há dias é exatamente o que ninguém está olhando.
 *
 * Um aviso por dia de falha e por janela de 24 h (`dedupKey`): o exportador tenta de hora em hora, e
 * um e-mail por tentativa ensinaria a ignorá-lo.
 */
export const auditArchiveFailureNotice = (
  tenantId: string,
  failure: AuditArchiveFailure,
): DispatchNotificationRequest => ({
  tenantId,
  source: 'core.admin/audit-archive',
  title: '@core.admin/audit.archive.notice.failed.title',
  message: '@core.admin/audit.archive.notice.failed.message',
  params: { day: failure.day, attempts: String(failure.attempts), error: failure.message },
  link: AUDIT_LOGS_TAB,
  category: AUDIT_ARCHIVE_CATEGORY,
  dedupKey: `audit-archive-failed:${tenantId}:${failure.day}:${failure.lastAlertedAt}`,
  // A linha CRITICAL acima já é a da Auditoria.
  channels: { audit: false, inApp: true, email: true, push: true },
  recipientIds: [],
  recipientPermissions: [PERMISSION_AUDIT_MANAGE],
});

export interface AuditArchiveActor {
  userId: string;
  userName: string;
  photoURL: string;
}

/** A verificação que achou divergência — atribuída a quem a pediu, porque foi essa pessoa que viu. */
export const auditArchiveDivergenceLog = (
  tenantId: string,
  actor: AuditArchiveActor,
  divergence: AuditChainDivergence,
): CreateAuditLogInput => ({
  tenantId,
  ...actor,
  title: '@core.admin/audit.archive.diverged.title',
  text: AUDIT_CHAIN_DIVERGENCE_MESSAGES[divergence.reason],
  textParams: { day: divergence.day, line: String(divergence.line ?? ''), logId: divergence.logId ?? '' },
  action: 'SYSTEM',
  severity: 'CRITICAL',
  type: 'AUDIT',
  entity: AUDIT_ARCHIVE_ENTITY,
  entityId: tenantId,
});

export const auditArchiveDivergenceNotice = (
  tenantId: string,
  divergence: AuditChainDivergence,
): DispatchNotificationRequest => ({
  tenantId,
  source: 'core.admin/audit-archive',
  title: '@core.admin/audit.archive.notice.diverged.title',
  message: '@core.admin/audit.archive.notice.diverged.message',
  params: { day: divergence.day },
  link: AUDIT_LOGS_TAB,
  category: AUDIT_ARCHIVE_CATEGORY,
  dedupKey: `audit-archive-diverged:${tenantId}:${divergence.day}:${divergence.reason}`,
  channels: { audit: false, inApp: true, email: true, push: true },
  recipientIds: [],
  recipientPermissions: [PERMISSION_AUDIT_MANAGE],
});
