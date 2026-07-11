import { Timestamp } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

/**
 * Publica um evento de domínio para o Workflow Engine, gravando em
 * `tenants/{tenantId}/workflow_events`. Qualquer outra Cloud Function pode chamar isso sem
 * saber nada sobre o motor — é a única forma de "acordar" um workflow.
 *
 * Retorna o id do documento de evento criado, usado para correlacionar a execução resultante
 * (`workflow_executions` guarda o `eventId`).
 */
export const publishEvent = async (
  db: Firestore,
  tenantId: string,
  name: string,
  payload: Record<string, unknown>,
): Promise<string> => {
  const ref = await db.collection('tenants').doc(tenantId).collection('workflow_events').add({
    name,
    payload,
    timestamp: Timestamp.now(),
  });
  return ref.id;
};
