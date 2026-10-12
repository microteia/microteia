import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getDI } from '../di/container';
import { resolveFlatEntityConfig } from '../../domain/services/auditableEntities';
import { computeChangedFields, normalizeAllFields, buildAuditText, resolveSeverity, ACTION_TITLE } from '../../domain/services/auditDiff';
import { logAuditError } from './shared/logAuditError';
import type { AuditAction } from '../../domain/entities/AuditLog';
import { isAggregateBackfillWriteFresh } from '../../domain/services/aggregateBackfill';
import { isRecordKeyBookkeepingWrite } from '../../domain/services/recordKeyAdoption';

/**
 * Escuta qualquer escrita em `tenants/{tenantId}/{collection}/{docId}` e gera um AuditLog para as duas
 * coleções fixas que restam (`members` e `screenDefinitions`) e para toda coleção de TELA declarada —
 * que se identifica pela declaração do tenant, ver `resolveFlatEntityConfig`. Coleções de
 * infraestrutura (lookups, aiConnections, etc.) são ignoradas.
 *
 * Uma coleção pode restringir quais ações audita, e quem diz isso é a própria tela
 * (`auditActions`): é a saída para a coleção cujo registro NASCE de máquina, em que auditar a
 * inclusão significaria um log por documento recebido.
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

      if (action === 'UPDATE') {
        // A adoção de chave e o recálculo são registrados no job de cada um, não em uma linha de
        // auditoria por registro.
        if (isRecordKeyBookkeepingWrite(beforeData, afterData)) return;
        const di = getDI();
        const fromBackfill = await isAggregateBackfillWriteFresh(
          tenantId,
          collection,
          beforeData,
          afterData,
          (id) => di.getScreenDefinitionCache().getSchemaContext(id),
          (id) => di.getFreshSchemaContext(id),
        );
        if (fromBackfill) return;
      }

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

      const auditText = buildAuditText(action, displayName, actor.name, diff);
      const entityLink = config.getEntityLink?.(tenantId, docId, undefined, referenceData);

      await getDI().getCreateAuditLogUseCase().execute({
        tenantId,
        title: '@core.admin/audit.title',
        // `entity` fica de fora pelo mesmo motivo do texto: quem o preenche é a tela que exibe.
        titleParams: { action: ACTION_TITLE[action] },
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
        textParams: auditText.messageParams,
      });
    } catch (error) {
      await logAuditError(tenantId, collection, docId, error);
    }
  },
);
