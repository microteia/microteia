import {
  collection,
  doc,
  addDoc,
  getDocs,
  deleteDoc,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { GmailConnection, GmailToken } from '../../domain/entities';
import type { IGmailConnectionRepository } from '../../domain/repositories/IGmailConnectionRepository';

const gmailCol = (tenantId: string) => collection(db, 'tenants', tenantId, 'gmailConnections');
const gmailDoc = (tenantId: string, id: string) => doc(db, 'tenants', tenantId, 'gmailConnections', id);
const tokenDoc = (tenantId: string, connectionId: string) => 
  doc(db, 'tenants', tenantId, 'gmailConnections', connectionId, 'tokens', 'current');

const fromDoc = (id: string, tenantId: string, data: Record<string, unknown>): GmailConnection => ({
  id,
  tenantId,
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
    const snap = await getDocs(gmailCol(tenantId));
    return snap.docs
      .map((d) => fromDoc(d.id, tenantId, d.data()))
      .sort((a, b) => b.authorizedAt.getTime() - a.authorizedAt.getTime());
  }

  async createConnection(
    tenantId: string,
    data: Omit<GmailConnection, 'id' | 'tenantId' | 'authorizedAt'>,
    tokenData: Omit<GmailToken, 'id' | 'connectionId' | 'tenantId'>,
  ): Promise<GmailConnection> {
    const authorizedAt = new Date();
    const connectionDocRef = await addDoc(gmailCol(tenantId), {
      tenantId,
      ...data,
      authorizedAt,
    });

    await setDoc(tokenDoc(tenantId, connectionDocRef.id), {
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
    await deleteDoc(tokenDoc(tenantId, connectionId));
    await deleteDoc(gmailDoc(tenantId, connectionId));
  }

  async updateToken(
    tenantId: string,
    connectionId: string,
    tokenData: Omit<GmailToken, 'id' | 'connectionId' | 'tenantId'>,
  ): Promise<void> {
    await setDoc(tokenDoc(tenantId, connectionId), {
      connectionId,
      tenantId,
      ...tokenData,
    });
  }

  async updateConnectionAuthorizedAt(tenantId: string, connectionId: string): Promise<void> {
    const docRef = gmailDoc(tenantId, connectionId);
    await setDoc(docRef, { authorizedAt: new Date() }, { merge: true });
  }

  async updateConnectionWatchData(
    tenantId: string,
    connectionId: string,
    historyId: string,
    expiration: string,
  ): Promise<void> {
    const docRef = gmailDoc(tenantId, connectionId);
    await setDoc(docRef, { historyId, expiration }, { merge: true });
  }
}
