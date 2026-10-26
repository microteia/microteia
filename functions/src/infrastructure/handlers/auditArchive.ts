import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import { getDI } from '../di/container';
import { requirePermission } from './shared/requirePermission';
import { PERMISSION_AUDIT_MANAGE, PERMISSION_AUDIT_READ } from '../../domain/schema/access/kernelPermissions';
import { domainErrorCode } from '../../domain/errors/DomainError';

const REGION = 'southamerica-east1';

/**
 * Tempo depois do qual a exportação não começa outro dia. O que sobrar continua por exportar e é da
 * execução seguinte — uma hora depois —, em vez de estourar o timeout no meio de um arquivo.
 */
const EXPORT_BUDGET_MS = 420_000;

/** O mesmo para a verificação: a resposta volta `partial`, e a tela continua de onde parou. */
const VERIFY_BUDGET_MS = 240_000;

const asHttpsError = (error: unknown, operation: string): HttpsError => {
  if (error instanceof HttpsError) return error;
  const code = domainErrorCode(error);
  if (!code) {
    logger.error(`[audit-archive] ${operation} failed: ${error instanceof Error ? error.message : String(error)}`, {
      operation,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return new HttpsError('internal', '@core.admin/audit.archive.failed');
  }
  return new HttpsError(code, error instanceof Error ? error.message : '@core.admin/audit.archive.failed');
};

/**
 * A exportação diária do arquivo da Auditoria. De hora em hora, e não uma vez por dia: o dia que
 * falhou é refeito na hora seguinte, e não 24 h depois. A execução que não acha nada a fazer custa
 * uma consulta — a dos escritórios com o arquivo ligado —, e numa instalação em que ninguém o ligou
 * ela termina aí.
 */
export const exportAuditArchive = onSchedule(
  { schedule: 'every 60 minutes', region: REGION, timeoutSeconds: 540, memory: '1GiB' },
  async () => {
    const startedAt = Date.now();
    const result = await getDI().getExportAuditArchiveUseCase()
      .execute({ outOfTime: () => Date.now() - startedAt > EXPORT_BUDGET_MS });
    if (result.exported + result.failed > 0 || result.pending) {
      logger.info(`[audit-archive] ${result.exported} day(s) exported, ${result.failed} failure(s)`, result);
    }
  },
);

/**
 * A porta do escritório: `status`, `day` e `verify` pedem `audit.read`; `save` pede `audit.manage`.
 * O autor de `save` e de uma verificação que acha divergência é resolvido aqui — nunca vem do cliente.
 */
export const manageAuditArchive = onCall({ region: REGION, cors: true, timeoutSeconds: 300, memory: '512MiB' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');
  const data = (request.data ?? {}) as Record<string, unknown>;
  if (typeof data.tenantId !== 'string' || data.tenantId.trim() === '') {
    throw new HttpsError('invalid-argument', '@core.automation/handler.tenant.missing');
  }
  const tenantId = data.tenantId.trim();
  const userId = request.auth.uid;
  await requirePermission(tenantId, userId, data.op === 'save' ? PERMISSION_AUDIT_MANAGE : PERMISSION_AUDIT_READ);

  const di = getDI();
  const manage = di.getManageAuditArchiveUseCase();
  const actor = async () => {
    const resolved = await di.getUserProfileLookupService().resolveActor(userId);
    return { userId, userName: resolved.name, photoURL: resolved.photoURL };
  };
  try {
    if (data.op === 'status') return await manage.status(tenantId);
    if (data.op === 'save') return await manage.save({ tenantId, actor: await actor(), policy: data.policy });
    if (data.op === 'day') return await manage.day({ tenantId, day: data.day, offset: data.offset, limit: data.limit });
    if (data.op === 'verify') {
      const startedAt = Date.now();
      return await manage.verify({
        tenantId,
        actor: await actor(),
        resume: data.resume,
        outOfTime: () => Date.now() - startedAt > VERIFY_BUDGET_MS,
      });
    }
    throw new HttpsError('invalid-argument', '@core.admin/audit.archive.op-invalid');
  } catch (error) {
    throw asHttpsError(error, `manageAuditArchive:${String(data.op)}`);
  }
});
