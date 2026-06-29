import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { AIConnection, AIProvider } from '../../domain/entities';
import type { IAIConnectionRepository } from '../../domain/repositories/IAIConnectionRepository';

const tenantCol = (tenantId: string) => collection(db, 'tenants', tenantId, 'aiConnections');
const tenantDoc = (tenantId: string, id: string) => doc(db, 'tenants', tenantId, 'aiConnections', id);

const fromDoc = (id: string, tenantId: string, data: Record<string, unknown>): AIConnection => ({
  id,
  tenantId,
  name: data.name as string,
  provider: data.provider as AIProvider,
  apiKey: data.apiKey as string,
  model: data.model as string,
  temperature: (data.temperature as number) ?? 0.7,
  maxTokens: (data.maxTokens as number) ?? 2048,
  isDefault: (data.isDefault as boolean) ?? false,
  createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
});

export class FirebaseAIConnectionRepository implements IAIConnectionRepository {
  async getConnections(tenantId: string): Promise<AIConnection[]> {
    const snap = await getDocs(tenantCol(tenantId));
    return snap.docs
      .map((d) => fromDoc(d.id, tenantId, d.data()))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async createConnection(
    tenantId: string,
    data: Omit<AIConnection, 'id' | 'tenantId' | 'createdAt'>,
  ): Promise<AIConnection> {
    const createdAt = new Date();
    const docRef = await addDoc(tenantCol(tenantId), { tenantId, ...data, createdAt });
    return { id: docRef.id, tenantId, ...data, createdAt };
  }

  async updateConnection(
    tenantId: string,
    id: string,
    data: Partial<Omit<AIConnection, 'id' | 'tenantId' | 'createdAt'>>,
  ): Promise<void> {
    await updateDoc(tenantDoc(tenantId, id), data as Record<string, unknown>);
  }

  async deleteConnection(tenantId: string, id: string): Promise<void> {
    await deleteDoc(tenantDoc(tenantId, id));
  }

  async setDefault(tenantId: string, newDefaultId: string): Promise<void> {
    const connections = await this.getConnections(tenantId);
    const batch = writeBatch(db);
    for (const conn of connections) {
      const shouldBeDefault = conn.id === newDefaultId;
      if (conn.isDefault !== shouldBeDefault) {
        batch.update(tenantDoc(tenantId, conn.id), { isDefault: shouldBeDefault });
      }
    }
    await batch.commit();
  }
}
