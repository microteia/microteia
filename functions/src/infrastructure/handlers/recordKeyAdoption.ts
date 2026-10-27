import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { getDI } from '../di/container';
import { RECORD_KEY_ADOPTION_COLLECTION } from '../../domain/schema/recordKeyAdoption';
import type { RecordKeyAdoptionPlan } from '../../domain/schema/recordKeyAdoption';
import {
  recheckRecordKeyIssues,
  reconcileRecordKeyAdoptions,
  runRecordKeyAdoptionRound,
} from '../../domain/services/recordKeyAdoption';
import { getWorkflowEventPrefix } from '../../domain/services/workflowEventEntities';
import { isOfficeMember } from './shared/requirePermission';

const REGION = 'southamerica-east1';

/** Ver `runAggregateBackfill`: uma falha determinística não pode virar custo por dias. */
const MAX_EVENT_AGE_MS = 15 * 60_000;

/**
 * A porta automática: toda gravação de tela confere declarado × adotado. O pacote, o Form Design, o
 * MCP e o Console declaram uma chave por caminhos diferentes, e todos gravam `screenDefinitions`.
 */
export const reconcileRecordKeysOnScreenChange = onDocumentWritten(
  { document: 'tenants/{tenantId}/screenDefinitions/{screenId}', region: REGION },
  async (event) => {
    const { tenantId } = event.params;
    try {
      await reconcileRecordKeyAdoptions(tenantId, getDI().getRecordKeyAdoptionDeps());
    } catch (error) {
      console.error(`[record-key-adoption] Falha ao conferir as chaves de ${tenantId}:`, error);
    }
  },
);

/** Uma rodada por gravação no job; o fechamento da rodada é a gravação que dispara a seguinte. */
export const runRecordKeyAdoption = onDocumentWritten(
  {
    document: `tenants/{tenantId}/${RECORD_KEY_ADOPTION_COLLECTION}/{collection}`,
    region: REGION,
    retry: true,
    timeoutSeconds: 300,
  },
  async (event) => {
    if (!event.data?.after.exists) return;
    if (Date.now() - new Date(event.time).getTime() > MAX_EVENT_AGE_MS) return;

    const { tenantId, collection } = event.params;
    await runRecordKeyAdoptionRound(tenantId, collection, getDI().getRecordKeyAdoptionDeps());
  },
);

/**
 * O conflito de adoção se resolve na própria tela — a pessoa corrige o valor repetido, ou apaga o
 * registro — e é esta gravação que o leva de volta ao job. O filtro é o evento: só a gravação de um
 * registro sem a reserva que o valor pede, ou com reserva trocando de mãos, chega a ler o job.
 */
export const recheckRecordKeysOnEntityChange = onDocumentWritten(
  { document: 'tenants/{tenantId}/{collection}/{docId}', region: REGION },
  async (event) => {
    const { tenantId, collection, docId } = event.params;
    if (!getWorkflowEventPrefix(collection)) return;

    try {
      const before = event.data?.before;
      const after = event.data?.after;
      const di = getDI();
      await recheckRecordKeyIssues(
        tenantId,
        collection,
        docId,
        before?.exists ? (before.data() as Record<string, unknown>) : null,
        after?.exists ? (after.data() as Record<string, unknown>) : null,
        (id) => di.getScreenDefinitionCache().getSchemaContext(id),
        di.getRecordKeyAdoptionDeps(),
      );
    } catch (error) {
      console.error(`[record-key-adoption] Falha ao reconferir ${tenantId}/${collection}/${docId}:`, error);
    }
  },
);

/** Ver `reconcileAggregates`: só uma gravação de tela desbloqueia uma passada ou tira uma chave. */
const CLIENT_PLAN_KINDS: ReadonlySet<RecordKeyAdoptionPlan['kind']> = new Set(['start', 'nudge']);

/**
 * A conferência pedida pelo próprio app — cobre o escritório que já tinha chaves antes da adoção
 * existir, em que nenhuma tela muda depois da atualização. Pede pertencimento, não permissão: não
 * aceita nada além do escritório e só põe em marcha o que a declaração já pede.
 */
export const reconcileRecordKeys = onCall(
  { region: REGION, cors: true },
  async (request): Promise<{ changed: number }> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');
    }

    const { tenantId } = request.data as { tenantId?: string };
    if (!tenantId) {
      throw new HttpsError('invalid-argument', '@core.automation/handler.tenant.missing');
    }

    if (!(await isOfficeMember(tenantId, request.auth))) {
      throw new HttpsError('permission-denied', '@core.access/permission.denied', {
        permission: 'members',
      });
    }

    const changed = await reconcileRecordKeyAdoptions(
      tenantId,
      getDI().getRecordKeyAdoptionDeps(),
      CLIENT_PLAN_KINDS,
    );
    return { changed };
  },
);
