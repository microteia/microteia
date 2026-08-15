import { getDI } from '../../di/container';
import { buildErrorText } from '../../../domain/services/auditDiff';

/**
 * Log de auditoria best-effort para falhas no próprio pipeline de auditoria.
 * Nunca lança — uma falha aqui não pode derrubar a trigger que a chamou.
 */
export const logAuditError = async (
  tenantId: string,
  collection: string,
  docId: string,
  error: unknown,
): Promise<void> => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[audit] Falha ao processar ${collection}/${docId}:`, error);

  try {
    const auditText = buildErrorText(collection, docId, message);
    await getDI().getCreateAuditLogUseCase().execute({
      tenantId: tenantId || 'SYSTEM',
      title: 'Erro no processamento de auditoria',
      userId: 'system',
      userName: 'Sistema',
      photoURL: '',
      action: 'SYSTEM',
      severity: 'CRITICAL',
      type: 'ERROR',
      entity: 'SYSTEM',
      entityId: docId || collection,
      text: auditText.message,
      textParams: auditText.messageParams,
    });
  } catch (loggingError) {
    console.error('[audit] Falha ao registrar log de erro de auditoria:', loggingError);
  }
};
