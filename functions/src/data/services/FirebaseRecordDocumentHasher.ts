import { createHash } from 'node:crypto';
import type { IRecordDocumentHasher, RecordDocumentHashTarget } from '../../domain/repositories/IRecordDocumentHasher';
import { RECORD_DOCUMENT_HASH_FIELD } from '../../domain/services/recordDocumentHash';
import { getBucket, getDb } from '../../infrastructure/firebase/initFirebase';

/**
 * O arquivo é lido em blocos, e o hash nunca é reescrito: a transação só grava quando o campo falta, e
 * `update` falha sobre o documento que já foi excluído em vez de recriá-lo.
 */
export class FirebaseRecordDocumentHasher implements IRecordDocumentHasher {
  async stamp(target: RecordDocumentHashTarget): Promise<string | null> {
    const file = getBucket().file(target.storagePath);
    const [exists] = await file.exists();
    if (!exists) return null;

    const hash = createHash('sha256');
    for await (const chunk of file.createReadStream()) hash.update(chunk as Buffer);
    const sha256 = hash.digest('hex');

    const ref = getDb()
      .collection(`tenants/${target.tenantId}/${target.parent}/${target.parentId}/documents`)
      .doc(target.documentId);
    return getDb().runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) return null;
      const stored = snapshot.get(RECORD_DOCUMENT_HASH_FIELD);
      if (typeof stored === 'string') return stored;
      transaction.update(ref, { [RECORD_DOCUMENT_HASH_FIELD]: sha256 });
      return sha256;
    });
  }
}
