import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getDI } from '../di/container';
import { resolveFlatEntityConfig } from '../../domain/services/auditableEntities';
import { computeChangedFields, normalizeAllFields, buildAuditText, resolveSeverity, ACTION_TITLE } from '../../domain/services/auditDiff';
import { logAuditError } from './shared/logAuditError';
import type { AuditAction } from '../../domain/entities/AuditLog';

/**
 * Escuta qualquer escrita em `tenants/{tenantId}/{collection}/{docId}` e gera um AuditLog para as
 * coleções fixas do kernel (deadlines, financials, members, *Tags, pushes) e para toda coleção de
 * tela declarada — que se identifica pela declaração do tenant, ver `resolveFlatEntityConfig`.
 * Coleções de infraestrutura (lookups, aiConnections, etc.) são ignoradas. Uma coleção fixa pode
 * restringir quais ações audita via `auditActions` (ex: pushes só audita UPDATE/DELETE, pois a
 * criação é automática).
 */
export const auditFlatEntityChange = onDocumentWritten(
  { document: 'tenants/{tenantId}/{collection}/{docId}', region: 'southamerica-east1' },
  async (event) => {
    const { tenantId, collection, docId } = event.params;

    try {
      const config = await resolveFlatEntityConfig(getDI().getScreenDefinitionCache(), tenantId, collection);
      if (!config) return;

      const before = event.data?.before;
      const after = event.data?.after;
      const beforeExists = before?.exists ?? false;
      const afterExists = after?.exists ?? false;
      if (!beforeExists && !afterExists) return;

      const action: AuditAction = !beforeExists ? 'CREATE' : !afterExists ? 'DELETE' : 'UPDATE';
      if (config.auditActions && !config.auditActions.includes(action)) return;

      const beforeData = (before?.data() as Record<string, unknown>) ?? {};
      const afterData = (after?.data() as Record<string, unknown>) ?? {};
      const referenceData = action === 'DELETE' ? beforeData : afterData;

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

      if (diff) {
        diff = await getDI().getFkNameEnricherService().enrichDiff(tenantId, collection, undefined, diff);
      }

      const displayName = config.getDisplayName(referenceData);
      const severity = resolveSeverity(action, collection, changedKeys);

      const actorUid = action === 'DELETE'
        ? ((beforeData.deletedBy as string | undefined) || (beforeData.updatedBy as string | undefined) || (beforeData.createdBy as string | undefined) || '')
        : ((afterData.updatedBy as string | undefined) || (afterData.createdBy as string | undefined) || (afterData.addedBy as string | undefined) || '');

      const denormalizedName = action === 'DELETE'
        ? (beforeData.deletedByName as string | undefined)
        : (afterData.updatedByName as string | undefined);
      const denormalizedPhoto = action === 'DELETE'
        ? (beforeData.deletedByPhotoURL as string | undefined)
        : (afterData.updatedByPhotoURL as string | undefined);

      const actor = denormalizedName
        ? { name: denormalizedName, photoURL: denormalizedPhoto ?? '' }
        : await getDI().getUserProfileLookupService().resolveActor(actorUid);

      const auditText = buildAuditText(action, config.entityLabel, displayName, actor.name, diff);
      const entityLink = config.getEntityLink?.(tenantId, docId, undefined, referenceData);

      await getDI().getCreateAuditLogUseCase().execute({
        tenantId,
        title: '@core.admin/audit.title',
        titleParams: {
          ...config.entityLabelPluralParams,
          action: ACTION_TITLE[action],
          entity: config.entityLabelPlural,
        },
        userId: actorUid || 'system',
        userName: actor.name,
        photoURL: actor.photoURL,
        action,
        severity,
        entity: config.entityKey,
        entityId: docId,
        entityLink,
        linkCollection: collection,
        linkRecordId: docId,
        text: auditText.message,
        // Os parâmetros do RÓTULO da entidade sobem para o mesmo objeto: `{entity}` é ele próprio
        // uma referência ("Nota de {name}"), e resolvê-la exige o `{name}` ao lado.
        textParams: { ...config.entityLabelParams, ...auditText.messageParams },
      });
    } catch (error) {
      await logAuditError(tenantId, collection, docId, error);
    }
  },
);
