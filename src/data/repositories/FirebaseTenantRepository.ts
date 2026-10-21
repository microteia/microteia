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
import { db, functions, storage } from '../../infrastructure/firebase/config';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { tenantLogoStoragePath } from '../../domain/schema/tenantBranding';
import type { ITenantRepository, TenantMemberRoleActor } from '../../domain/repositories/ITenantRepository';
import type { Tenant, TenantMember, TenantUpdate } from '../../domain/entities';
import { TenantMemberLimitReachedError } from '../../domain/errors';

const toDate = (v: unknown): Date =>
  v instanceof Timestamp ? v.toDate() : (v as Date);

const mapTenant = (id: string, d: Record<string, unknown>): Tenant => ({
  id,
  name: d.name as string,
  ownerId: d.ownerId as string,
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
  roleIds: Array.isArray(d.roleIds) ? (d.roleIds as string[]) : [],
  permissions: Array.isArray(d.permissions) ? (d.permissions as string[]) : [],
  ...(typeof d.permissionsCatalog === 'string' ? { permissionsCatalog: d.permissionsCatalog } : {}),
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

  async uploadLogo(tenantId: string, image: Blob, fileName: string): Promise<string> {
    const logoRef = ref(storage, tenantLogoStoragePath(tenantId, fileName));
    await uploadBytes(logoRef, image, { contentType: image.type || 'image/png' });
    return getDownloadURL(logoRef);
  }

  async updateTenant(tenantId: string, data: TenantUpdate): Promise<void> {
    await updateDoc(doc(db, 'tenants', tenantId), { ...data, updatedAt: serverTimestamp() });
  }

  async updateMemberLimit(tenantId: string, memberLimit: number | null): Promise<void> {
    await updateDoc(doc(db, 'tenants', tenantId), { memberLimit, updatedAt: serverTimestamp() });
  }

  async addMember(tenantId: string, member: Omit<TenantMember, 'addedAt' | 'permissions'>): Promise<void> {
    const call = httpsCallable<
      { tenantId: string; userId: string; roleIds: string[]; displayName: string; email: string; photoURL: string | null },
      { success: boolean }
    >(functions, 'addTenantMember');
    try {
      await call({
        tenantId,
        userId: member.userId,
        roleIds: member.roleIds,
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

  async updateMemberRoles(tenantId: string, userId: string, roleIds: string[], actor: TenantMemberRoleActor): Promise<void> {
    await updateDoc(doc(db, 'tenants', tenantId, 'members', userId), {
      roleIds,
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
