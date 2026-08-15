export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'SYSTEM';
export type AuditSeverity = 'LOW' | 'HIGH' | 'CRITICAL';
export type AuditType = 'AUDIT' | 'ERROR';

export interface AuditLog {
  id: string;
  tenantId: string;
  title: string;
  titleParams?: Record<string, string>;
  userId: string;
  userName: string;
  photoURL: string;
  action: AuditAction;
  severity: AuditSeverity;
  type: AuditType;
  entity: string;
  entityId: string;
  entityLink?: string;
  /**
   * A COLEÇÃO e o REGISTRO que o botão "Ir para o registro" abre. Para um filho (nota, documento),
   * é o pai — é ele que tem tela.
   *
   * Existem porque `entityLink` é uma chave de ABA, e a Cloud Function não tem como saber qual é:
   * ela depende das telas instaladas NAQUELE escritório, e muda quando uma entidade sai do kernel
   * (`view-person:` virou `view-dyn:pessoas:`). Guardando a coleção, quem resolve é a UI, no clique
   * — e o link nunca envelhece. `entityLink` fica como está para os registros gravados antes disto.
   */
  linkCollection?: string;
  linkRecordId?: string;
  /**
   * REFERÊNCIA de mensagem nos logs novos; `textParams` traz o que a frase interpola. Log ANTIGO
   * guarda a frase pronta e continua legível — `resolveLabel` devolve intacto o que não é
   * referência, então o histórico de auditoria não precisou ser reescrito.
   */
  text: string;
  textParams?: Record<string, string>;
  createdAt: Date;
  expiresAt: Date;
}
