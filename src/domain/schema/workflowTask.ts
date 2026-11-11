// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/workflowTask.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * A TAREFA HUMANA de uma automação — o que o passo `approval` pede a uma pessoa, e a resposta dela.
 *
 * É o que transforma automação em processo: aprovar um desconto, liberar um crédito, revisar um texto.
 * A automação PARA no passo, a tarefa aparece na caixa de quem decide, e a decisão retoma a MESMA
 * execução, com o desfecho como saída do passo. O kernel não sabe o que está sendo aprovado — sabe só
 * que alguém precisa escolher entre desfechos declarados.
 */

export const WORKFLOW_TASKS_COLLECTION = 'workflow_tasks';

/** A página da caixa de tarefas — e a aba para onde o aviso de uma tarefa nova leva. */
export const WORKFLOW_TASKS_PAGE_KEY = 'workflow-tasks';

export const APPROVAL_STEP_ID = 'approval';

/** O desfecho de quando ninguém decidiu a tempo, salvo quando o passo declara outro. */
export const APPROVAL_EXPIRED_OUTCOME = 'expired';

/** O prazo mais longo que uma tarefa pode ter: o mesmo teto da espera do `delay`. */
export const MAX_APPROVAL_DAYS = 365;

/** O kernel que passou a entender o passo `approval` e a caixa de tarefas. */
export const WORKFLOW_APPROVAL_SINCE_KERNEL = '2.110.0';

export type WorkflowTaskStatus = 'open' | 'decided' | 'expired';

/**
 * Um desfecho que a pessoa pode escolher. `key` é o que a automação compara depois (`outcome`);
 * `label` é o que o botão diz — referência `@ns/chave` nos desfechos padrão, texto do escritório nos
 * que ele digitou (passa intacto por `useLabel`).
 */
export interface WorkflowTaskOutcome {
  key: string;
  label: string;
}

/** Os desfechos de quando o passo não declara nenhum: aprovar e recusar. */
export const DEFAULT_APPROVAL_OUTCOMES: readonly WorkflowTaskOutcome[] = [
  { key: 'approved', label: '@core.automation/task.outcome.approved' },
  { key: 'rejected', label: '@core.automation/task.outcome.rejected' },
];

/** O registro de que a tarefa fala, quando ela fala de um — o clique na caixa o abre. */
export interface WorkflowTaskTarget {
  collection: string;
  recordId: string;
}

export interface WorkflowTask {
  id: string;
  tenantId: string;
  workflowDefinitionId: string;
  executionId: string;
  stepId: string;
  /** REFERÊNCIA ou texto do escritório, como no passo "Notificar". */
  title: string;
  message: string;
  /** Quem pode decidir. A consulta da caixa é `array-contains` por aqui. */
  assigneeIds: string[];
  outcomes: WorkflowTaskOutcome[];
  status: WorkflowTaskStatus;
  createdAt: Date;
  /** `null` = sem prazo próprio; a tarefa vale até o teto da espera. */
  dueAt: Date | null;
  target: WorkflowTaskTarget | null;
  outcome?: string;
  decidedBy?: string;
  decidedByName?: string;
  decidedAt?: Date;
  comment?: string;
}

/**
 * O id da tarefa: um por execução e por passo. Determinístico de propósito — a retentativa do passo
 * (`onError.retries`) e uma retomada repetida encontram a MESMA tarefa em vez de criar outra, e a caixa
 * de quem decide não mostra o mesmo pedido duas vezes.
 */
export const workflowTaskId = (executionId: string, stepId: string): string => `${executionId}_${stepId}`;

const slug = (value: string): string =>
  value.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * Os desfechos que o passo declara, como texto do escritório — um por item, na ordem. A chave sai do
 * texto (`Aprovar com ressalva` → `aprovar-com-ressalva`), e é ela que a automação compara; o rótulo é o
 * texto como foi digitado. Sem nenhum, os padrões. Repetidos e vazios saem.
 */
export const approvalOutcomesOf = (declared: unknown): WorkflowTaskOutcome[] => {
  const items = Array.isArray(declared) ? declared : typeof declared === 'string' ? declared.split(',') : [];
  const seen = new Set<string>();
  const outcomes: WorkflowTaskOutcome[] = [];
  for (const item of items) {
    const label = typeof item === 'string' ? item.trim() : '';
    const key = slug(label);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    outcomes.push({ key, label });
  }
  return outcomes.length > 0 ? outcomes : [...DEFAULT_APPROVAL_OUTCOMES];
};
