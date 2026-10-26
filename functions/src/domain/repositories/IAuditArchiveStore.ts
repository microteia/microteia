import type { AuditArchiveProtection } from '../schema/auditRetention';

/**
 * - `created`: o arquivo não existia e foi gravado.
 * - `identical`: já existia com o MESMO conteúdo — a reexecução de um dia já exportado.
 * - `conflict`: já existia com OUTRO conteúdo. Nada é sobrescrito.
 */
export type AuditArchivePutResult = 'created' | 'identical' | 'conflict';

/**
 * O bucket do arquivo, declarado pela instalação. Gravar nunca sobrescreve: num bucket com retenção
 * bloqueada a sobrescrita seria recusada de qualquer jeito, e num sem bloqueio ela apagaria a prova.
 */
export interface IAuditArchiveStore {
  isConfigured(): boolean;
  protection(): Promise<AuditArchiveProtection>;
  /** `retainUntil` trava o objeto até a data quando o bucket aceita retenção por objeto. */
  put(path: string, content: string, retainUntil: Date | null): Promise<AuditArchivePutResult>;
  read(path: string): Promise<string | null>;
  list(prefix: string): Promise<string[]>;
}
