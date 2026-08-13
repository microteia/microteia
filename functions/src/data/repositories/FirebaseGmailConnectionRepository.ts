import { getFirestore, type DocumentData, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import type {
  IGmailConnectionRepository,
  GmailConnectionInput,
  GmailToken,
} from '../../domain/repositories/IGmailConnectionRepository';
import type { GmailConnection } from '../../domain/entities/GmailConnection';

const toConnection = (doc: QueryDocumentSnapshot<DocumentData>): GmailConnection => {
  const data = doc.data();
  return {
    id: doc.id,
    tenantId: data.tenantId,
    email: data.email,
    scopes: data.scopes ?? [],
    authorizedBy: data.authorizedBy,
    authorizedByName: data.authorizedByName,
    authorizedAt: data.authorizedAt?.toDate() ?? new Date(),
    historyId: data.historyId,
    expiration: data.expiration,
  };
};

export class FirebaseGmailConnectionRepository implements IGmailConnectionRepository {
  private readonly db = getFirestore();

  private collection() {
    return this.db.collection('gmailConnections');
  }

  private tokenDoc(connectionId: string) {
    return this.collection().doc(connectionId).collection('tokens').doc('current');
  }

  async getAllConnections(): Promise<GmailConnection[]> {
    const snapshot = await this.collection().get();
    return snapshot.docs.map(toConnection);
  }

  async getConnectionsByEmail(email: string): Promise<GmailConnection[]> {
    const snapshot = await this.collection().where('email', '==', email).get();
    return snapshot.docs.map(toConnection);
  }

  async getConnectionsByTenant(tenantId: string): Promise<GmailConnection[]> {
    const snapshot = await this.collection().where('tenantId', '==', tenantId).get();
    return snapshot.docs
      .map(toConnection)
      .sort((a, b) => b.authorizedAt.getTime() - a.authorizedAt.getTime());
  }

  async saveConnection(input: GmailConnectionInput, token: GmailToken): Promise<GmailConnection> {
    const existing = await this.collection()
      .where('tenantId', '==', input.tenantId)
      .where('email', '==', input.email)
      .limit(1)
      .get();

    const ref = existing.empty ? this.collection().doc() : existing.docs[0].ref;
    const authorizedAt = new Date();
    const data: Record<string, unknown> = {
      tenantId: input.tenantId,
      email: input.email,
      scopes: input.scopes,
      authorizedBy: input.authorizedBy,
      authorizedByName: input.authorizedByName,
      authorizedAt,
    };
    if (input.historyId !== undefined) data.historyId = input.historyId;
    if (input.expiration !== undefined) data.expiration = input.expiration;

    await ref.set(data, { merge: true });
    await this.tokenDoc(ref.id).set({
      connectionId: ref.id,
      tenantId: input.tenantId,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresAt: token.expiresAt,
    });

    return {
      id: ref.id,
      tenantId: input.tenantId,
      email: input.email,
      scopes: input.scopes,
      authorizedBy: input.authorizedBy,
      authorizedByName: input.authorizedByName,
      authorizedAt,
      historyId: input.historyId,
      expiration: input.expiration,
    };
  }

  async deleteConnection(connectionId: string): Promise<void> {
    await this.tokenDoc(connectionId).delete();
    await this.collection().doc(connectionId).delete();
  }

  async getAccessToken(connectionId: string): Promise<GmailToken | null> {
    try {
      const tokenDoc = await this.tokenDoc(connectionId).get();

      if (!tokenDoc.exists) {
        return null;
      }

      const data = tokenDoc.data()!;
      return {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt?.toDate() ?? new Date(),
      };
    } catch (error) {
      console.error('Erro ao buscar token de acesso:', error);
      return null;
    }
  }

  async updateHistoryId(connectionId: string, historyId: string): Promise<void> {
    await this.collection().doc(connectionId).update({ historyId });
  }

  async updateAccessToken(
    connectionId: string,
    accessToken: string,
    expiresAt: Date,
    refreshToken?: string
  ): Promise<void> {
    const updateData: Record<string, unknown> = {
      accessToken,
      expiresAt,
    };

    if (refreshToken) {
      updateData.refreshToken = refreshToken;
    }

    await this.tokenDoc(connectionId).update(updateData);
  }

  async updateExpiration(connectionId: string, expiration: string): Promise<void> {
    await this.collection().doc(connectionId).update({ expiration });
  }
}
