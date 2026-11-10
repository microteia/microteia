import { addDoc, collection, deleteDoc, doc, getDocs, setDoc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { IHttpConnectionRepository } from '../../domain/repositories/IHttpConnectionRepository';
import {
  asHttpConnection,
  HTTP_CONNECTION_SECRET_DOC,
  HTTP_CONNECTIONS_COLLECTION,
  type HttpConnection,
  type HttpConnectionData,
} from '../../domain/schema/httpConnection';

const connections = (tenantId: string) => collection(db, 'tenants', tenantId, HTTP_CONNECTIONS_COLLECTION);
const connectionDoc = (tenantId: string, id: string) => doc(db, 'tenants', tenantId, HTTP_CONNECTIONS_COLLECTION, id);
const secretDoc = (tenantId: string, id: string) =>
  doc(db, 'tenants', tenantId, HTTP_CONNECTIONS_COLLECTION, id, 'secrets', HTTP_CONNECTION_SECRET_DOC);

/** Os campos que não valem para o esquema escolhido saem do documento, em vez de ficarem órfãos. */
const asDocument = (data: HttpConnectionData): Record<string, unknown> => ({
  key: data.key,
  name: data.name,
  scheme: data.scheme,
  hosts: data.hosts,
  username: data.username ?? deleteField(),
  paramName: data.paramName ?? deleteField(),
});

export class FirebaseHttpConnectionRepository implements IHttpConnectionRepository {
  async list(tenantId: string): Promise<HttpConnection[]> {
    const snap = await getDocs(connections(tenantId));
    return snap.docs
      .map((one) => asHttpConnection(one.id, one.data()))
      .filter((one): one is HttpConnection => one !== null)
      .sort((a, b) => a.key.localeCompare(b.key));
  }

  async create(tenantId: string, data: HttpConnectionData, secret: string): Promise<HttpConnection> {
    const { username, paramName, ...rest } = data;
    const created = await addDoc(connections(tenantId), {
      ...rest,
      ...(username ? { username } : {}),
      ...(paramName ? { paramName } : {}),
      hasSecret: true,
    });
    await setDoc(secretDoc(tenantId, created.id), { value: secret });
    return { ...data, id: created.id, hasSecret: true };
  }

  async update(tenantId: string, id: string, data: HttpConnectionData, secret?: string): Promise<void> {
    if (secret) await setDoc(secretDoc(tenantId, id), { value: secret });
    await updateDoc(connectionDoc(tenantId, id), { ...asDocument(data), ...(secret ? { hasSecret: true } : {}) });
  }

  async remove(tenantId: string, id: string): Promise<void> {
    await deleteDoc(secretDoc(tenantId, id));
    await deleteDoc(connectionDoc(tenantId, id));
  }
}
