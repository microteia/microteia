// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/workflowBudget.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

import type { SettingsProperty } from './settings';

/**
 * O ORÇAMENTO DE TEMPO de uma execução de automação.
 *
 * O `timeoutSeconds` de uma Cloud Function é fixado no deploy e vale para o projeto inteiro; o que o
 * escritório escolhe é quanto do teto as automações DELE podem usar. A diferença importa: cortada pela
 * plataforma, a function morre no meio e a execução some do histórico; cortada pelo orçamento, o motor
 * recusa o passo seguinte e grava a execução como falha, dizendo por quê.
 *
 * Os tetos moram aqui, e não no handler, para que a tela de Configurações recuse o valor que a
 * function não conseguiria honrar.
 */

/** O `timeoutSeconds` de `onWorkflowEventCreated` — o máximo de uma function de evento (2ª geração). */
export const WORKFLOW_EVENT_TIMEOUT_CEILING_SECONDS = 540;

/** O `timeoutSeconds` das portas em que uma pessoa espera a resposta (`runAction`). */
export const WORKFLOW_ACTION_TIMEOUT_CEILING_SECONDS = 300;

/**
 * O que fica reservado depois do orçamento para gravar a execução. Sem a folga, o orçamento igual ao
 * teto deixaria a gravação do histórico para depois de a plataforma já ter encerrado a function.
 */
export const WORKFLOW_BUDGET_MARGIN_SECONDS = 15;

export const WORKFLOW_EVENT_BUDGET_SETTING = 'automation.budget.eventSeconds';
export const WORKFLOW_ACTION_BUDGET_SETTING = 'automation.budget.actionSeconds';

const EVENT_BUDGET_PROPERTY: SettingsProperty = {
    key: WORKFLOW_EVENT_BUDGET_SETTING,
    label: '@core.automation/settings.budget.event',
    description: '@core.automation/settings.budget.event.description',
    type: 'number',
    default: 300,
    min: 30,
    max: WORKFLOW_EVENT_TIMEOUT_CEILING_SECONDS,
    scopes: ['tenant'],
};

const ACTION_BUDGET_PROPERTY: SettingsProperty = {
    key: WORKFLOW_ACTION_BUDGET_SETTING,
    label: '@core.automation/settings.budget.action',
    description: '@core.automation/settings.budget.action.description',
    type: 'number',
    default: 60,
    min: 10,
    max: WORKFLOW_ACTION_TIMEOUT_CEILING_SECONDS,
    scopes: ['tenant'],
};

export const WORKFLOW_BUDGET_SETTINGS_PROPERTIES: readonly SettingsProperty[] = [EVENT_BUDGET_PROPERTY, ACTION_BUDGET_PROPERTY];

export type WorkflowBudgetPort = 'event' | 'action';

const BY_PORT: Record<WorkflowBudgetPort, { property: SettingsProperty; ceiling: number }> = {
  event: { property: EVENT_BUDGET_PROPERTY, ceiling: WORKFLOW_EVENT_TIMEOUT_CEILING_SECONDS },
  action: { property: ACTION_BUDGET_PROPERTY, ceiling: WORKFLOW_ACTION_TIMEOUT_CEILING_SECONDS },
};

/** A configuração que governa a porta — é ela que o servidor lê. */
export const workflowBudgetProperty = (port: WorkflowBudgetPort): SettingsProperty => BY_PORT[port].property;

/**
 * O instante (epoch ms) a partir do qual o motor não começa mais nenhum passo. Valor fora da faixa,
 * ou ausente, cai no padrão declarado — configuração inválida não pode deixar a automação sem limite.
 */
export const workflowDeadlineAt = (
  port: WorkflowBudgetPort,
  startedAtMs: number,
  configuredSeconds: unknown,
): number => {
  const { property, ceiling } = BY_PORT[port];
  const valid = typeof configuredSeconds === 'number' && Number.isFinite(configuredSeconds)
    && configuredSeconds >= (property.min ?? 0) && configuredSeconds <= (property.max ?? Infinity);
  const seconds = valid ? configuredSeconds : (property.default as number);
  const usable = Math.min(seconds, ceiling - WORKFLOW_BUDGET_MARGIN_SECONDS);
  return startedAtMs + usable * 1000;
};
