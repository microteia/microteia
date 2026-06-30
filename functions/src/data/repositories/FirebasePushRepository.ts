import { getFirestore } from 'firebase-admin/firestore';
import type { IPushRepository } from '../../domain/repositories/IPushRepository';
import type { Push } from '../../domain/entities/Push';

export class FirebasePushRepository implements IPushRepository {
  private readonly db = getFirestore();

  async create(tenantId: string, push: Omit<Push, 'id' | 'tenantId' | 'createdAt'>): Promise<Push> {
    const createdAt = new Date();
    const docRef = await this.db
      .collection('tenants')
      .doc(tenantId)
      .collection('pushes')
      .add({
        tenantId,
        ...push,
        createdAt,
      });

    return {
      id: docRef.id,
      tenantId,
      ...push,
      createdAt,
    };
  }

  async getByEmailId(tenantId: string, emailId: string): Promise<Push | null> {
    const snapshot = await this.db
      .collection('tenants')
      .doc(tenantId)
      .collection('pushes')
      .where('emailId', '==', emailId)
      .limit(1)
      .get();

    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    const data = doc.data();
    
    return {
      id: doc.id,
      tenantId: data.tenantId,
      emailId: data.emailId,
      from: data.from,
      to: data.to,
      subject: data.subject,
      receivedAt: data.receivedAt?.toDate() ?? new Date(),
      emailBodyHtml: data.emailBodyHtml,
      emailBodyText: data.emailBodyText,
      processNumber: data.processNumber,
      court: data.court,
      activeParty: data.activeParty,
      passiveParty: data.passiveParty,
      legalClass: data.legalClass,
      filingDate: data.filingDate?.toDate(),
      distributionType: data.distributionType,
      processSubject: data.processSubject,
      movements: data.movements?.map((m: { date?: unknown; type: string; description: string; documentUrl?: string }) => ({
        date: m.date && typeof m.date === 'object' && 'toDate' in m.date && typeof m.date.toDate === 'function'
          ? m.date.toDate()
          : m.date instanceof Date
            ? m.date
            : new Date(),
        type: m.type,
        description: m.description,
        documentUrl: m.documentUrl,
      })),
      status: data.status,
      parsedByAI: data.parsedByAI ?? false,
      parsingError: data.parsingError,
      createdAt: data.createdAt?.toDate() ?? new Date(),
      createdBy: data.createdBy,
    };
  }

  async update(
    tenantId: string,
    pushId: string,
    updates: Partial<Omit<Push, 'id' | 'tenantId' | 'createdAt' | 'createdBy'>>
  ): Promise<void> {
    await this.db
      .collection('tenants')
      .doc(tenantId)
      .collection('pushes')
      .doc(pushId)
      .update(updates);
  }
}
