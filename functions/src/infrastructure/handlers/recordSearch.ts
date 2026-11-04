import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { getDI } from '../di/container';
import { RESERVED_COLLECTIONS } from '../../domain/schema/screenEntity';
import { RECORD_SEARCH_JOBS_COLLECTION } from '../../domain/schema/recordSearch';
import {
  deriveRecordSearchOnWrite,
  reconcileRecordSearch as reconcileRecordSearchForTenant,
  runRecordSearchRound,
} from '../../domain/services/recordSearchEngine';
import { encodeRecordVersion } from '../../data/repositories/FirebaseRecordSearchRepository';
import { isOfficeMember } from './shared/requirePermission';

const REGION = 'southamerica-east1';

/** O mesmo teto do backfill dos agregados: uma rodada que falha sempre igual não vira custo sem fim. */
const MAX_EVENT_AGE_MS = 15 * 60_000;

/**
 * Os termos de busca de um registro, e a propagação quando o título dele muda.
 *
 * Gatilho próprio, como o dos agregados e o do portal: uma falha na busca não pode derrubar a
 * auditoria nem os eventos. Coleção reservada sai antes de qualquer leitura — inclusive os próprios
 * jobs da busca, cuja gravação acorda este mesmo gatilho.
 */
export const deriveRecordSearchOnEntityChange = onDocumentWritten(
  { document: 'tenants/{tenantId}/{collection}/{docId}', region: REGION },
  async (event) => {
    const { tenantId, collection, docId } = event.params;
    if (RESERVED_COLLECTIONS.has(collection)) return;
    const before = event.data?.before;
    const after = event.data?.after;
    try {
      await deriveRecordSearchOnWrite(
        tenantId,
        collection,
        docId,
        before?.exists ? (before.data() as Record<string, unknown>) : null,
        after?.exists
          ? { id: docId, data: after.data() as Record<string, unknown>, version: encodeRecordVersion(after.updateTime) }
          : null,
        getDI().getRecordSearchDeps(),
      );
    } catch (error) {
      console.error(`[record-search] Falha ao derivar a busca de ${tenantId}/${collection}/${docId}:`, error);
    }
  },
);

/**
 * Uma rodada por gravação no job. A rodada fecha gravando o avanço — e é essa gravação que dispara a
 * seguinte. Uma rodada que falha é reentregue (`retry`); a que passou do teto de idade é acordada
 * pela próxima conferência.
 */
export const runRecordSearchJob = onDocumentWritten(
  {
    document: `tenants/{tenantId}/${RECORD_SEARCH_JOBS_COLLECTION}/{jobId}`,
    region: REGION,
    retry: true,
    timeoutSeconds: 300,
  },
  async (event) => {
    const after = event.data?.after;
    if (!after?.exists) return;
    if (Date.now() - new Date(event.time).getTime() > MAX_EVENT_AGE_MS) return;
    const round = (after.data() as { round?: unknown }).round;
    const { tenantId, jobId } = event.params;
    await runRecordSearchRound(tenantId, jobId, typeof round === 'number' ? round : 0, getDI().getRecordSearchDeps());
  },
);

/**
 * A porta automática: toda gravação de tela confere o que entra na busca. Vem da DECLARAÇÃO, e não da
 * instalação — o pacote, o Form Design, o MCP e o Console mudam a tela por caminhos diferentes, e
 * todos passam por aqui.
 */
export const reconcileRecordSearchOnScreenChange = onDocumentWritten(
  { document: 'tenants/{tenantId}/screenDefinitions/{screenId}', region: REGION },
  async (event) => {
    const { tenantId } = event.params;
    try {
      await reconcileRecordSearchForTenant(tenantId, getDI().getRecordSearchDeps());
    } catch (error) {
      console.error(`[record-search] Falha ao conferir a busca de ${tenantId}:`, error);
    }
  },
);

/**
 * A conferência pedida pela listagem — a porta que cobre o escritório que atualiza o kernel com
 * registros antigos e não salva tela nenhuma depois. Pede pertencimento, não permissão: ela não
 * concede nada nem aceita parâmetro além do escritório, e repetida custa as leituras da conferência e
 * nenhuma gravação.
 */
export const reconcileRecordSearch = onCall(
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
      throw new HttpsError('permission-denied', '@core.access/permission.denied', { permission: 'members' });
    }
    const changed = await reconcileRecordSearchForTenant(tenantId, getDI().getRecordSearchDeps());
    return { changed };
  },
);
