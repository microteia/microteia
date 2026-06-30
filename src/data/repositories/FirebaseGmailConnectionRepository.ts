import {
  collection,
  doc,
  addDoc,
  getDocs,
  deleteDoc,
  setDoc,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { GmailConnection, GmailToken } from '../../domain/entities';
import type { IGmailConnectionRepository } from '../../domain/repositories/IGmailConnectionRepository';

const gmailCol = () => collection(db, 'gmailConnections');
const gmailDoc = (id: string) => doc(db, 'gmailConnections', id);
const tokenDoc = (connectionId: string) => 
  doc(db, 'gmailConnections', connectionId, 'tokens', 'current');

const fromDoc = (id: string, data: Record<string, unknown>): GmailConnection => ({
  id,
  tenantId: data.tenantId as string,
  email: data.email as string,
  scopes: (data.scopes as string[]) ?? [],
  authorizedBy: data.authorizedBy as string,
  authorizedByName: data.authorizedByName as string,
  authorizedAt: data.authorizedAt instanceof Timestamp ? data.authorizedAt.toDate() : new Date(),
  historyId: data.historyId as string | undefined,
  expiration: data.expiration as string | undefined,
});

export class FirebaseGmailConnectionRepository implements IGmailConnectionRepository {
  async getConnections(tenantId: string): Promise<GmailConnection[]> {
    const q = query(gmailCol(), where('tenantId', '==', tenantId));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => fromDoc(d.id, d.data()))
      .sort((a, b) => b.authorizedAt.getTime() - a.authorizedAt.getTime());
  }

  async getConnectionsByEmail(email: string): Promise<GmailConnection[]> {
    const q = query(gmailCol(), where('email', '==', email));
    const snap = await getDocs(q);
    return snap.docs.map((d) => fromDoc(d.id, d.data()));
  }

  async createConnection(
    tenantId: string,
    data: Omit<GmailConnection, 'id' | 'tenantId' | 'authorizedAt'>,
    tokenData: Omit<GmailToken, 'id' | 'connectionId' | 'tenantId'>,
  ): Promise<GmailConnection> {
    const authorizedAt = new Date();
    const connectionDocRef = await addDoc(gmailCol(), {
      tenantId,
      ...data,
      authorizedAt,
    });

    await setDoc(tokenDoc(connectionDocRef.id), {
      connectionId: connectionDocRef.id,
      tenantId,
      ...tokenData,
    });

    return {
      id: connectionDocRef.id,
      tenantId,
      ...data,
      authorizedAt,
    };
  }

  async deleteConnection(tenantId: string, connectionId: string): Promise<void> {
    await deleteDoc(tokenDoc(connectionId));
    await deleteDoc(gmailDoc(connectionId));
  }

  async updateToken(
    tenantId: string,
    connectionId: string,
    tokenData: Omit<GmailToken, 'id' | 'connectionId' | 'tenantId'>,
  ): Promise<void> {
    await setDoc(tokenDoc(connectionId), {
      connectionId,
      tenantId,
      ...tokenData,
    });
  }

  async updateConnectionAuthorizedAt(tenantId: string, connectionId: string): Promise<void> {
    const docRef = gmailDoc(connectionId);
    await setDoc(docRef, { authorizedAt: new Date() }, { merge: true });
  }

  async updateConnectionWatchData(
    tenantId: string,
    connectionId: string,
    historyId: string,
    expiration: string,
  ): Promise<void> {
    const docRef = gmailDoc(connectionId);
    await setDoc(docRef, { historyId, expiration }, { merge: true });
  }
}
