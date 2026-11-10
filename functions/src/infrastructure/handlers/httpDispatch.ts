import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getDI } from '../di/container';
import { HTTP_DISPATCHES_COLLECTION, HTTP_TIMEOUT_MAX_SECONDS } from '../../domain/schema/httpRequestSpec';

/**
 * A ENTREGA da fila do passo "Chamar API (HTTP)" no modo assíncrono. Mesmo molde de
 * `runAggregateBackfill`: a gravação é o gatilho. O pedido nasce `queued`, e cada nova tentativa o
 * devolve a `queued` (o relógio do kernel faz isso quando a espera vence) — é essa gravação que acorda
 * esta function. As demais gravações (`sending`, `waiting`, o fim) saem na primeira linha.
 *
 * Sem `retry`: a retentativa é da fila, com intervalo e teto próprios. Uma entrega que morre no meio
 * deixa a reserva vencer, e o relógio a devolve à fila.
 */
export const onHttpDispatchWritten = onDocumentWritten(
  {
    document: `tenants/{tenantId}/${HTTP_DISPATCHES_COLLECTION}/{dispatchId}`,
    region: 'southamerica-east1',
    timeoutSeconds: HTTP_TIMEOUT_MAX_SECONDS + 60,
  },
  async (event) => {
    if (event.data?.after.get('status') !== 'queued') return;
    const { tenantId, dispatchId } = event.params;
    try {
      const result = await getDI().getDeliverHttpDispatchUseCase().execute(tenantId, dispatchId);
      if (result !== 'skipped') console.log(`[http-dispatch] ${tenantId}/${dispatchId}: ${result}`);
    } catch (error) {
      console.error(`[http-dispatch] Falha ao entregar ${tenantId}/${dispatchId}:`, error);
    }
  },
);
