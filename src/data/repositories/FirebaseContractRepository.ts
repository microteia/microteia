import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { IContractRepository } from '../../domain/repositories/IContractRepository';
import type { Contract, DeletionActor, CustomFieldValue } from '../../domain/entities';
import { stampDeletionActor } from '../utils/stampDeletionActor';
import { applyRecordRules } from '../utils/recordRulesGate';

const toDate = (v: unknown): Date =>
  v instanceof Timestamp ? v.toDate() : (v as Date);

const toDateOrNull = (v: unknown): Date | null => {
  if (!v) return null;
  return v instanceof Timestamp ? v.toDate() : (v as Date);
};

const contractsRef = (tenantId: string) =>
  collection(db, 'tenants', tenantId, 'contracts');

const mapContract = (id: string, d: Record<string, unknown>, tenantId: string): Contract => ({
  id,
  tenantId,
  number: d.number as string,
  title: d.title as string,
  type: d.type as string,
  category: d.category as string,
  status: d.status as string,
  object: (d.object as string | null) ?? null,
  contractorIds: (d.contractorIds as string[] | undefined) ?? [],
  contracteeIds: (d.contracteeIds as string[] | undefined) ?? [],
  witnessIds: (d.witnessIds as string[] | undefined) ?? [],
  contractorLawyerIds: (d.contractorLawyerIds as string[] | undefined) ?? [],
  contracteeLawyerIds: (d.contracteeLawyerIds as string[] | undefined) ?? [],
  clientId: (d.clientId as string | null) ?? null,
  responsibleId: (d.responsibleId as string | null) ?? null,
  draftedAt: toDateOrNull(d.draftedAt),
  signedAt: toDateOrNull(d.signedAt),
  effectiveStart: toDateOrNull(d.effectiveStart),
  effectiveEnd: toDateOrNull(d.effectiveEnd),
  autoRenewal: (d.autoRenewal as boolean | undefined) ?? false,
  renewalDate: toDateOrNull(d.renewalDate),
  terminationDate: toDateOrNull(d.terminationDate),
  initialValue: (d.initialValue as number | null) ?? null,
  monthlyValue: (d.monthlyValue as number | null) ?? null,
  totalValue: (d.totalValue as number | null) ?? null,
  adjustmentIndex: (d.adjustmentIndex as string | null) ?? null,
  adjustmentPeriodicity: (d.adjustmentPeriodicity as string | null) ?? null,
  currency: (d.currency as string | null) ?? null,
  paymentMethod: (d.paymentMethod as string | null) ?? null,
  dueDay: (d.dueDay as number | null) ?? null,
  installments: (d.installments as number | null) ?? null,
  bank: (d.bank as string | null) ?? null,
  bankAccount: (d.bankAccount as string | null) ?? null,
  pixKey: (d.pixKey as string | null) ?? null,
  costCenter: (d.costCenter as string | null) ?? null,
  tagIds: (d.tagIds as string[] | undefined) ?? [],
  customValues: (d.customValues as Record<string, CustomFieldValue> | undefined) ?? {},
  createdAt: toDate(d.createdAt),
  createdBy: d.createdBy as string,
  updatedAt: toDate(d.updatedAt),
});

export class FirebaseContractRepository implements IContractRepository {
  async getContracts(tenantId: string): Promise<Contract[]> {
    const q = query(contractsRef(tenantId), orderBy('createdAt', 'desc'), limit(500));
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapContract(d.id, d.data(), tenantId));
  }

  subscribeToContracts(tenantId: string, onUpdate: (contracts: Contract[]) => void): () => void {
    const q = query(contractsRef(tenantId), orderBy('createdAt', 'desc'), limit(500));
    return onSnapshot(
      q,
      (snap) => {
        onUpdate(snap.docs.map((d) => mapContract(d.id, d.data(), tenantId)));
      },
      (error) => {
        console.error('[ContractRepository] subscribeToContracts:', error.message);
      },
    );
  }

  async getContractById(tenantId: string, contractId: string): Promise<Contract | null> {
    const snap = await getDoc(doc(contractsRef(tenantId), contractId));
    if (!snap.exists()) return null;
    return mapContract(snap.id, snap.data(), tenantId);
  }

  async createContract(tenantId: string, data: Omit<Contract, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>): Promise<Contract> {
    const ref = await addDoc(contractsRef(tenantId), {
      ...applyRecordRules('contracts', data),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const snap = await getDoc(ref);
    return mapContract(ref.id, snap.data() as Record<string, unknown>, tenantId);
  }

  async updateContract(tenantId: string, contractId: string, data: Partial<Omit<Contract, 'id' | 'tenantId' | 'createdAt' | 'createdBy'>>): Promise<void> {
    await updateDoc(doc(contractsRef(tenantId), contractId), {
      ...applyRecordRules('contracts', data),
      updatedAt: serverTimestamp(),
    });
  }

  async updateContractTags(tenantId: string, contractId: string, tagIds: string[]): Promise<void> {
    await updateDoc(doc(contractsRef(tenantId), contractId), { tagIds, updatedAt: serverTimestamp() });
  }

  async deleteContract(tenantId: string, contractId: string, actor: DeletionActor): Promise<void> {
    const ref = doc(contractsRef(tenantId), contractId);
    await stampDeletionActor(ref, actor);
    await deleteDoc(ref);
  }
}
