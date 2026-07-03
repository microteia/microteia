import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getDI } from '../di/container';
import { getNestedEntityConfig } from '../../domain/services/auditableEntities';
import { computeChangedFields, normalizeAllFields, buildAuditText, resolveSeverity, ACTION_TITLE } from '../../domain/services/auditDiff';
import { logAuditError } from './shared/logAuditError';
import type { AuditAction } from '../../domain/entities/AuditLog';

/**
 * Escuta escritas em `tenants/{tenantId}/{parent}/{parentId}/{sub}/{docId}` — cobre
 * notas e documentos anexados a Pessoas/Processos/Contratos (+ documentos de Financeiro).
 * Mesma allowlist interna de `auditFlatEntityChange`, para pares (parent, sub).
 */
export const auditNestedEntityChange = onDocumentWritten(
  { document: 'tenants/{tenantId}/{parent}/{parentId}/{sub}/{docId}', region: 'southamerica-east1' },
  async (event) => {
    const { tenantId, parent, parentId, sub, docId } = event.params;
    const config = getNestedEntityConfig(parent, sub);
    if (!config) return;

    const collectionLabel = `${parent}/${parentId}/${sub}`;
    try {
      const before = event.data?.before;
      const after = event.data?.after;
      const beforeExists = before?.exists ?? false;
      const afterExists = after?.exists ?? false;
      if (!beforeExists && !afterExists) return;

      const action: AuditAction = !beforeExists ? 'CREATE' : !afterExists ? 'DELETE' : 'UPDATE';
      const beforeData = (before?.data() as Record<string, unknown>) ?? {};
      const afterData = (after?.data() as Record<string, unknown>) ?? {};

      let diff: { before?: Record<string, unknown>; after?: Record<string, unknown> } | undefined;
      let changedKeys: Record<string, unknown> = {};
      if (action === 'UPDATE') {
        const fieldDiff = computeChangedFields(beforeData, afterData);
        if (Object.keys(fieldDiff.after).length === 0) return;
        diff = fieldDiff;
        changedKeys = fieldDiff.after;
      } else if (action === 'DELETE') {
        diff = { before: normalizeAllFields(beforeData) };
      }

      const referenceData = action === 'DELETE' ? beforeData : afterData;
      const displayName = config.getDisplayName(referenceData);
      const severity = resolveSeverity(action, sub, changedKeys);

      const actorUid = action === 'DELETE'
        ? ((beforeData.deletedBy as string | undefined) || (beforeData.createdBy as string | undefined) || '')
        : ((afterData.createdBy as string | undefined) || '');
      const denormalizedName = action === 'DELETE'
        ? (beforeData.deletedByName as string | undefined)
        : (afterData.createdByName as string | undefined);
      const denormalizedPhoto = action === 'DELETE'
        ? (beforeData.deletedByPhotoURL as string | undefined)
        : (afterData.createdByPhotoUrl as string | undefined);

      const actor = denormalizedName
        ? { name: denormalizedName, photoURL: denormalizedPhoto ?? '' }
        : await getDI().getUserProfileLookupService().resolveActor(actorUid);

      const text = buildAuditText(action, config.entityLabel, displayName, actor.name, diff);
      const entityLink = config.getEntityLink?.(tenantId, docId, parentId);

      await getDI().getCreateAuditLogUseCase().execute({
        tenantId,
        title: `${ACTION_TITLE[action]} na entidade de ${config.entityLabelPlural}`,
        userId: actorUid || 'system',
        userName: actor.name,
        photoURL: actor.photoURL,
        action,
        severity,
        entity: config.entityKey,
        entityId: docId,
        entityLink,
        text,
      });
    } catch (error) {
      await logAuditError(tenantId, collectionLabel, docId, error);
    }
  },
);
