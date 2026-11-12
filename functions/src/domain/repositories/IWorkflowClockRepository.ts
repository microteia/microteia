import type { PublishedActor } from '../engine/workflowActor';
import type { WorkflowClockLastRun } from '../schema/workflowClock';
import type { WorkflowWait } from '../schema/workflowWait';
import type { PagedLoopState } from '../schema/workflowLoopQuery';

interface WorkflowClockEntryBase {
  tenantId: string;
  definitionId: string;
  /** O fuso declarado na automação, quando ela sobrescreve o do escritório. */
  declaredTimeZone: string | null;
  /** O fuso com que `nextRunAt` foi calculado — o declarado ou o do escritório naquele momento. */
  timeZone: string;
  nextRunAt: Date;
  /** As extensões donas da automação — o relógio não acorda a de uma extensão desligada. */
  ownerPluginIds: string[];
  /** A última passada do relógio — o que a tela da automação mostra como "último disparo". */
  lastRun?: WorkflowClockLastRun | null;
}

/**
 * Uma automação de HORÁRIO vista pelo relógio do kernel: quando ela é devida e o que decide isso.
 * Mora em `tenants/{t}/workflow_clock/{definitionId}`, coleção que só o kernel escreve.
 */
export interface ScheduleClockEntry extends WorkflowClockEntryBase {
  kind: 'schedule';
  cron: string;
}

/** Onde a varredura de um dia grande parou — a volta seguinte continua daqui, na MESMA janela. */
export interface DateReachedPage {
  fromDay: string;
  toDay: string;
  afterValue: Date;
  afterId: string;
}

/**
 * Uma automação de DATA vista pelo relógio: o campo vigiado, e até que dia de data ela já olhou
 * (`cursorDay`). `nextRunAt` é a próxima vez que a hora `at` chega no fuso do escritório.
 *
 * A COLEÇÃO não é guardada: é resolvida a cada volta, a partir do prefixo do evento. A instalação grava a
 * automação antes da tela, e uma coleção congelada aqui seria a de uma tela que ainda não existia.
 */
export interface DateReachedClockEntry extends WorkflowClockEntryBase {
  kind: 'dateReached';
  eventName: string;
  field: string;
  offsetDays: number;
  at: string;
  cursorDay: string;
  page: DateReachedPage | null;
}

/**
 * Uma execução PARADA num passo `delay`: o que ela precisa para continuar quando `nextRunAt` chegar. Mora
 * no mesmo relógio (`workflow_clock/resume_<executionId>`), e por isso acorda pela mesma consulta.
 */
export interface ResumeClockEntry extends WorkflowClockEntryBase {
  kind: 'resume';
  executionId: string;
  afterStepId: string;
  lastStepId: string | null;
  event: { id: string; name: string; payload: Record<string, unknown>; timestamp: Date };
  outputs: Record<string, Record<string, unknown>>;
  variables: Record<string, unknown>;
  /** Quem disparou — a IDENTIDADE atravessa a espera; as permissões não (ver `actorFromPublished`). */
  actor: PublishedActor | null;
  /** A tarefa humana que a pausa espera (passo `approval`). Ausente numa espera de `delay`. */
  taskId?: string;
  /**
   * A tarefa foi DECIDIDA: a retomada vem da decisão, e as saídas já trazem o desfecho. Sem isto, a
   * retomada é o prazo vencido, e a tarefa é fechada como expirada.
   */
  decided?: boolean;
  /** O evento que a pausa espera (passo `wait-for`). Ausente nas outras esperas. */
  wait?: WorkflowWait;
  /**
   * A VERSÃO da automação em que a execução começou. A retomada roda essa versão, e não a de agora: um
   * passo editado durante a espera não pode mudar o resto de uma execução que já ia por outro caminho.
   */
  definitionVersion?: number;
  /** Onde o laço paginado parou (`loop.query`): a retomada volta a ele, com este cursor. */
  loop?: PagedLoopState;
}

export type WorkflowClockEntry = ScheduleClockEntry | DateReachedClockEntry | ResumeClockEntry;

export type WorkflowClockFireResult = 'fired' | 'stale';

export interface ClockAdvance {
  nextRunAt: Date;
  timeZone: string;
  cursorDay?: string;
  page?: DateReachedPage | null;
  lastRun?: WorkflowClockLastRun;
}

export interface DatedRecord {
  id: string;
  value: Date;
  data: Record<string, unknown>;
}

export interface ClaimedEvent {
  name: string;
  payload: Record<string, unknown>;
  target: string;
}

export interface IWorkflowClockRepository {
  find(tenantId: string, definitionId: string): Promise<WorkflowClockEntry | null>;
  save(entry: WorkflowClockEntry): Promise<void>;
  remove(tenantId: string, definitionId: string): Promise<void>;
  /** As entradas vencidas de TODOS os escritórios, as mais atrasadas primeiro. */
  due(now: Date, limit: number): Promise<WorkflowClockEntry[]>;
  /**
   * Publica o evento `lastRun.eventId` da ocorrência `entry.nextRunAt` e move a entrada para `next` (ou a
   * apaga, quando não há próxima) NUMA transação, gravando `lastRun` junto. `stale` quando outra passada já
   * o fez — a entrada mudou, ou o evento daquela ocorrência já existe. É o que faz duas passadas simultâneas
   * dispararem uma vez só.
   */
  fire(
    entry: ScheduleClockEntry,
    payload: Record<string, unknown>,
    next: Date | null,
    lastRun: WorkflowClockLastRun,
  ): Promise<WorkflowClockFireResult>;
  /**
   * Toma para si a retomada: apaga a entrada se ela ainda é a vista na consulta. `stale` quando outra
   * passada já a tomou — é o que faz uma execução continuar uma vez só.
   */
  claim(entry: ResumeClockEntry): Promise<WorkflowClockFireResult>;
  /**
   * Grava a DECISÃO de uma tarefa na continuação — as saídas do passo e `decided` — numa transação que
   * só atualiza a continuação que ainda está ali, com o mesmo `nextRunAt`. `stale` quando o relógio já
   * a tomou (o prazo venceu antes): gravar por cima recriaria a continuação, e a execução seguiria
   * duas vezes.
   */
  annotateResume(
    entry: ResumeClockEntry,
    outputs: Record<string, Record<string, unknown>>,
  ): Promise<WorkflowClockFireResult>;
  /**
   * As continuações do escritório que esperam o evento `eventName` do registro `recordId`
   * (`workflowWaitKey`). Uma consulta de UM campo: o índice automático a atende.
   */
  waitingFor(tenantId: string, eventName: string, recordId: string, limit: number): Promise<ResumeClockEntry[]>;
  /** Move a entrada sem publicar nada. `stale` quando outra passada já a moveu. */
  advance(entry: WorkflowClockEntry, patch: ClockAdvance): Promise<WorkflowClockFireResult>;
  /**
   * Os registros da coleção com `field` em `[from, to)`, na ordem da data e depois do id, a partir de
   * `after`. É uma faixa sobre UM campo: o índice automático do Firestore a atende, sem índice composto.
   */
  recordsInRange(
    tenantId: string,
    collection: string,
    field: string,
    from: Date,
    to: Date,
    after: { value: Date; id: string } | null,
    limit: number,
  ): Promise<DatedRecord[]>;
  /**
   * Grava a marca `markId` e publica o evento, juntos. `false` quando a marca já existia — o registro já
   * disparou para aquela data, por esta volta, por outra, ou pela gravação que o levou ao dia.
   */
  claimAndPublish(tenantId: string, markId: string, expiresAt: Date, event: ClaimedEvent): Promise<boolean>;
}
