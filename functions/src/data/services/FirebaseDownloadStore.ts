import { DOWNLOADS_COLLECTION } from '../../domain/schema/document/documentDownloads';
import type { DownloadVisibility } from '../../domain/schema/document/documentDownloads';
import type { IDownloadStore, StoredDownload } from '../../domain/repositories/IDownloadStore';
import { getBucket, getDb } from '../../infrastructure/firebase/initFirebase';

const VISIBILITIES = new Set<DownloadVisibility>(['owner', 'everyone', 'managers']);

const textOf = (value: unknown): string => (typeof value === 'string' ? value : '');

export class FirebaseDownloadStore implements IDownloadStore {
  async get(tenantId: string, downloadId: string): Promise<StoredDownload | null> {
    const snapshot = await getDb().doc(`tenants/${tenantId}/${DOWNLOADS_COLLECTION}/${downloadId}`).get();
    const data = snapshot.data();
    if (!snapshot.exists || !data) return null;
    return {
      id: snapshot.id,
      name: textOf(data.name),
      storagePath: textOf(data.storagePath),
      contentType: textOf(data.contentType),
      ownerId: typeof data.ownerId === 'string' ? data.ownerId : null,
      visibility: VISIBILITIES.has(data.visibility) ? data.visibility : 'owner',
    };
  }

  async readFile(storagePath: string): Promise<Buffer> {
    const [contents] = await getBucket().file(storagePath).download();
    return contents;
  }

  async delete(tenantId: string, downloadId: string): Promise<void> {
    await getDb().doc(`tenants/${tenantId}/${DOWNLOADS_COLLECTION}/${downloadId}`).delete();
  }
}
