import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getDownloadURL } from 'firebase-admin/storage';
import { DOWNLOADS_COLLECTION, downloadStoragePath } from '../../domain/schema/document/documentDownloads';
import type { DownloadFileInput, IDownloadWriter, SavedDownload } from '../../domain/repositories/IDownloadWriter';
import { getBucket, getDb } from '../../infrastructure/firebase/initFirebase';

/**
 * O id do item nasce ANTES do arquivo, porque é a pasta dele no bucket: o gatilho de exclusão só
 * apaga o que estiver sob `downloads/{id}/`, e um caminho gravado errado no documento não leva
 * consigo arquivo de outro lugar.
 */
export class FirebaseDownloadWriter implements IDownloadWriter {
  async save(input: DownloadFileInput): Promise<SavedDownload> {
    const ref = getDb().collection(`tenants/${input.tenantId}/${DOWNLOADS_COLLECTION}`).doc();
    const storagePath = downloadStoragePath(input.tenantId, ref.id, input.name);
    const file = getBucket().file(storagePath);

    let url: string;
    try {
      await file.save(input.data, {
        resumable: false,
        contentType: input.contentType,
        metadata: { metadata: { firebaseStorageDownloadTokens: crypto.randomUUID() } },
      });
      url = await getDownloadURL(file);
    } catch (error) {
      await file.delete({ ignoreNotFound: true }).catch(() => undefined);
      throw error;
    }

    try {
      await ref.set({
        name: input.name,
        url,
        storagePath,
        contentType: input.contentType,
        size: input.data.length,
        ownerId: input.ownerId,
        visibility: input.visibility,
        ...(input.templateKey ? { templateKey: input.templateKey } : {}),
        ...(input.origin ? { origin: input.origin } : {}),
        createdBy: input.author.uid,
        ...(input.author.name ? { createdByName: input.author.name } : {}),
        createdVia: input.author.via,
        createdAt: FieldValue.serverTimestamp(),
        expiresAt: input.expiresAt ? Timestamp.fromDate(input.expiresAt) : null,
      });
    } catch (error) {
      await file.delete({ ignoreNotFound: true }).catch(() => undefined);
      throw error;
    }

    return {
      id: ref.id,
      name: input.name,
      url,
      storagePath,
      contentType: input.contentType,
      size: input.data.length,
      expiresAt: input.expiresAt,
    };
  }
}
