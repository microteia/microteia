import { getDI } from '../../di/container';
import {
  buildEmailFailureAuditText,
  buildEmailFailureAuditTitle,
  buildTokenRefreshFailureAuditText,
  buildTokenRefreshFailureAuditTitle,
  type GmailPushEmailFailureInput,
  type GmailPushTokenRefreshFailureInput,
} from '../../../domain/services/gmailPushAuditText';

type LogLevel = 'info' | 'warn' | 'error';

/**
 * Ponto único de logging do fluxo do gmailPush. `log(...)` só grava no console — rodadas
 * 100% bem-sucedidas não geram nenhum auditLog, para não poluir a Auditoria (o Gmail dispara
 * uma notificação por e-mail, então cada invocação já processa tipicamente 1 e-mail).
 * Só falhas de parser/IA em um e-mail geram um auditLog (`recordEmailFailure`), um por falha.
 */
export class GmailPushRunLogger {
  private emailsFound = 0;
  private trustedEmailsFound = 0;
  private emailsSucceeded = 0;
  private emailsFailed = 0;

  constructor(
    private readonly tenantId: string,
    private readonly tenantName: string,
  ) {}

  log(level: LogLevel, message: string): void {
    console[level](message);
  }

  setEmailsFound(total: number, trustedCount: number): void {
    this.emailsFound = total;
    this.trustedEmailsFound = trustedCount;
  }

  recordEmailProcessed(): void {
    this.emailsSucceeded += 1;
  }

  async recordEmailFailure(input: Omit<GmailPushEmailFailureInput, 'tenantName'>): Promise<void> {
    this.emailsFailed += 1;
    this.log('error', `Falha crítica (${input.reason === 'ia' ? 'IA' : 'Parser'}) ao processar e-mail ${input.emailId}: ${input.errorMessage}`);

    try {
      await getDI().getCreateAuditLogUseCase().execute({
        tenantId: this.tenantId,
        title: buildEmailFailureAuditTitle(input.reason),
        userId: 'system',
        userName: 'Sistema',
        photoURL: '',
        action: 'SYSTEM',
        severity: 'CRITICAL',
        type: 'ERROR',
        entity: 'SYSTEM',
        entityId: input.emailId,
        text: buildEmailFailureAuditText({ ...input, tenantName: this.tenantName }),
      });
    } catch (loggingError) {
      console.error('[gmailPush] Falha ao registrar auditLog crítico de e-mail:', loggingError);
    }
  }

  async recordTokenRefreshFailure(input: Omit<GmailPushTokenRefreshFailureInput, 'tenantName'>): Promise<void> {
    this.log('error', `Falha crítica ao renovar token para conexão ${input.connectionId}: ${input.errorMessage}`);

    try {
      await getDI().getCreateAuditLogUseCase().execute({
        tenantId: this.tenantId,
        title: buildTokenRefreshFailureAuditTitle(),
        userId: 'system',
        userName: 'Sistema',
        photoURL: '',
        action: 'SYSTEM',
        severity: 'CRITICAL',
        type: 'ERROR',
        entity: 'SYSTEM',
        entityId: input.connectionId,
        text: buildTokenRefreshFailureAuditText({ ...input, tenantName: this.tenantName }),
      });
    } catch (loggingError) {
      console.error('[gmailPush] Falha ao registrar auditLog crítico de renovação de token:', loggingError);
    }
  }

  finish(params: { newHistoryId?: string; fatalError?: string }): void {
    const hadIssues = this.emailsFailed > 0 || !!params.fatalError;
    const statusLabel = hadIssues ? 'com falhas' : 'com sucesso';

    console.log(
      `[gmailPush] Sincronização concluída ${statusLabel} — tenant: ${this.tenantName}, ` +
      `encontrados: ${this.emailsFound}, de remetentes permitidos: ${this.trustedEmailsFound}, ` +
      `processados com sucesso: ${this.emailsSucceeded}, falhas críticas: ${this.emailsFailed}` +
      (params.newHistoryId ? `, historyId atualizado: ${params.newHistoryId}` : ', historyId não atualizado') +
      (params.fatalError ? `, erro fatal: ${params.fatalError}` : '')
    );
  }
}
