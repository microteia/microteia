import { randomUUID } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getDownloadURL } from 'firebase-admin/storage';
import type {
  IRecordDocumentLinks,
  RecordDocumentRef,
  SignedDocumentLinkRequest,
} from '../../domain/repositories/IRecordDocumentLinks';
import {
  RECORD_DOCUMENT_LINK_SEAL_FIELD,
  downloadTokenOf,
  hasRecordDocumentLinkSeal,
  isRecordDocumentLinkSealed,
  needsRecordDocumentLinkRotation,
  pendingRecordDocumentLinkToken,
} from '../../domain/services/recordDocumentLinks';
import { recordDocumentStoragePath } from '../../domain/services/recordDocumentHash';
import { getBucket, getDb } from '../../infrastructure/firebase/initFirebase';

const documentsOf = (tenantId: string, collection: string, recordId: string) =>
  getDb().collection(`tenants/${tenantId}/${collection}/${recordId}/documents`);

const locationOf = (ref: RecordDocumentRef) => ({ tenantId: ref.tenantId, parent: ref.collection, parentId: ref.recordId });

/** `inline` com o nome do documento: o navegador abre o PDF, e salva com o nome que a aba mostra. */
const inlineDisposition = (fileName: string): string =>
  `inline; filename*=UTF-8''${encodeURIComponent(fileName.trim() || 'document')}`;

/**
 * A troca do token é feita em três passos, e o token é escolhido no PRIMEIRO, numa transação: quem
 * chega no meio de uma troca a termina com o mesmo token. Assim uma rodada de reprojeção e um gatilho de
 * documento que trocam juntos não deixam o arquivo com um token e a `url` com outro.
 */
export class FirebaseRecordDocumentLinks implements IRecordDocumentLinks {
  async sign({ storagePath, fileName, expiresAt }: SignedDocumentLinkRequest): Promise<string> {
    try {
      const [url] = await getBucket().file(storagePath).getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: expiresAt,
        responseDisposition: inlineDisposition(fileName),
      });
      return url;
    } catch (error) {
      console.error(
        '[documents] Falha ao assinar o link do documento. A conta das functions precisa de '
          + '"iam.serviceAccounts.signBlob" — rode `microteia grant-signing`.',
        error,
      );
      throw error;
    }
  }

  async rotate(ref: RecordDocumentRef): Promise<boolean> {
    const document = documentsOf(ref.tenantId, ref.collection, ref.recordId).doc(ref.documentId);
    const chosen = await getDb().runTransaction(async (transaction) => {
      const snapshot = await transaction.get(document);
      if (!snapshot.exists) return null;
      const data = snapshot.data() ?? {};
      if (data.deletedBy || isRecordDocumentLinkSealed(data)) return null;
      const storagePath = recordDocumentStoragePath(locationOf(ref), data);
      if (!storagePath) return null;
      const pending = pendingRecordDocumentLinkToken(data);
      const token = pending ?? randomUUID();
      if (!pending) transaction.update(document, { [RECORD_DOCUMENT_LINK_SEAL_FIELD]: token });
      return { token, storagePath };
    });
    if (!chosen) return false;

    const file = getBucket().file(chosen.storagePath);
    await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: chosen.token } });
    const url = await getDownloadURL(file);
    if (downloadTokenOf(url) !== chosen.token) throw new Error(`Token do arquivo ${chosen.storagePath} não foi trocado.`);
    await document.update({ url });
    return true;
  }

  async seal(ref: RecordDocumentRef): Promise<void> {
    const document = documentsOf(ref.tenantId, ref.collection, ref.recordId).doc(ref.documentId);
    await getDb().runTransaction(async (transaction) => {
      const snapshot = await transaction.get(document);
      const data = snapshot.data();
      if (!snapshot.exists || !data || hasRecordDocumentLinkSeal(data)) return;
      const token = downloadTokenOf(data.url);
      if (token) transaction.update(document, { [RECORD_DOCUMENT_LINK_SEAL_FIELD]: token });
    });
  }

  async unseal(ref: RecordDocumentRef): Promise<void> {
    await documentsOf(ref.tenantId, ref.collection, ref.recordId)
      .doc(ref.documentId)
      .update({ [RECORD_DOCUMENT_LINK_SEAL_FIELD]: FieldValue.delete() });
  }

  async pendingRotation(tenantId: string, collection: string, recordId: string): Promise<string[]> {
    const snapshot = await documentsOf(tenantId, collection, recordId).get();
    const location = { tenantId, parent: collection, parentId: recordId };
    return snapshot.docs
      .filter((doc) => needsRecordDocumentLinkRotation(doc.data()) && recordDocumentStoragePath(location, doc.data()) !== null)
      .map((doc) => doc.id);
  }
}
