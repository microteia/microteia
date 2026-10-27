import { Timestamp } from 'firebase-admin/firestore';
import type { IPortalViewMarks } from '../../domain/repositories/IPortalViewMarks';
import { PORTAL_VIEW_MARKS_COLLECTION } from '../../domain/schema/portalCollections';
import { PORTAL_VIEW_REPEAT_MINUTES, isRepeatedPortalView } from '../../domain/schema/portal';
import { getDb } from '../../infrastructure/firebase/initFirebase';

const markOf = (markId: string) => getDb().collection(PORTAL_VIEW_MARKS_COLLECTION).doc(markId);

const instantOf = (value: unknown): Date | null => (value instanceof Timestamp ? value.toDate() : null);

/**
 * As marcas na coleção de RAIZ `portalViewMarks`, uma por convidado e por registro (ou documento). O
 * `expiresAt` é o TTL declarado em `firestore.indexes.json`: a marca vencida não serve a ninguém, e o
 * Firestore a apaga sozinho — nenhuma varredura nossa.
 */
export class FirebasePortalViewMarks implements IPortalViewMarks {
  async claim(markId: string, tenantId: string, at: Date): Promise<boolean> {
    const reference = markOf(markId);
    return getDb().runTransaction(async (transaction) => {
      const current = await transaction.get(reference);
      if (isRepeatedPortalView(instantOf(current.get('at')), at)) return false;
      transaction.set(reference, {
        tenantId,
        at: Timestamp.fromDate(at),
        expiresAt: Timestamp.fromMillis(at.getTime() + PORTAL_VIEW_REPEAT_MINUTES * 60_000),
      });
      return true;
    });
  }

  async release(markId: string, at: Date): Promise<void> {
    const reference = markOf(markId);
    await getDb().runTransaction(async (transaction) => {
      const current = await transaction.get(reference);
      if (instantOf(current.get('at'))?.getTime() === at.getTime()) transaction.delete(reference);
    });
  }
}
