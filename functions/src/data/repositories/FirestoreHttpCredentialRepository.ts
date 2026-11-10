import type { Firestore } from 'firebase-admin/firestore';
import type { IHttpCredentialRepository } from '../../domain/repositories/IHttpCredentialRepository';
import {
  asHttpConnection,
  HTTP_CONNECTION_SECRET_DOC,
  HTTP_CONNECTIONS_COLLECTION,
  type HttpConnection,
} from '../../domain/schema/httpConnection';

/**
 * Sem cache, de propósito: trocar ou apagar o segredo tem de valer na chamada seguinte. São duas
 * leituras por chamada — a igualdade em `key` é servida pelo índice de campo único.
 */
export class FirestoreHttpCredentialRepository implements IHttpCredentialRepository {
  constructor(private readonly db: Firestore) {}

  async findByKey(tenantId: string, key: string): Promise<{ connection: HttpConnection; secret: string | null } | null> {
    const found = await this.db
      .collection('tenants').doc(tenantId)
      .collection(HTTP_CONNECTIONS_COLLECTION)
      .where('key', '==', key)
      .limit(1)
      .get();
    const doc = found.docs[0];
    const connection = doc ? asHttpConnection(doc.id, doc.data()) : null;
    if (!doc || !connection) return null;
    const secretSnap = await doc.ref.collection('secrets').doc(HTTP_CONNECTION_SECRET_DOC).get();
    const value = secretSnap.exists ? secretSnap.get('value') : undefined;
    return { connection, secret: typeof value === 'string' && value !== '' ? value : null };
  }
}
