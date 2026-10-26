import { Timestamp } from 'firebase-admin/firestore';
import type { Firestore, QueryDocumentSnapshot, QuerySnapshot } from 'firebase-admin/firestore';
import type { IAuditLogDaySource } from '../../domain/repositories/IAuditLogDaySource';

const PAGE_SIZE = 1000;

/** O documento como dado puro: todo `Timestamp`, em qualquer profundidade, vira ISO. */
const plain = (value: unknown): unknown => {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(plain);
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, plain(item)]));
  }
  return value;
};

/**
 * Lê o dia em páginas pelo índice que a tela de Auditoria já usa (`tenantId` + `createdAt` desc): o
 * arquivo não pede índice novo. A ordem do arquivo é refeita depois, pela cadeia.
 */
export class FirestoreAuditLogDaySource implements IAuditLogDaySource {
  constructor(private readonly db: Firestore) {}

  async logsBetween(tenantId: string, start: Date, end: Date): Promise<Record<string, unknown>[]> {
    const base = this.db.collection('auditLogs')
      .where('tenantId', '==', tenantId)
      .where('createdAt', '>=', Timestamp.fromDate(start))
      .where('createdAt', '<', Timestamp.fromDate(end))
      .orderBy('createdAt', 'desc')
      .limit(PAGE_SIZE);

    const logs: Record<string, unknown>[] = [];
    let cursor: QueryDocumentSnapshot | null = null;
    for (;;) {
      const page: QuerySnapshot = await (cursor ? base.startAfter(cursor) : base).get();
      for (const doc of page.docs) logs.push({ ...(plain(doc.data()) as Record<string, unknown>), id: doc.id });
      if (page.docs.length < PAGE_SIZE) return logs;
      cursor = page.docs[page.docs.length - 1];
    }
  }
}
