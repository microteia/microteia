/**
 * A marca da última abertura REGISTRADA de um convidado num registro (ou num documento dele) — o freio
 * que impede o mesmo convidado de gerar uma linha de Auditoria e uma execução de automação a cada clique.
 * A janela é `PORTAL_VIEW_REPEAT_MINUTES`.
 */
export interface IPortalViewMarks {
  /**
   * Reserva a abertura de `at`: `true` quando ela deve ser registrada — não havia marca, ou a anterior já
   * saiu da janela. A decisão e a gravação são uma coisa só (transação): duas aberturas simultâneas
   * reservam uma vez.
   */
  claim(markId: string, tenantId: string, at: Date): Promise<boolean>;
  /** Desfaz a reserva de `at` que não chegou a ser registrada — só se a marca ainda for a dela. */
  release(markId: string, at: Date): Promise<void>;
}
