export interface ExecutionHistoryPurge {
  deleted: number;
  /** `false` quando o tempo acabou antes da última página — o resto fica para a próxima passada. */
  complete: boolean;
}

/**
 * As varreduras do histórico, separadas de `IWorkflowExecutionRepository` porque só o relógio as usa:
 * quem executa automação não tem por que saber apagar histórico, nem dar por morta a execução de outro.
 */
export interface IExecutionHistoryRetention {
  /** Apaga resumo e detalhe de cada execução vencida, de todos os escritórios, enquanto `hasTime()`. */
  purgeExpired(now: Date, hasTime: () => boolean): Promise<ExecutionHistoryPurge>;
  /**
   * Fecha como `FAILED`, com `message`, até `limit` execuções que ainda dizem `RUNNING` e começaram antes
   * de `startedBefore` — de todos os escritórios. Devolve quantas fechou. A que terminou entre a leitura
   * e a gravação é deixada como está.
   */
  closeAbandoned(startedBefore: Date, now: Date, message: string, limit: number): Promise<number>;
}
