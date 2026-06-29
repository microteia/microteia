import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { ICaseLookupRepository } from '../../domain/repositories/ICaseLookupRepository';
import type { CaseLookupItem, CaseLookupKind } from '../../domain/entities';

const COLLECTION_NAMES: Record<CaseLookupKind, string> = {
  areas:       'caseAreas',
  phases:      'casePhases',
  statuses:    'caseStatuses',
  instances:   'caseInstances',
  actionTypes: 'caseActionTypes',
  courts:      'caseCourts',
  districts:   'caseDistricts',
  judges:      'caseJudges',
};

const col = (tenantId: string, kind: CaseLookupKind) =>
  collection(db, 'tenants', tenantId, COLLECTION_NAMES[kind]);

const mapItem = (id: string, d: Record<string, unknown>, tenantId: string): CaseLookupItem => ({
  id,
  tenantId,
  name:      d.name as string,
  createdBy: d.createdBy as string,
  createdAt: d.createdAt instanceof Timestamp ? d.createdAt.toDate() : (d.createdAt as Date),
});

export class FirebaseCaseLookupRepository implements ICaseLookupRepository {
  async getItems(tenantId: string, kind: CaseLookupKind): Promise<CaseLookupItem[]> {
    const q = query(col(tenantId, kind), orderBy('name', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => mapItem(d.id, d.data(), tenantId));
  }

  async createItem(tenantId: string, kind: CaseLookupKind, name: string, createdBy: string): Promise<CaseLookupItem> {
    const ref = await addDoc(col(tenantId, kind), { name, createdBy, createdAt: serverTimestamp() });
    return { id: ref.id, tenantId, name, createdBy, createdAt: new Date() };
  }

  async deleteItem(tenantId: string, kind: CaseLookupKind, id: string): Promise<void> {
    await deleteDoc(doc(col(tenantId, kind), id));
  }
}
