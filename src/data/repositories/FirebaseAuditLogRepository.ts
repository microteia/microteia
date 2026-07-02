import {
  collection, getDocs, query, where, orderBy, limit, startAfter, Timestamp,
} from 'firebase/firestore';
import type { QueryDocumentSnapshot, DocumentData, QueryConstraint } from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { IAuditLogRepository, AuditLogQuery, AuditLogPage } from '../../domain/repositories/IAuditLogRepository';
import type { AuditLog, AuditAction, AuditSeverity, AuditType } from '../../domain/entities';

const toDate = (v: unknown): Date =>
  v instanceof Timestamp ? v.toDate() : (v as Date);

const toAuditLog = (id: string, d: Record<string, unknown>): AuditLog => ({
  id,
  tenantId: d.tenantId as string,
  title: d.title as string,
  userId: d.userId as string,
  userName: d.userName as string,
  photoURL: d.photoURL as string,
  action: d.action as AuditAction,
  severity: d.severity as AuditSeverity,
  type: d.type as AuditType,
  entity: d.entity as string,
  entityId: d.entityId as string,
  entityLink: d.entityLink as string | undefined,
  text: d.text as string,
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
}
