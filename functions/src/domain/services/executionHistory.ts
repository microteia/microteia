import type { WorkflowExecution, WorkflowExecutionLogEntry } from '../entities/Workflow';
import { PERMISSION_AUTOMATION_MANAGE } from '../schema/access/kernelPermissions';
import { grants } from '../schema/access/memberPermissions';
import { EXECUTION_HISTORY_RETENTION_DAYS } from '../schema/executionHistory';
import { WORKFLOW_CLOCK_TICK_MINUTES } from '../schema/workflowClock';

/**
 * O histórico é a EVIDÊNCIA do que aconteceu, não o depósito dos dados: a execução recebe o texto
 * inteiro, e o histórico guarda o começo dele e quanto faltou. Sem isto, um documento de 100 000
 * caracteres lido por um passo ficava inteiro no histórico — que todo membro do escritório lê.
 */
export const HISTORY_TEXT_MAX_CHARACTERS = 2_000;

/**
 * Abaixo do 1 MiB do documento do Firestore, com folga: o tamanho é estimado pelo JSON, e a conta do
 * Firestore (nomes de campo, carimbos de data) não é a mesma.
 */
export const HISTORY_MAX_BYTES = 900_000;

/** Quantas linhas sobram de cada ponta quando nem as mensagens cabem — um laço de milhares de voltas. */
export const HISTORY_EDGE_LINES = 50;

export const HISTORY_TOO_LARGE_MESSAGE = '@core.automation/run.history-too-large';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype;

/** O corte vai no TEXTO, e diz quanto ficou de fora — sem palavra, para não haver idioma no dado. */
export const trimForHistory = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return value.length <= HISTORY_TEXT_MAX_CHARACTERS
      ? value
      : `${value.slice(0, HISTORY_TEXT_MAX_CHARACTERS)}… [+${value.length - HISTORY_TEXT_MAX_CHARACTERS}]`;
  }
  if (Array.isArray(value)) return value.map(trimForHistory);
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, trimForHistory(item)]));
  }
  return value;
};

const trimEntry = (entry: WorkflowExecutionLogEntry): WorkflowExecutionLogEntry => ({
  ...entry,
  ...(entry.messageParams === undefined
    ? {}
    : { messageParams: trimForHistory(entry.messageParams) as Record<string, string> }),
  ...(entry.contextInput === undefined ? {} : { contextInput: trimForHistory(entry.contextInput) as Record<string, unknown> }),
  ...(entry.inputs === undefined ? {} : { inputs: trimForHistory(entry.inputs) as Record<string, unknown> }),
  ...(entry.outputs === undefined ? {} : { outputs: trimForHistory(entry.outputs) as Record<string, unknown> }),
});

const withoutData = (entry: WorkflowExecutionLogEntry): WorkflowExecutionLogEntry => ({
  level: entry.level,
  message: entry.message,
  at: entry.at,
  ...(entry.stepId === undefined ? {} : { stepId: entry.stepId }),
  ...(entry.stepDefinitionId === undefined ? {} : { stepDefinitionId: entry.stepDefinitionId }),
  ...(entry.messageParams === undefined ? {} : { messageParams: entry.messageParams }),
});

export const historyBytes = (execution: WorkflowExecution): number =>
  Buffer.byteLength(JSON.stringify(execution), 'utf8');

const tooLargeNotice = (execution: WorkflowExecution): WorkflowExecutionLogEntry => ({
  level: 'WARN',
  message: HISTORY_TOO_LARGE_MESSAGE,
  at: execution.finishedAt ?? execution.logs.at(-1)?.at ?? execution.startedAt,
});

/**
 * Só as mensagens: sem os dados de cada linha nem a saída final, e com as pontas quando nem isso
 * cabe. É também o que o repositório grava quando o Firestore recusa o histórico que a estimativa
 * aprovou — sem desfecho gravado, o Processador e o `get_workflow_run` esperariam para sempre.
 */
export const bareHistoryRecord = (execution: WorkflowExecution): WorkflowExecution => {
  const lines = execution.logs.map((entry) => withoutData(trimEntry(entry)));
  const notice = tooLargeNotice(execution);
  const bare: WorkflowExecution = { ...execution, logs: [...lines, notice], outputs: {} };
  if (historyBytes(bare) <= HISTORY_MAX_BYTES || lines.length <= HISTORY_EDGE_LINES * 2) return bare;
  return { ...bare, logs: [...lines.slice(0, HISTORY_EDGE_LINES), notice, ...lines.slice(-HISTORY_EDGE_LINES)] };
};

/**
 * O que vai para `workflow_executions`: os textos cortados e, quando nem assim cabe, só as mensagens.
 * Um histórico que não cabe não é gravado — e a execução já aplicou o que aplicou.
 */
export const historyRecord = (execution: WorkflowExecution): WorkflowExecution => {
  const trimmed: WorkflowExecution = {
    ...execution,
    logs: execution.logs.map(trimEntry),
    outputs: trimForHistory(execution.outputs) as Record<string, unknown>,
  };
  return historyBytes(trimmed) <= HISTORY_MAX_BYTES ? trimmed : bareHistoryRecord(execution);
};

/**
 * O detalhe — o que cada passo recebeu e devolveu — vai a quem gerencia automações e a quem DISPAROU a
 * execução; os outros ficam com o status. As mensagens andam com o detalhe, e não com o status, porque
 * os parâmetros delas carregam valor: "Variável copia0 definida com valor …" traz o texto que a
 * automação leu. É a fronteira do `firestore.rules` (`domain/schema/executionHistory.ts`), mais quem
 * disparou, que já recebe o desfecho da própria ação.
 */
export const seesExecutionDetail = (
  permissions: readonly string[],
  userId: string,
  execution: Pick<WorkflowExecution, 'actorId'>,
): boolean => grants(permissions, PERMISSION_AUTOMATION_MANAGE) || (execution.actorId !== undefined && execution.actorId === userId);

const DAY_MS = 24 * 60 * 60 * 1000;

/** As datas do resumo que contam para a retenção — as mesmas no histórico antigo e no atual. */
export type HistoryDates = Pick<WorkflowExecution, 'startedAt' | 'finishedAt' | 'resumeAt'>;

/**
 * Até quando o histórico fica: `EXECUTION_HISTORY_RETENTION_DAYS` depois da data mais tardia entre o
 * começo, o fim e a hora de continuar. Calculado na varredura, e não gravado num campo, para valer
 * igual para o histórico anterior a esta regra — que nunca teria o campo.
 */
export const historyRetainedUntil = (execution: HistoryDates): Date => {
  const latest = Math.max(
    execution.startedAt.getTime(),
    execution.finishedAt?.getTime() ?? 0,
    execution.resumeAt?.getTime() ?? 0,
  );
  return new Date(latest + EXECUTION_HISTORY_RETENTION_DAYS * DAY_MS);
};

export const isHistoryExpired = (execution: HistoryDates, now: Date): boolean =>
  historyRetainedUntil(execution).getTime() <= now.getTime();

/**
 * O limite que a CONSULTA da varredura usa: nada que começou depois dele pode ter vencido, porque o
 * começo é a menor das três datas. O que começou antes e ainda não venceu (a execução que espera) é
 * lido e deixado.
 */
export const historyStartedBefore = (now: Date): Date =>
  new Date(now.getTime() - EXECUTION_HISTORY_RETENTION_DAYS * DAY_MS);

/**
 * A varredura vai no relógio das automações, que passa a cada `WORKFLOW_CLOCK_TICK_MINUTES` — e roda
 * só na passada cujo minuto cai no primeiro intervalo da hora: uma vez por hora, sem estado guardado.
 * Um agendador próprio seria mais um job do Cloud Scheduler cobrado em cada projeto instalado, para uma
 * tarefa que tolera horas de atraso.
 */
export const isHistoryPurgeTick = (now: Date): boolean => now.getUTCMinutes() < WORKFLOW_CLOCK_TICK_MINUTES;
