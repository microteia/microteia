// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/workflowWait.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

export const WAIT_FOR_STEP_ID = 'wait-for';

/** O kernel a partir do qual existe o passo `wait-for`. */
export const WORKFLOW_WAIT_FOR_SINCE_KERNEL = '2.113.0';

/** Sem prazo declarado, a espera dura isto: esperar para sempre é uma execução que ninguém vê acabar. */
export const DEFAULT_WAIT_DAYS = 30;
export const MAX_WAIT_DAYS = 365;

/**
 * O que uma execução parada num `wait-for` espera: o PRÓXIMO evento `eventName` do registro
 * `recordId` — e, com `until`, só o que atende à condição.
 *
 * `until` é o TEXTO da expressão, guardado na continuação, e não o valor dela: é avaliado quando cada
 * evento chega, contra o registro como ele chegou — o mesmo `event.<campo>` de um gatilho.
 */
export interface WorkflowWait {
  eventName: string;
  recordId: string;
  until?: string;
}

/**
 * A chave pela qual o barramento acha quem espera um evento — uma só, para a consulta ser de um campo
 * e o índice automático do Firestore a atender.
 */
export const workflowWaitKey = (eventName: string, recordId: string): string => `${eventName}|${recordId}`;

/** O evento é de REGISTRO (`<prefixo>.saved` ou `.deleted`): só esses têm um registro a correlacionar. */
export const isRecordEventName = (eventName: string): boolean =>
  /^[^.\s]+(\.[^.\s]+)*\.(saved|deleted)$/.test(eventName);
