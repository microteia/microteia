/**
 * Uma automação temporal vista pelo relógio do kernel: QUANDO ela é devida e o que decide isso.
 * Mora em `tenants/{t}/workflow_clock/{definitionId}`, coleção que só o kernel escreve.
 */
export interface WorkflowClockEntry {
  tenantId: string;
  definitionId: string;
  kind: 'schedule';
  cron: string;
  /** O fuso declarado na automação, quando ela sobrescreve o do escritório. */
  declaredTimeZone: string | null;
  /** O fuso com que `nextRunAt` foi calculado — o declarado ou o do escritório naquele momento. */
  timeZone: string;
  nextRunAt: Date;
}

export type WorkflowClockFireResult = 'fired' | 'stale';

export interface IWorkflowClockRepository {
  find(tenantId: string, definitionId: string): Promise<WorkflowClockEntry | null>;
  save(entry: WorkflowClockEntry): Promise<void>;
  remove(tenantId: string, definitionId: string): Promise<void>;
  /** As entradas vencidas de TODOS os escritórios, as mais atrasadas primeiro. */
  due(now: Date, limit: number): Promise<WorkflowClockEntry[]>;
  /**
   * Publica o evento da ocorrência `entry.nextRunAt` e move a entrada para `next` (ou a apaga, quando
   * não há próxima) NUMA transação. `stale` quando outra passada já o fez — a entrada mudou, ou o evento
   * daquela ocorrência já existe. É o que faz duas passadas simultâneas dispararem uma vez só.
   */
  fire(entry: WorkflowClockEntry, payload: Record<string, unknown>, next: Date | null): Promise<WorkflowClockFireResult>;
}
