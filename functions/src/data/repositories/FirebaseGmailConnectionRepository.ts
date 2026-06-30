import { getFirestore } from 'firebase-admin/firestore';
import type { IGmailConnectionRepository } from '../../domain/repositories/IGmailConnectionRepository';
import type { GmailConnection } from '../../domain/entities/GmailConnection';

export class FirebaseGmailConnectionRepository implements IGmailConnectionRepository {
  private readonly db = getFirestore();

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
}
