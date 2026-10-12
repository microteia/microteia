import type { Firestore } from 'firebase-admin/firestore';
import type { PublishedActor } from '../../domain/engine/workflowActor';
import { workflowEventDocument, workflowEventsRef } from '../../data/services/workflowEventDocument';

/**
 * Publica um evento de domínio para o Workflow Engine, gravando em
 * `tenants/{tenantId}/workflow_events`. Qualquer outra Cloud Function pode chamar isso sem
 * saber nada sobre o motor — é a única forma de "acordar" um workflow.
 *
 * Retorna o id do documento de evento criado, usado para correlacionar a execução resultante
 * (`workflow_executions` guarda o `eventId`).
 *
 * `actor` é QUEM causou o evento, quando uma pessoa causou — gravado AO LADO do payload, nunca dentro
 * dele: o payload são os parâmetros declarados, e um parâmetro chamado `actor` colidiria. Só o Admin
 * SDK o escreve; a regra do Firestore recusa um evento publicado pelo cliente que o traga, e é isso
 * que impede alguém de disparar uma automação em nome de outra pessoa.
 */
export const publishEvent = async (
  db: Firestore,
  tenantId: string,
  name: string,
  payload: Record<string, unknown>,
  actor?: PublishedActor,
): Promise<string> => {
  const ref = await workflowEventsRef(db, tenantId).add(workflowEventDocument(name, payload, { actor }));
  return ref.id;
};
