import { onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { getDI } from '../di/container';
import { buildTenantDeletedText } from '../../domain/services/auditDiff';
import { logAuditError } from './shared/logAuditError';

/**
 * Exclusão de um Tenant inteiro é o evento mais crítico do sistema (cascata de todos os
 * dados do escritório) — registrada sempre como severidade CRITICAL, fora da allowlist
 * genérica de `auditFlatEntityChange`.
 */
export const auditTenantDeleted = onDocumentDeleted(
  { document: 'tenants/{tenantId}', region: 'southamerica-east1' },
  async (event) => {
    const { tenantId } = event.params;
    try {
      const data = (event.data?.data() as Record<string, unknown>) ?? {};
      const tenantName = (data.name as string | undefined) || tenantId;
      const actorUid = (data.ownerId as string | undefined) || '';
      const actor = await getDI().getUserProfileLookupService().resolveActor(actorUid);

      await getDI().getCreateAuditLogUseCase().execute({
        tenantId,
        title: 'Exclusão do Escritório',
        userId: actorUid || 'system',
        userName: actor.name,
        photoURL: actor.photoURL,
        action: 'DELETE',
        severity: 'CRITICAL',
        entity: 'Tenant',
        entityId: tenantId,
        text: buildTenantDeletedText(actor.name, tenantName),
      });
    } catch (error) {
      await logAuditError(tenantId, 'tenants', tenantId, error);
    }
  },
);
