import type { AuditArchiveState, AuditRetentionPolicy } from '../schema/auditRetention';

export interface StoredAuditRetention {
  tenantId: string;
  policy: AuditRetentionPolicy;
  state: AuditArchiveState;
}

export interface AuditRetentionAuthor {
  userId: string;
  userName: string;
}

/**
 * `auditRetention/{tenantId}` — a política do escritório e o andamento do arquivo dele. Coleção na
 * RAIZ, como `auditLogs`: nenhuma regra de coleção de tela a alcança, e só o servidor grava.
 *
 * `get` nunca devolve "nada": o escritório sem documento tem a política padrão, que é a de antes.
 */
export interface IAuditRetentionRepository {
  get(tenantId: string): Promise<StoredAuditRetention>;
  /** Os escritórios com o arquivo ligado — os únicos que o exportador visita. */
  listArchiving(): Promise<StoredAuditRetention[]>;
  savePolicy(tenantId: string, policy: AuditRetentionPolicy, state: AuditArchiveState, author: AuditRetentionAuthor): Promise<void>;
  saveState(tenantId: string, state: AuditArchiveState): Promise<void>;
}
