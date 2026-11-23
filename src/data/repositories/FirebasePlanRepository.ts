import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { IPlanRepository, PlanInput } from '../../domain/repositories/IPlanRepository';
import { PLANS_COLLECTION, planDefinitionOf, type PlanDefinition } from '../../domain/schema/plans';

export class FirebasePlanRepository implements IPlanRepository {
  async listPlans(): Promise<PlanDefinition[]> {
    const snap = await getDocs(collection(db, PLANS_COLLECTION));
    return snap.docs.map((d) => planDefinitionOf(d.id, d.data()));
  }

  async getPlan(planId: string): Promise<PlanDefinition | null> {
    const snap = await getDoc(doc(db, PLANS_COLLECTION, planId));
    return snap.exists() ? planDefinitionOf(snap.id, snap.data()) : null;
  }

  subscribePlan(planId: string, onChange: (plan: PlanDefinition | null) => void, onError: (error: Error) => void): () => void {
    return onSnapshot(
      doc(db, PLANS_COLLECTION, planId),
      (snap) => onChange(snap.exists() ? planDefinitionOf(snap.id, snap.data()) : null),
      onError,
    );
  }

  async createPlan(input: PlanInput, updatedBy: string): Promise<PlanDefinition> {
    const ref = doc(collection(db, PLANS_COLLECTION));
    await setDoc(ref, { ...input, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy });
    return { id: ref.id, ...input };
  }

  async createPlanIfMissing(planId: string, input: PlanInput, updatedBy: string): Promise<boolean> {
    const ref = doc(db, PLANS_COLLECTION, planId);
    return runTransaction(db, async (transaction) => {
      if ((await transaction.get(ref)).exists()) return false;
      transaction.set(ref, { ...input, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy });
      return true;
    });
  }

  async updatePlan(planId: string, change: Partial<PlanInput>, updatedBy: string): Promise<void> {
    await updateDoc(doc(db, PLANS_COLLECTION, planId), { ...change, updatedAt: serverTimestamp(), updatedBy });
  }

  async deletePlan(planId: string): Promise<void> {
    await deleteDoc(doc(db, PLANS_COLLECTION, planId));
  }

  async isPlanInUse(planId: string): Promise<boolean> {
    const snap = await getDocs(query(collection(db, 'tenants'), where('plan', '==', planId), limit(1)));
    return !snap.empty;
  }
}
