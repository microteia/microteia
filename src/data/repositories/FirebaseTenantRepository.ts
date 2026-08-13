import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { httpsCallable, FunctionsError } from 'firebase/functions';
import { db, functions } from '../../infrastructure/firebase/config';
import type { ITenantRepository, TenantMemberRoleActor } from '../../domain/repositories/ITenantRepository';
import type { Tenant, TenantMember, TenantRole } from '../../domain/entities';
import { TenantMemberLimitReachedError } from '../../domain/errors';

const toDate = (v: unknown): Date =>
  v instanceof Timestamp ? v.toDate() : (v as Date);

const mapTenant = (id: string, d: Record<string, unknown>): Tenant => ({
  id,
  name: d.name as string,
  ownerId: d.ownerId as string,
  cnpj: (d.cnpj as string | null) ?? null,
  email: (d.email as string | null) ?? null,
  phone: (d.phone as string | null) ?? null,
  address: (d.address as string | null) ?? null,
  logoURL: (d.logoURL as string | null) ?? null,
  plan: (d.plan as Tenant['plan'] | undefined) ?? 'solo',
  memberLimit: (d.memberLimit as number | null | undefined) ?? null,
  memberCount: (d.memberCount as number | undefined) ?? 0,
  createdAt: toDate(d.createdAt),
  updatedAt: toDate(d.updatedAt),
});

const mapMember = (d: Record<string, unknown>): TenantMember => ({
  userId: d.userId as string,
  tenantId: d.tenantId as string,
  role: d.role as TenantRole,
  displayName: d.displayName as string,
  email: d.email as string,
  photoURL: (d.photoURL as string | null) ?? null,
  addedAt: toDate(d.addedAt),
  addedBy: d.addedBy as string,
});

export class FirebaseTenantRepository implements ITenantRepository {
  async getTenantById(tenantId: string): Promise<Tenant | null> {
    const snap = await getDoc(doc(db, 'tenants', tenantId));
    if (!snap.exists()) return null;
    return mapTenant(snap.id, snap.data());
  }

  async updateTenant(tenantId: string, data: Partial<Omit<Tenant, 'id' | 'ownerId' | 'createdAt'>>): Promise<void> {
    await updateDoc(doc(db, 'tenants', tenantId), { ...data, updatedAt: serverTimestamp() });
  }

  async updateMemberLimit(tenantId: string, memberLimit: number | null): Promise<void> {
    await updateDoc(doc(db, 'tenants', tenantId), { memberLimit, updatedAt: serverTimestamp() });
  }

  async addMember(tenantId: string, member: Omit<TenantMember, 'addedAt'>): Promise<void> {
    const call = httpsCallable<
      { tenantId: string; userId: string; role: TenantRole; displayName: string; email: string; photoURL: string | null },
      { success: boolean }
    >(functions, 'addTenantMember');
    try {
      await call({
        tenantId,
        userId: member.userId,
        role: member.role,
        displayName: member.displayName,
        email: member.email,
        photoURL: member.photoURL,
      });
    } catch (err) {
      if (err instanceof FunctionsError && err.code === 'functions/resource-exhausted') {
        throw new TenantMemberLimitReachedError();
      }
      throw err;
    }
  }

  async updateMemberRole(tenantId: string, userId: string, role: TenantRole, actor: TenantMemberRoleActor): Promise<void> {
    await updateDoc(doc(db, 'tenants', tenantId, 'members', userId), {
      role,
      updatedAt: serverTimestamp(),
      updatedBy: actor.uid,
    });
  }

  async removeMember(tenantId: string, userId: string): Promise<void> {
    const call = httpsCallable<{ tenantId: string; userId: string }, { success: boolean }>(functions, 'removeTenantMember');
    await call({ tenantId, userId });
  }

  async getMembers(tenantId: string): Promise<TenantMember[]> {
    const snap = await getDocs(collection(db, 'tenants', tenantId, 'members'));
    return snap.docs.map((d) => mapMember(d.data()));
  }

  async getMemberRole(tenantId: string, userId: string): Promise<TenantRole | null> {
    const snap = await getDoc(doc(db, 'tenants', tenantId, 'members', userId));
    if (!snap.exists()) return null;
    return (snap.data().role as TenantRole) ?? null;
  }

  async getTenantsForUser(userId: string): Promise<Tenant[]> {
    const tenantIdSet = new Set<string>();

    // Source 1: tenantIds array stored on the user document (own tenants, always works)
    try {
      const userSnap = await getDoc(doc(db, 'users', userId));
      if (userSnap.exists()) {
        const ids = (userSnap.data().tenantIds as string[] | undefined) ?? [];
        ids.forEach((id) => tenantIdSet.add(id));
      }
    } catch { /* non-critical */ }

    // Source 2: collectionGroup query (finds tenants where user was added by an admin).
    // Requires a Firestore collection-group index on members.userId — see ARCHITECTURE.md.
    try {
      const q = query(collectionGroup(db, 'members'), where('userId', '==', userId));
      const snap = await getDocs(q);
      snap.docs.forEach((d) => tenantIdSet.add(d.ref.parent.parent!.id));
    } catch { /* index may not exist yet; tenantIds fallback covers own tenants */ }

    if (tenantIdSet.size === 0) return [];
    const results = await Promise.allSettled([...tenantIdSet].map((id) => this.getTenantById(id)));
    return results
      .filter((r): r is PromiseFulfilledResult<Tenant | null> => r.status === 'fulfilled')
      .map((r) => r.value)
      .filter((t): t is Tenant => t !== null);
  }

  async getAllTenants(): Promise<Tenant[]> {
    const snap = await getDocs(collection(db, 'tenants'));
    return snap.docs.map((d) => mapTenant(d.id, d.data()));
  }
}
