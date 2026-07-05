import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
  writeBatch,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { IFinancialRepository } from '../../domain/repositories/IFinancialRepository';
import type { Financial, FinancialStatus, FinancialType, DeletionActor, CustomFieldValue } from '../../domain/entities';
import { stampDeletionActor } from '../utils/stampDeletionActor';

const toDate = (v: unknown): Date =>
  v instanceof Timestamp ? v.toDate() : (v as Date);

const toDateOrNull = (v: unknown): Date | null => {
  if (!v) return null;
  return v instanceof Timestamp ? v.toDate() : (v as Date);
};

const financialsRef = (tenantId: string) =>
  collection(db, 'tenants', tenantId, 'financials');

const mapFinancial = (id: string, d: Record<string, unknown>, tenantId: string): Financial => ({
  id,
  tenantId,
  caseId: (d.caseId as string | null) ?? null,
  personId: (d.personId as string | null) ?? null,
  contractId: (d.contractId as string | null) ?? null,
  type: d.type as FinancialType,
  category: d.category as Financial['category'],
  costCenter: (d.costCenter as string | null) ?? null,
  amount: d.amount as number,
  dueDate: toDate(d.dueDate),
  paymentDate: toDateOrNull(d.paymentDate),
  cancelDate: toDateOrNull(d.cancelDate),
  status: (d.status as Financial['status']) ?? 'Aberto',
  paymentMethod: (d.paymentMethod as Financial['paymentMethod']) ?? null,
  invoiceNumber: (d.invoiceNumber as string | null) ?? null,
  notes: (d.notes as string | null) ?? null,
  tagIds: (d.tagIds as string[] | undefined) ?? [],
  customValues: (d.customValues as Record<string, CustomFieldValue> | undefined) ?? {},
  createdAt: toDate(d.createdAt),
  createdBy: d.createdBy as string,
  updatedAt: toDate(d.updatedAt),
});

export class FirebaseFinancialRepository implements IFinancialRepository {
  async getFinancials(tenantId: string): Promise<Financial[]> {
    const q = query(financialsRef(tenantId), orderBy('dueDate', 'desc'), limit(500));
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapFinancial(d.id, d.data(), tenantId));
  }

  subscribeToFinancials(tenantId: string, onUpdate: (financials: Financial[]) => void): () => void {
    const q = query(financialsRef(tenantId), orderBy('dueDate', 'desc'), limit(500));
    return onSnapshot(
      q,
      (snap) => {
        onUpdate(snap.docs.map((d) => mapFinancial(d.id, d.data(), tenantId)));
      },
      (error) => {
        console.error('[FinancialRepository] subscribeToFinancials:', error.message);
      },
    );
  }

  async getFinancialsByCase(tenantId: string, caseId: string): Promise<Financial[]> {
    const q = query(
      financialsRef(tenantId),
      where('caseId', '==', caseId),
      orderBy('dueDate', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapFinancial(d.id, d.data(), tenantId));
  }

  async getFinancialsByPerson(tenantId: string, personId: string): Promise<Financial[]> {
    const q = query(
      financialsRef(tenantId),
      where('personId', '==', personId),
      orderBy('dueDate', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapFinancial(d.id, d.data(), tenantId));
  }

  async getFinancialsByType(tenantId: string, type: FinancialType): Promise<Financial[]> {
    const q = query(
      financialsRef(tenantId),
      where('type', '==', type),
      orderBy('dueDate', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapFinancial(d.id, d.data(), tenantId));
  }

  async getFinancialById(tenantId: string, financialId: string): Promise<Financial | null> {
    const snap = await getDoc(doc(financialsRef(tenantId), financialId));
    if (!snap.exists()) return null;
    return mapFinancial(snap.id, snap.data(), tenantId);
  }

  async createFinancial(tenantId: string, data: Omit<Financial, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>): Promise<Financial> {
    const ref = await addDoc(financialsRef(tenantId), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const snap = await getDoc(ref);
    return mapFinancial(ref.id, snap.data() as Record<string, unknown>, tenantId);
  }

  async updateFinancial(tenantId: string, financialId: string, data: Partial<Omit<Financial, 'id' | 'tenantId' | 'createdAt' | 'createdBy'>>): Promise<void> {
    await updateDoc(doc(financialsRef(tenantId), financialId), { ...data, updatedAt: serverTimestamp() });
  }

  async updateFinancialStatus(tenantId: string, financialId: string, status: FinancialStatus, paymentDate?: Date): Promise<void> {
    const payload: Record<string, unknown> = { status, updatedAt: serverTimestamp() };
    if (status === 'Pago' && paymentDate) payload.paymentDate = paymentDate;
    else if (status !== 'Pago') payload.paymentDate = null;
    await updateDoc(doc(financialsRef(tenantId), financialId), payload);
  }

  async updateFinancialTags(tenantId: string, financialId: string, tagIds: string[]): Promise<void> {
    await updateDoc(doc(financialsRef(tenantId), financialId), { tagIds, updatedAt: serverTimestamp() });
  }

  async cancelFinancial(tenantId: string, financialId: string, cancelDate: Date): Promise<void> {
    await updateDoc(doc(financialsRef(tenantId), financialId), {
      status: 'Cancelado',
      cancelDate,
      updatedAt: serverTimestamp(),
    });
  }

  async deleteFinancial(tenantId: string, financialId: string, actor: DeletionActor): Promise<void> {
    const ref = doc(financialsRef(tenantId), financialId);
    await stampDeletionActor(ref, actor);
    await deleteDoc(ref);
  }

  async unlinkFinancialsFromContract(tenantId: string, contractId: string): Promise<void> {
    const q = query(financialsRef(tenantId), where('contractId', '==', contractId));
    const snap = await getDocs(q);
    if (snap.empty) return;
    const batch = writeBatch(db);
    for (const d of snap.docs) {
      batch.update(d.ref, { contractId: null, updatedAt: serverTimestamp() });
    }
    await batch.commit();
  }
}
