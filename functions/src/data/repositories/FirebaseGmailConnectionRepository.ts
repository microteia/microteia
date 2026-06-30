import { getFirestore } from 'firebase-admin/firestore';
import type { IGmailConnectionRepository, GmailToken } from '../../domain/repositories/IGmailConnectionRepository';
import type { GmailConnection } from '../../domain/entities/GmailConnection';

export class FirebaseGmailConnectionRepository implements IGmailConnectionRepository {
  private readonly db = getFirestore();

  async getAllConnections(): Promise<GmailConnection[]> {
    const snapshot = await this.db
      .collection('gmailConnections')
      .get();

    return snapshot.docs.map((doc) => {
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
    });
  }

  async getConnectionsByEmail(email: string): Promise<GmailConnection[]> {
    const snapshot = await this.db
      .collection('gmailConnections')
      .where('email', '==', email)
      .get();

    return snapshot.docs.map((doc) => {
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
    });
  }

  async getAccessToken(connectionId: string): Promise<GmailToken | null> {
    try {
      const tokenDoc = await this.db
        .collection('gmailConnections')
        .doc(connectionId)
        .collection('tokens')
        .doc('current')
        .get();

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
    await this.db
      .collection('gmailConnections')
      .doc(connectionId)
      .update({ historyId });
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

    await this.db
      .collection('gmailConnections')
      .doc(connectionId)
      .collection('tokens')
      .doc('current')
      .update(updateData);
  }

  async updateExpiration(connectionId: string, expiration: string): Promise<void> {
    await this.db
      .collection('gmailConnections')
      .doc(connectionId)
      .update({ expiration });
  }
}
