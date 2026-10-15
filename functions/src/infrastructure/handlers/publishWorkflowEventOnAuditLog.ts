import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getDb } from '../firebase/initFirebase';
import { getDI } from '../di/container';
import { publishEvent } from '../workflow/publishEvent';
import {
  WORKFLOW_AUDIT_EVENT,
  auditEventPayload,
  isAuditEventEligible,
} from '../../domain/schema/workflowAuditTrigger';

/**
 * Publica `audit.recorded` para cada log da Auditoria que uma pessoa causou. Fica FORA do
 * `CreateAuditLogUseCase` de propósito: o log é gravado por meia dúzia de caminhos (os gatilhos de
 * auditoria, a callable de erro do cliente, os jobs do kernel), e o evento nasce do documento — como os
 * de registro nascem do registro —, sem que nenhum deles conheça o motor.
 *
 * Duas filtragens, nesta ordem:
 * - o log de máquina não publica (`isAuditEventEligible`) — é a trava contra o laço, ver
 *   `MACHINE_AUDIT_AUTHORS`;
 * - o escritório sem automação de auditoria ligada não publica: a Auditoria grava um log por gravação
 *   de registro, e um evento por log dobraria as escritas de todo escritório para servir a nenhum.
 *   A consulta custa uma leitura; o evento, uma escrita e uma invocação.
 *
 * O evento é publicado SEM ator: quem causou o log está no payload (`userId`, `userName`), mas a
 * automação de auditoria grava como o motor. É o que faz o que ela grava voltar como log de máquina.
 */
export const publishWorkflowEventOnAuditLog = onDocumentCreated(
  { document: 'auditLogs/{logId}', region: 'southamerica-east1' },
  async (event) => {
    const { logId } = event.params;
    const data = event.data?.data() as Record<string, unknown> | undefined;
    if (!data || !isAuditEventEligible(data)) return;
    const tenantId = data.tenantId as string;

    try {
      const listening = await getDI()
        .getWorkflowDefinitionRepository()
        .findEnabledByEvent(tenantId, WORKFLOW_AUDIT_EVENT);
      if (listening.length === 0) return;

      await publishEvent(getDb(), tenantId, WORKFLOW_AUDIT_EVENT, auditEventPayload(logId, data));
    } catch (error) {
      console.error(`[workflow] Falha ao publicar o evento de auditoria ${tenantId}/${logId}:`, error);
    }
  },
);
