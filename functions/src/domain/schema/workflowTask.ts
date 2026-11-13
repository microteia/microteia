// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/workflowTask.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

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

/** O kernel que passou a entender a aprovação pelo PORTAL (`portalGuests`) e o QUÓRUM (`quorum`). */
export const WORKFLOW_APPROVAL_PORTAL_SINCE_KERNEL = '2.125.0';

/** O kernel que passou a LEMBRAR quem ainda não decidiu (`remindEveryDays`). */
export const WORKFLOW_APPROVAL_REMINDER_SINCE_KERNEL = '2.126.0';

/** O maior intervalo entre lembretes. Acima disso já não é lembrete — é um segundo pedido. */
export const MAX_APPROVAL_REMINDER_DAYS = 30;

/** O kernel que passou a entender o REPASSE de uma tarefa e o ESCALONAMENTO por prazo (`escalateAfterDays`). */
export const WORKFLOW_APPROVAL_DELEGATION_SINCE_KERNEL = '2.128.0';

/** O motivo do repasse vai para o histórico e para a saída do passo; um texto sem fim não cabe em nenhum dos dois. */
export const MAX_DELEGATION_REASON_LENGTH = 500;

/**
 * Um REPASSE: quem estava designado passou a tarefa a outro membro — férias, outra área. Fica registrado
 * para sempre, porque a decisão de quem recebeu é tomada no lugar de quem repassou, e isso é o que uma
 * auditoria pergunta primeiro.
 */
export interface WorkflowTaskDelegation {
  from: string;
  fromName: string;
  to: string;
  toName: string;
  reason: string;
  at: Date;
}

/** Por onde o voto chegou: a caixa de tarefas (ou o MCP) de um membro, ou o portal de um convidado. */
export type WorkflowTaskVoteVia = 'member' | 'portal';

/** Um VOTO numa tarefa com quórum — cada pessoa vota uma vez, e o voto fica com nome e comentário. */
export interface WorkflowTaskVote {
  outcome: string;
  name: string;
  at: Date;
  comment: string;
  via: WorkflowTaskVoteVia;
}

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
  /** Os MEMBROS que podem decidir. A consulta da caixa é `array-contains` por aqui. */
  assigneeIds: string[];
  /**
   * Os CONVIDADOS do portal que podem decidir — os que viam o registro quando a tarefa nasceu. Lista à
   * parte de `assigneeIds` porque são duas portas: a caixa de tarefas é de membro, e a regra que deixa o
   * convidado ler a tarefa é outra.
   */
  guestIds?: string[];
  /**
   * Quantos votos no PRIMEIRO desfecho fecham a tarefa. Ausente ou 1: a primeira decisão fecha, como
   * sempre foi. "Todos" é gravado já como o número de quem pode votar.
   */
  quorum?: number;
  /** Os votos, por pessoa — só nas tarefas com quórum. */
  votes?: Record<string, WorkflowTaskVote>;
  /** De quantos em quantos dias quem ainda não decidiu é lembrado. Ausente: só o aviso de quando a tarefa nasceu. */
  remindEveryDays?: number;
  /** Quando sai o próximo lembrete; `null` quando não há mais nenhum antes do prazo. */
  nextReminderAt?: Date | null;
  /** Quantos lembretes já saíram — é o que faz cada um ser um aviso novo, e não a repetição do anterior. */
  reminders?: number;
  /** Os repasses, na ordem em que aconteceram. */
  delegations?: WorkflowTaskDelegation[];
  /**
   * Quando a tarefa SOBE: ninguém decidiu até aqui, e quem tem `escalatePermission` passa a decidir também.
   * `null` depois de escalonada (ou quando o escalonamento cairia no prazo).
   */
  escalateAt?: Date | null;
  escalatePermission?: string;
  /** Quando subiu, e quem entrou por isso — o histórico explica de onde veio quem decidiu. */
  escalatedAt?: Date;
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

/** Quem pode votar nesta tarefa: os membros designados e os convidados do portal. */
export const workflowTaskVoters = (task: Pick<WorkflowTask, 'assigneeIds' | 'guestIds'>): string[] =>
  [...new Set([...task.assigneeIds, ...(task.guestIds ?? [])])];

/**
 * O quórum DECLARADO, já como número: vazio ou `any` é 1 (a primeira decisão fecha); `all` é todo mundo
 * que pode votar; um inteiro é ele. `null` quando não se lê — ou quando pede mais votos do que há pessoas,
 * o que deixaria a tarefa aberta até o prazo sem que ninguém pudesse fechá-la.
 */
export const approvalQuorumOf = (declared: unknown, voters: number): number | null => {
  const text = typeof declared === 'number' ? String(declared) : typeof declared === 'string' ? declared.trim().toLowerCase() : '';
  if (text === '' || text === 'any') return 1;
  const required = text === 'all' ? voters : /^\d{1,3}$/.test(text) ? Number(text) : NaN;
  return Number.isInteger(required) && required >= 1 && required <= voters ? required : null;
};

/**
 * A APURAÇÃO depois de um voto. O quórum conta o PRIMEIRO desfecho (o "aprovar"):
 * - com quórum 1, o voto decide sozinho, qualquer que seja — a semântica de sempre;
 * - o primeiro desfecho fecha a tarefa ao atingir o quórum;
 * - assim que atingi-lo fica IMPOSSÍVEL (os votos que faltam não bastam), a tarefa fecha com o outro
 *   desfecho mais votado — no empate, o que vem antes na lista. Com "todos", uma recusa já fecha.
 */
export const tallyApprovalVotes = (
  task: Pick<WorkflowTask, 'assigneeIds' | 'guestIds' | 'outcomes' | 'quorum'>,
  votes: Record<string, Pick<WorkflowTaskVote, 'outcome' | 'at'>>,
): { closed: false } | { closed: true; outcome: string } => {
  const cast = Object.values(votes);
  if (cast.length === 0) return { closed: false };
  const required = Math.max(1, task.quorum ?? 1);
  if (required === 1) {
    const last = cast.reduce((latest, vote) => (vote.at.getTime() >= latest.at.getTime() ? vote : latest));
    return { closed: true, outcome: last.outcome };
  }
  const first = task.outcomes[0]?.key ?? '';
  const count = (key: string) => cast.filter((vote) => vote.outcome === key).length;
  if (count(first) >= required) return { closed: true, outcome: first };
  const remaining = workflowTaskVoters(task).length - cast.length;
  if (count(first) + remaining >= required) return { closed: false };
  const others = task.outcomes.slice(1).map((one) => one.key);
  const winner = others.reduce((best, key) => (count(key) > count(best) ? key : best), others[0] ?? first);
  return { closed: true, outcome: winner };
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** O intervalo declarado, em dias inteiros: vazio, zero ou inválido não lembra; acima do teto, o teto. */
export const approvalRemindEveryOf = (declared: unknown): number | null => {
  const days = typeof declared === 'number' ? declared : typeof declared === 'string' && declared.trim() !== '' ? Number(declared) : NaN;
  if (!Number.isFinite(days) || days < 1) return null;
  return Math.min(Math.floor(days), MAX_APPROVAL_REMINDER_DAYS);
};

/**
 * O PRÓXIMO lembrete depois de `from`, ou `null` quando ele cairia no prazo ou depois dele: no prazo a tarefa
 * fecha sozinha, e o lembrete chegaria junto com o "expirou".
 */
export const nextApprovalReminder = (from: Date, everyDays: number, until: Date): Date | null => {
  const next = new Date(from.getTime() + everyDays * DAY_MS);
  return next.getTime() < until.getTime() ? next : null;
};

/** Quem ainda deve a decisão: os designados — membros e convidados — que não votaram. */
export const pendingTaskVoters = (
  task: Pick<WorkflowTask, 'assigneeIds' | 'guestIds' | 'votes'>,
): { members: string[]; guests: string[] } => {
  const voted = new Set(Object.keys(task.votes ?? {}));
  return {
    members: task.assigneeIds.filter((id) => !voted.has(id)),
    guests: (task.guestIds ?? []).filter((id) => !voted.has(id)),
  };
};

export type DelegationRefusal = 'not-assignee' | 'not-open' | 'already-voted' | 'same-person' | 'already-assignee';

/**
 * O REPASSE, sobre a lista de designados: quem repassa sai, quem recebe entra no MESMO lugar — com quórum,
 * a vaga é a mesma, e ninguém ganha um voto a mais. Só repassa quem está designado e ainda não votou; não se
 * repassa para si mesmo nem para quem já decide (somaria dois lugares numa pessoa só).
 */
export const delegateTaskAssignees = (
  task: Pick<WorkflowTask, 'assigneeIds' | 'guestIds' | 'votes' | 'status'>,
  from: string,
  to: string,
): { ok: true; assigneeIds: string[] } | { ok: false; reason: DelegationRefusal } => {
  if (task.status !== 'open') return { ok: false, reason: 'not-open' };
  if (!task.assigneeIds.includes(from)) return { ok: false, reason: 'not-assignee' };
  if (task.votes?.[from]) return { ok: false, reason: 'already-voted' };
  if (from === to) return { ok: false, reason: 'same-person' };
  if (task.assigneeIds.includes(to) || (task.guestIds ?? []).includes(to)) return { ok: false, reason: 'already-assignee' };
  return { ok: true, assigneeIds: task.assigneeIds.map((id) => (id === from ? to : id)) };
};

/** Quando a tarefa sobe, ou `null` se isso cairia no prazo (no prazo ela fecha sozinha). */
export const approvalEscalationAt = (from: Date, afterDays: unknown, until: Date): Date | null => {
  const days = typeof afterDays === 'number' ? afterDays : typeof afterDays === 'string' && afterDays.trim() !== '' ? Number(afterDays) : NaN;
  if (!Number.isFinite(days) || days <= 0) return null;
  const at = new Date(from.getTime() + Math.min(days, MAX_APPROVAL_DAYS) * DAY_MS);
  return at.getTime() < until.getTime() ? at : null;
};
