import { Timestamp } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import type { PublishedActor } from '../../domain/engine/workflowActor';

/**
 * A forma de um documento de `workflow_events` — o barramento do motor. Uma só, para `publishEvent` e
 * para o relógio do kernel, que grava o evento dentro de uma transação e por isso não passa por ele.
 */
export const workflowEventsRef = (db: Firestore, tenantId: string) =>
  db.collection('tenants').doc(tenantId).collection('workflow_events');

export interface WorkflowEventDocumentOptions {
  actor?: PublishedActor;
  /**
   * O id da ÚNICA automação que este evento acorda. É o que o relógio do kernel usa: um `schedule`
   * pertence a uma automação, e publicá-lo sem alvo acordaria todas as automações de horário do
   * escritório a cada disparo de qualquer uma delas. Fica ao lado do payload pelo mesmo motivo de
   * `actor`, e pela mesma razão o cliente não pode escrevê-lo.
   */
  target?: string;
}

export const workflowEventDocument = (
  name: string,
  payload: Record<string, unknown>,
  options: WorkflowEventDocumentOptions = {},
): Record<string, unknown> => ({
  name,
  payload,
  ...(options.actor ? { actor: options.actor } : {}),
  ...(options.target ? { target: options.target } : {}),
  timestamp: Timestamp.now(),
});
