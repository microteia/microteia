import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../../infrastructure/firebase/config';
import type { IRecordFileRepository } from '../../domain/repositories/IRecordRepository';

/**
 * Uma chave pontilhada (`address.photo`) tem de virar UM segmento de caminho: gravada como veio, o
 * Storage a leria como pasta dentro de pasta e a URL deixaria de casar com o campo.
 */
const pathSegment = (fieldKey: string): string => fieldKey.replace(/\./g, '_');

export class FirebaseRecordFileRepository implements IRecordFileRepository {
  async upload(
    tenantId: string,
    collection: string,
    recordId: string,
    fieldKey: string,
    file: File,
  ): Promise<string> {
    const safeName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const storagePath = `tenants/${tenantId}/${collection}/${recordId}/fields/${pathSegment(fieldKey)}/${safeName}`;
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file, { contentType: file.type });
    return getDownloadURL(storageRef);
  }
}
