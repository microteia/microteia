import { onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { getBucket } from '../firebase/initFirebase';
import { DOWNLOADS_COLLECTION, isDownloadStoragePath } from '../../domain/schema/document/documentDownloads';

/**
 * O arquivo de um item de Downloads sai do bucket quando o documento sai do Firestore.
 *
 * O TTL do Firestore apaga o DOCUMENTO vencido, mas não sabe que existe um arquivo. Sem este gatilho,
 * todo item vencido deixaria o arquivo para trás — pago e alcançável pelo link, para sempre. A
 * exclusão pela tela passa pelo mesmo caminho: o cliente apaga o documento e nunca toca o bucket.
 *
 * Só apaga o que estiver sob a pasta do PRÓPRIO item (`downloads/{id}/`). O caminho vem do documento,
 * e um documento com o caminho errado não pode levar consigo o arquivo de outro lugar.
 */
export const onDownloadDeleted = onDocumentDeleted(
  { document: `tenants/{tenantId}/${DOWNLOADS_COLLECTION}/{downloadId}`, region: 'southamerica-east1' },
  async (event) => {
    const { tenantId, downloadId } = event.params;
    const storagePath = event.data?.data()?.storagePath;
    if (!isDownloadStoragePath(tenantId, downloadId, storagePath)) return;
    try {
      await getBucket().file(storagePath).delete({ ignoreNotFound: true });
    } catch (error) {
      console.error(`Falha ao apagar o arquivo do download ${downloadId} do escritório ${tenantId}:`, error);
    }
  },
);
