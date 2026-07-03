import { httpsCallable } from 'firebase/functions';
import { functions } from '../../infrastructure/firebase/config';
import type { IAuditLogService, LogClientErrorInput } from '../../domain/repositories/IAuditLogService';

interface LogClientErrorPayload {
  tenantId: string;
  title: string;
  entity: string;
  entityId?: string;
  entityLink?: string;
  message: string;
  stack?: string;
}

const fn = httpsCallable<LogClientErrorPayload, { success: boolean }>(functions, 'logClientError');

export class FirebaseAuditLogService implements IAuditLogService {
  async logError(input: LogClientErrorInput): Promise<void> {
    const message = input.error instanceof Error ? input.error.message : String(input.error);
    const stack = input.error instanceof Error ? input.error.stack : undefined;

    try {
      await fn({
        tenantId: input.tenantId,
        title: input.title,
        entity: input.entity,
        entityId: input.entityId,
        entityLink: input.entityLink,
        message,
        stack,
      });
    } catch (err) {
      console.error('[AuditLogService] Falha ao registrar log de erro:', err);
    }
  }
}
