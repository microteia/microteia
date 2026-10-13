import { FieldValue } from 'firebase-admin/firestore';
import { getDownloadURL } from 'firebase-admin/storage';
import { agentDocumentStoragePath } from '../../domain/schema/agent/agentDocument';
import type {
  AttachedRecordDocument,
  IRecordDocumentWriter,
  RecordDocumentFile,
} from '../../domain/repositories/IRecordDocumentWriter';
import { getBucket, getDb } from '../../infrastructure/firebase/initFirebase';

/**
 * Bucket primeiro, documento depois, e o arquivo é apagado se o documento falhar: na ordem inversa a
 * aba mostraria um link para um arquivo que não existe.
 */
export class FirebaseRecordDocumentWriter implements IRecordDocumentWriter {
  async attach(input: RecordDocumentFile): Promise<AttachedRecordDocument> {
    const storagePath = agentDocumentStoragePath(
      input.tenantId,
      input.physicalCollection,
      input.recordId,
      input.name,
      Date.now(),
    );
    const file = getBucket().file(storagePath);

    let url: string;
    try {
      await file.save(input.data, {
        resumable: false,
        contentType: input.contentType,
        // O token é o que `getDownloadURL` do navegador cria sozinho. Sem ele o link não abre fora do
        // console — e o link é o que a aba mostra.
        metadata: { metadata: { firebaseStorageDownloadTokens: crypto.randomUUID() } },
      });
      url = await getDownloadURL(file);
    } catch (error) {
      await file.delete({ ignoreNotFound: true }).catch(() => undefined);
      throw error;
    }

    const type = input.type?.trim() || undefined;
    const description = input.description?.trim() || undefined;
    try {
      const created = await getDb()
        .collection(`tenants/${input.tenantId}/${input.physicalCollection}/${input.recordId}/documents`)
        .add({
          name: input.name,
          ...(type ? { type } : {}),
          ...(description ? { description } : {}),
          url,
          storagePath,
          contentType: input.contentType,
          size: input.data.length,
          createdBy: input.author.uid,
          ...(input.author.name ? { createdByName: input.author.name } : {}),
          ...(input.author.photoUrl ? { createdByPhotoUrl: input.author.photoUrl } : {}),
          createdVia: input.author.via,
          createdAt: FieldValue.serverTimestamp(),
        });
      return {
        id: created.id,
        name: input.name,
        url,
        storagePath,
        contentType: input.contentType,
        size: input.data.length,
        ...(type ? { type } : {}),
        ...(description ? { description } : {}),
      };
    } catch (error) {
      await file.delete({ ignoreNotFound: true }).catch(() => undefined);
      throw error;
    }
  }
}
