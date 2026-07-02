import { randomUUID } from 'crypto';
import { onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { getBucket } from '../firebase/initFirebase';

/**
 * Cold storage: sempre que um AuditLog é apagado (seja manualmente, seja pelo TTL de 90 dias
 * configurado no Firestore Console em `auditLogs.expiresAt`), salva uma cópia em JSON no
 * Storage antes de ser perdido definitivamente. Um arquivo por log, pasta por entidade.
 */
export const backupDeletedAuditLog = onDocumentDeleted(
  { document: 'auditLogs/{logId}', region: 'us-central1' },
  async (event) => {
    const { logId } = event.params;
    try {
      const data = event.data?.data() as Record<string, unknown> | undefined;
      if (!data) return;

      const tenantId = (data.tenantId as string | undefined) || 'SYSTEM';
      const entity = ((data.entity as string | undefined) || 'unknown').toLowerCase();

      const path = tenantId === 'SYSTEM'
        ? `systemLogs/${entity}/${logId}.json`
        : `tenants/${tenantId}/logs/${entity}/${logId}.json`;

      const serializable = {
        id: logId,
        ...data,
        createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.().toISOString() ?? null,
        expiresAt: (data.expiresAt as { toDate?: () => Date })?.toDate?.().toISOString() ?? null,
      };

      // firebaseStorageDownloadTokens é preenchido automaticamente pelo SDK client-side
      // (uploadBytes) mas não pelo Admin SDK — sem ele, o botão "Download" do Firebase
      // Console (e getDownloadURL() no app) não tem como montar a URL do arquivo.
      await getBucket().file(path).save(JSON.stringify(serializable, null, 2), {
        metadata: {
          contentType: 'application/json',
          metadata: {
            firebaseStorageDownloadTokens: randomUUID(),
          },
        },
      });
    } catch (error) {
      console.error(`[audit] Falha ao fazer backup do log ${logId} no Storage:`, error);
    }
  },
);
