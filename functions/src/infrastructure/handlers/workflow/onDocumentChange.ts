import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getDI } from '../../di/container';
import { RECORD_DOCUMENT_HASH_FIELD, recordDocumentFileToHash } from '../../../domain/services/recordDocumentHash';
import { publishChildRecordEvent } from './publishChildRecordEvent';

/**
 * Carimba o SHA-256 do arquivo anexado pelo navegador e publica `<prefixo do pai>_document.saved` e
 * `<prefixo do pai>_document.deleted` — ver `publishChildRecordEvent`.
 *
 * O hash vem ANTES do evento, e vai nele: a automação que reage ao anexo já recebe `sha256`. A gravação
 * do carimbo dispara este gatilho de novo, e não publica nada — só mudou o que o servidor carimba.
 */
export const onDocumentChange = onDocumentWritten(
  {
    document: 'tenants/{tenantId}/{parent}/{parentId}/documents/{childId}',
    region: 'southamerica-east1',
    timeoutSeconds: 120,
  },
  async (event) => {
    const { tenantId, parent, parentId, childId } = event.params;
    const after = event.data?.after;
    const storagePath = recordDocumentFileToHash(
      { tenantId, parent, parentId },
      after?.exists ? (after.data() as Record<string, unknown>) : null,
    );
    let stamped: Record<string, unknown> | undefined;
    if (storagePath) {
      try {
        const sha256 = await getDI().getRecordDocumentHasher()
          .stamp({ tenantId, parent, parentId, documentId: childId, storagePath });
        if (sha256) stamped = { [RECORD_DOCUMENT_HASH_FIELD]: sha256 };
      } catch (error) {
        console.error(`[documents] Falha ao calcular o hash de ${tenantId}/${parent}/${parentId}/${childId}:`, error);
      }
    }
    await publishChildRecordEvent('document', event, stamped);
  },
);
