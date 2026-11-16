import type { IRecordDocumentStore, StoredRecordDocument } from '../../domain/repositories/IRecordDocumentStore';
import { getBucket, getDb } from '../../infrastructure/firebase/initFirebase';

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

export class FirebaseRecordDocumentStore implements IRecordDocumentStore {
  async find(tenantId: string, physicalCollection: string, recordId: string, documentId: string): Promise<StoredRecordDocument | null> {
    const snapshot = await getDb()
      .collection(`tenants/${tenantId}/${physicalCollection}/${recordId}/documents`)
      .doc(documentId)
      .get();
    if (!snapshot.exists) return null;
    const data = snapshot.data() ?? {};
    const storagePath = text(data.storagePath);
    if (!storagePath) return null;
    return {
      id: snapshot.id,
      name: text(data.name),
      contentType: text(data.contentType),
      storagePath,
      ...(typeof data.size === 'number' ? { size: data.size } : {}),
    };
  }

  async read(storagePath: string): Promise<Buffer | null> {
    const file = getBucket().file(storagePath);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [content] = await file.download();
    return content;
  }
}
