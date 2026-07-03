import {
  collection, getDocs, updateDoc, deleteDoc, doc, query,
  Timestamp, getDoc, orderBy, onSnapshot,
} from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { IPushRepository } from '../../domain/repositories/IPushRepository';
import type { Push, PushStatus, DeletionActor } from '../../domain/entities';
import { stampDeletionActor } from '../utils/stampDeletionActor';

type PushStatusActor = { updatedBy: string; updatedByName: string; updatedByPhotoURL: string };

const toPush = (pushId: string, data: Record<string, unknown>): Push => {
  const toDate = (value: unknown): Date | undefined => {
    if (!value) return undefined;
    if (value instanceof Timestamp) return value.toDate();
    if (value instanceof Date) return value;
    return new Date(value as string);
  };

  return {
    id: pushId,
    tenantId: data.tenantId as string,
    emailId: data.emailId as string,
    from: data.from as string,
    to: data.to as string,
    subject: data.subject as string,
    receivedAt: toDate(data.receivedAt) ?? new Date(),
    emailBodyHtml: data.emailBodyHtml as string | undefined,
    emailBodyText: data.emailBodyText as string | undefined,
    processNumber: data.processNumber as string | undefined,
    court: data.court as string | undefined,
    activeParty: data.activeParty as string | undefined,
    passiveParty: data.passiveParty as string | undefined,
    legalClass: data.legalClass as string | undefined,
    filingDate: toDate(data.filingDate),
    distributionType: data.distributionType as string | undefined,
    processSubject: data.processSubject as string | undefined,
    movements: (data.movements as Array<{
      date: unknown;
      type: string;
      description?: string;
      documentUrl?: string;
    }> | undefined)?.map(m => ({
      date: toDate(m.date) ?? new Date(),
      type: m.type,
      description: m.description,
      documentUrl: m.documentUrl,
    })),
    status: (data.status as PushStatus) ?? 'pending',
    parsedByAI: (data.parsedByAI as boolean) ?? false,
    parsingError: data.parsingError as string | undefined,
    createdAt: toDate(data.createdAt) ?? new Date(),
    createdBy: (data.createdBy as string) ?? 'system',
    updatedBy: data.updatedBy as string | undefined,
    updatedByName: data.updatedByName as string | undefined,
    updatedByPhotoURL: data.updatedByPhotoURL as string | undefined,
  };
};

export class FirebasePushRepository implements IPushRepository {
  async getPushes(tenantId: string): Promise<Push[]> {
    const q = query(
      collection(db, 'tenants', tenantId, 'pushes'),
      orderBy('receivedAt', 'desc'),
    );

    const snap = await getDocs(q);
    return snap.docs.map(d => toPush(d.id, d.data() as Record<string, unknown>));
  }

  async getPushById(tenantId: string, pushId: string): Promise<Push | null> {
    const snap = await getDoc(doc(db, 'tenants', tenantId, 'pushes', pushId));
    if (!snap.exists()) return null;
    return toPush(snap.id, snap.data() as Record<string, unknown>);
  }

  async updatePushStatus(tenantId: string, pushId: string, status: PushStatus, actor: PushStatusActor): Promise<void> {
    const pushRef = doc(db, 'tenants', tenantId, 'pushes', pushId);
    await updateDoc(pushRef, { status, ...actor });
  }

  async deletePush(tenantId: string, pushId: string, actor: DeletionActor): Promise<void> {
    const ref = doc(db, 'tenants', tenantId, 'pushes', pushId);
    await stampDeletionActor(ref, actor);
    await deleteDoc(ref);
  }

  subscribeToPushes(tenantId: string, callback: (pushes: Push[]) => void): () => void {
    const q = query(
      collection(db, 'tenants', tenantId, 'pushes'),
      orderBy('receivedAt', 'desc'),
    );

    return onSnapshot(q, (snap) => {
      const pushes = snap.docs.map(d => toPush(d.id, d.data() as Record<string, unknown>));
      callback(pushes);
    });
  }
}
