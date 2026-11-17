export interface ExecutionHistoryPurge {
  deleted: number;
  /** `false` quando o tempo acabou antes da última página — o resto fica para a próxima passada. */
  complete: boolean;
}

/**
 * A varredura que apaga o histórico vencido, separada de `IWorkflowExecutionRepository` porque só o
 * relógio a usa: quem executa automação não tem por que saber apagar histórico.
 */
export interface IExecutionHistoryRetention {
  /** Apaga resumo e detalhe de cada execução vencida, de todos os escritórios, enquanto `hasTime()`. */
  purgeExpired(now: Date, hasTime: () => boolean): Promise<ExecutionHistoryPurge>;
}
