// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/workflowAuditTrigger.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import type { NativeFieldSpec } from './entityRegistry';

/**
 * O gatilho "Ao registrar auditoria" — `eventName: 'audit.recorded'`. Uma automação reage a cada log
 * gravado na Auditoria do escritório e decide pelo conteúdo dele (severidade, ação, entidade) o que
 * fazer — avisar alguém, abrir uma pendência.
 *
 * O nome não colide com evento de coleção: `recorded` não é ação de registro (`saved`, `deleted`,
 * `dateReached`), e `splitEntityEventName` o devolve como `null`.
 */
export const WORKFLOW_AUDIT_EVENT = 'audit.recorded';

/** O kernel a partir do qual o gatilho existe. Num kernel anterior a automação instala e nunca dispara. */
export const WORKFLOW_AUDIT_SINCE_KERNEL = '2.45.0';

/** O `tenantId` do log que não pertence a escritório nenhum (erro global do pipeline). */
export const SYSTEM_AUDIT_TENANT = 'SYSTEM';

/**
 * Os autores que são a PRÓPRIA máquina: `system` (o passo "Registrar Auditoria", o destino Auditoria do
 * "Notificar", os jobs do kernel, o erro do pipeline) e `workflow-engine` (o registro gravado por uma
 * automação sem pessoa por trás).
 *
 * O log de máquina não acorda automação de auditoria. É a trava CAUSAL contra o laço, e é ela — não a
 * lista de passos proibidos — que fecha os caminhos indiretos: a automação de auditoria roda sem ator,
 * então tudo o que ela grava sai carimbado como `workflow-engine`, e o log resultante não volta a ela,
 * seja qual for o passo (gravar registro, Script, chamar outro fluxo, notificar com destino Auditoria).
 */
export const MACHINE_AUDIT_AUTHORS: readonly string[] = ['system', 'workflow-engine'];

export interface AuditEventSource {
  tenantId?: unknown;
  userId?: unknown;
}

/** O log pode acordar uma automação: tem escritório, e uma pessoa por trás. */
export const isAuditEventEligible = (log: AuditEventSource): boolean => {
  if (typeof log.tenantId !== 'string' || !log.tenantId || log.tenantId === SYSTEM_AUDIT_TENANT) return false;
  if (typeof log.userId !== 'string' || !log.userId) return false;
  return !MACHINE_AUDIT_AUTHORS.includes(log.userId);
};

const PAYLOAD_KEYS = [
  'title',
  'titleParams',
  'text',
  'textParams',
  'severity',
  'type',
  'action',
  'entity',
  'entityId',
  'linkCollection',
  'linkRecordId',
  'userId',
  'userName',
  'createdAt',
] as const;

/**
 * O payload do evento: o log como foi gravado, menos o que é da infraestrutura (`tenantId`, que o
 * evento já carrega no caminho; `expiresAt`, `photoURL`, `entityLink`). `title` e `text` costumam ser
 * REFERÊNCIAS de mensagem, e seguem com os `*Params` para que o passo seguinte as repasse inteiras.
 */
export const auditEventPayload = (id: string, log: Record<string, unknown>): Record<string, unknown> => {
  const payload: Record<string, unknown> = { id };
  for (const key of PAYLOAD_KEYS) {
    if (log[key] !== undefined && log[key] !== null) payload[key] = log[key];
  }
  return payload;
};

export const AUDIT_EVENT_FIELDS: NativeFieldSpec[] = [
  {
    key: 'severity',
    label: '@core.automation/event-field.audit-severity',
    type: 'string',
    options: [
      { key: 'LOW', label: '@core.admin/audit.severity.low' },
      { key: 'HIGH', label: '@core.admin/audit.severity.high' },
      { key: 'CRITICAL', label: '@core.admin/audit.severity.critical' },
    ],
  },
  {
    key: 'action',
    label: '@core.automation/event-field.audit-action',
    type: 'string',
    options: [
      { key: 'CREATE', label: '@core.admin/audit.action.create' },
      { key: 'UPDATE', label: '@core.admin/audit.action.update' },
      { key: 'DELETE', label: '@core.admin/audit.action.delete' },
      { key: 'SYSTEM', label: '@core.admin/audit.action.system' },
    ],
  },
  {
    key: 'type',
    label: '@core.automation/event-field.audit-type',
    type: 'string',
    options: [
      { key: 'AUDIT', label: '@core.automation/event-field.audit-type.audit' },
      { key: 'ERROR', label: '@core.automation/event-field.audit-type.error' },
    ],
  },
  { key: 'title', label: '@core.automation/event-field.audit-title', type: 'string' },
  { key: 'text', label: '@core.automation/event-field.audit-text', type: 'string' },
  { key: 'entity', label: '@core.automation/event-field.audit-entity', type: 'string' },
  { key: 'entityId', label: '@core.automation/event-field.audit-entity-id', type: 'string' },
  { key: 'linkCollection', label: '@core.automation/event-field.audit-link-collection', type: 'string' },
  { key: 'linkRecordId', label: '@core.automation/event-field.audit-link-record-id', type: 'string' },
  { key: 'userId', label: '@core.automation/event-field.audit-user-id', type: 'string' },
  { key: 'userName', label: '@core.automation/event-field.audit-user-name', type: 'string' },
  { key: 'createdAt', label: '@core.automation/event-field.created-at', type: 'date' },
];
