import { getBucket } from '../../infrastructure/firebase/initFirebase';
import type { IMailRawStore } from '../../domain/repositories/IMailRawStore';
import { mailRawStoragePath } from '../../domain/schema/mailbox';

export class StorageMailRawStore implements IMailRawStore {
  async save(tenantId: string, key: string, raw: Buffer): Promise<string> {
    const path = mailRawStoragePath(tenantId, key);
    // `resumable: false`: a mensagem cabe numa chamada só, e a sessão resumível é uma ida a mais por arquivo.
    await getBucket().file(path).save(raw, { contentType: 'message/rfc822', resumable: false });
    return path;
  }

  async read(path: string): Promise<Buffer | null> {
    const file = getBucket().file(path);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [data] = await file.download();
    return data;
  }
}
