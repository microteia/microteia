import {
  collection, getDocs, getDoc, setDoc, doc, query, where, orderBy, limit, startAfter, onSnapshot, Timestamp,
} from 'firebase/firestore';
import type { QueryDocumentSnapshot, DocumentData, QueryConstraint } from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { IAuditLogRepository, AuditLogQuery, AuditLogPage } from '../../domain/repositories/IAuditLogRepository';
import type { AuditLog, AuditAction, AuditSeverity, AuditType, AuditLogReadCursor } from '../../domain/entities';

const READ_CURSOR_COLLECTION = 'auditLogReadCursors';
const UNREAD_CRITICAL_CAP = 100;

const toReadCursor = (d: Record<string, unknown>): AuditLogReadCursor => ({
  userId: d.userId as string,
  tenantId: d.tenantId as string,
  lastReadAt: (d.lastReadAt as Timestamp).toDate(),
});

const toDate = (v: unknown): Date =>
  v instanceof Timestamp ? v.toDate() : (v as Date);

const toAuditLog = (id: string, d: Record<string, unknown>): AuditLog => ({
  id,
  tenantId: d.tenantId as string,
  title: d.title as string,
  titleParams: d.titleParams as Record<string, string> | undefined,
  userId: d.userId as string,
  userName: d.userName as string,
  photoURL: d.photoURL as string,
  action: d.action as AuditAction,
  severity: d.severity as AuditSeverity,
  type: d.type as AuditType,
  entity: d.entity as string,
  entityId: d.entityId as string,
  entityLink: d.entityLink as string | undefined,
  linkCollection: d.linkCollection as string | undefined,
  linkRecordId: d.linkRecordId as string | undefined,
  text: d.text as string,
  textParams: d.textParams as Record<string, string> | undefined,
  createdAt: toDate(d.createdAt),
  expiresAt: toDate(d.expiresAt),
});

export class FirebaseAuditLogRepository implements IAuditLogRepository {
  async getPage(q: AuditLogQuery): Promise<AuditLogPage> {
    // Filtros de entidade/ação/severidade/texto são aplicados client-side (ver AuditLogs.viewmodel.tsx)
    // sobre a página já carregada — evita exigir um índice composto do Firestore por combinação de filtro.
    const constraints: QueryConstraint[] = [];
    if (q.tenantId !== null) constraints.push(where('tenantId', '==', q.tenantId));
    constraints.push(orderBy('createdAt', 'desc'));
    if (q.cursor) constraints.push(startAfter(q.cursor as QueryDocumentSnapshot<DocumentData>));
    constraints.push(limit(q.pageSize));

    const snap = await getDocs(query(collection(db, 'auditLogs'), ...constraints));
    const logs = snap.docs.map((d) => toAuditLog(d.id, d.data() as Record<string, unknown>));
    const lastDoc = snap.docs[snap.docs.length - 1];

    return {
      logs,
      nextCursor: lastDoc ?? null,
      hasMore: snap.docs.length === q.pageSize,
    };
  }

  async getReadCursor(userId: string, tenantId: string): Promise<AuditLogReadCursor | null> {
    const ref = doc(db, READ_CURSOR_COLLECTION, `${userId}_${tenantId}`);
    const snap = await getDoc(ref);
    return snap.exists() ? toReadCursor(snap.data() as Record<string, unknown>) : null;
  }

  async markAllCriticalAsRead(userId: string, tenantId: string): Promise<AuditLogReadCursor> {
    const ref = doc(db, READ_CURSOR_COLLECTION, `${userId}_${tenantId}`);
    const lastReadAt = Timestamp.now();
    await setDoc(ref, { userId, tenantId, lastReadAt });
    return { userId, tenantId, lastReadAt: lastReadAt.toDate() };
  }

  subscribeToCriticalUnread(tenantId: string, since: Date, callback: (count: number) => void): () => void {
    const q = query(
      collection(db, 'auditLogs'),
      where('tenantId', '==', tenantId),
      where('severity', '==', 'CRITICAL'),
      where('createdAt', '>', Timestamp.fromDate(since)),
      limit(UNREAD_CRITICAL_CAP),
    );

    return onSnapshot(q, (snap) => callback(snap.size));
  }
}
