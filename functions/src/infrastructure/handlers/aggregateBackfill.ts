import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { getDI } from '../di/container';
import { AGGREGATE_BACKFILL_COLLECTION } from '../../domain/schema/aggregateBackfill';
import type { AggregateBackfillPlan } from '../../domain/schema/aggregateBackfill';
import { reconcileAggregateBackfills, runAggregateBackfillRound } from '../../domain/services/aggregateBackfill';
import { isOfficeMember } from './shared/requirePermission';

const REGION = 'southamerica-east1';

/**
 * Entrega do gatilho mais velha que isto não é refeita: com `retry`, o Firebase reentrega uma falha
 * por dias, e uma rodada que falha sempre do mesmo jeito viraria custo sem fim. A passada parada é
 * acordada pela próxima conferência (`nudge`), não pela insistência.
 */
const MAX_EVENT_AGE_MS = 15 * 60_000;

/**
 * A porta automática: toda gravação de tela confere declarado × recalculado. Ela vem da DECLARAÇÃO, e
 * não da instalação — o pacote, o Form Design, o MCP e o Console mudam a tela por caminhos diferentes,
 * e todos passam por aqui.
 */
export const reconcileAggregatesOnScreenChange = onDocumentWritten(
  { document: 'tenants/{tenantId}/screenDefinitions/{screenId}', region: REGION },
  async (event) => {
    const { tenantId } = event.params;
    try {
      await reconcileAggregateBackfills(tenantId, getDI().getAggregateBackfillDeps());
    } catch (error) {
      console.error(`[aggregate-backfill] Falha ao conferir os agregados de ${tenantId}:`, error);
    }
  },
);

/**
 * Uma rodada por gravação no job. A rodada fecha gravando o cursor — e é essa gravação que dispara a
 * seguinte. As gravações que não abrem rodada (a reserva, o fim da passada) saem sem fazer nada.
 */
export const runAggregateBackfill = onDocumentWritten(
  {
    document: `tenants/{tenantId}/${AGGREGATE_BACKFILL_COLLECTION}/{table}`,
    region: REGION,
    retry: true,
    timeoutSeconds: 300,
  },
  async (event) => {
    if (!event.data?.after.exists) return;
    if (Date.now() - new Date(event.time).getTime() > MAX_EVENT_AGE_MS) return;

    const { tenantId, table } = event.params;
    await runAggregateBackfillRound(tenantId, table, getDI().getAggregateBackfillDeps());
  },
);

/**
 * O que a callable pode pôr em marcha. `resume` e `settle` ficam de fora: só uma gravação de tela
 * desbloqueia uma passada ou tira um agregado da declaração, e essa gravação já passa pela porta
 * automática.
 */
const CLIENT_PLAN_KINDS: ReadonlySet<AggregateBackfillPlan['kind']> = new Set(['start', 'nudge']);

/**
 * A conferência pedida pelo próprio app — o mesmo molde de `syncTenantPermissions`. O front compara o
 * que a tela declara com o que o job diz ter recalculado e chama isto quando divergem. É o que cobre o
 * escritório que já tinha agregados antes de o recálculo existir: ali nenhuma tela muda depois da
 * atualização, e a porta automática nunca dispararia.
 *
 * **Pede pertencimento, não permissão.** A operação não concede nada nem aceita parâmetro além do
 * escritório: ela só põe em marcha o que a declaração já pede, e uma chamada repetida custa duas
 * leituras e nenhuma gravação.
 */
export const reconcileAggregates = onCall(
  { region: REGION, cors: true },
  async (request): Promise<{ changed: number }> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');
    }

    const { tenantId } = request.data as { tenantId?: string };
    if (!tenantId) {
      throw new HttpsError('invalid-argument', '@core.automation/handler.tenant.missing');
    }

    if (!(await isOfficeMember(tenantId, request.auth.uid))) {
      throw new HttpsError('permission-denied', '@core.access/permission.denied', {
        permission: 'members',
      });
    }

    const changed = await reconcileAggregateBackfills(
      tenantId,
      getDI().getAggregateBackfillDeps(),
      CLIENT_PLAN_KINDS,
    );
    return { changed };
  },
);
