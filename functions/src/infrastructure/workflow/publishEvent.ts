import { Timestamp } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

/**
 * Publica um evento de domínio para o Workflow Engine, gravando em
 * `tenants/{tenantId}/workflow_events`. Qualquer outra Cloud Function pode chamar isso sem
 * saber nada sobre o motor — é a única forma de "acordar" um workflow.
 */
export const publishEvent = async (
  db: Firestore,
  tenantId: string,
  name: string,
  payload: Record<string, unknown>,
): Promise<void> => {
  await db.collection('tenants').doc(tenantId).collection('workflow_events').add({
    name,
    payload,
    timestamp: Timestamp.now(),
  });
};
