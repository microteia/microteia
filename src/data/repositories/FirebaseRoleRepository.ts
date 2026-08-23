import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  arrayRemove,
} from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { IRoleRepository, RoleActor } from '../../domain/repositories/IRoleRepository';
import type { Role, RoleInput } from '../../domain/entities/Role';

const toDate = (v: unknown): Date => (v instanceof Timestamp ? v.toDate() : (v as Date));

const rolesRef = (tenantId: string) => collection(db, 'tenants', tenantId, 'roles');

const mapRole = (id: string, d: Record<string, unknown>, tenantId: string): Role => ({
  id,
  tenantId,
  name: (d.name as string | undefined) ?? '',
  description: (d.description as string | null | undefined) ?? null,
  permissions: Array.isArray(d.permissions) ? (d.permissions as string[]) : [],
  system: d.system === true,
  createdAt: toDate(d.createdAt),
  createdBy: (d.createdBy as string | undefined) ?? '',
  updatedAt: toDate(d.updatedAt),
  updatedBy: (d.updatedBy as string | undefined) ?? '',
});

export class FirebaseRoleRepository implements IRoleRepository {
  async getAll(tenantId: string): Promise<Role[]> {
    const snap = await getDocs(query(rolesRef(tenantId), orderBy('name', 'asc')));
    return snap.docs.map((d) => mapRole(d.id, d.data(), tenantId));
  }

  subscribeToRoles(tenantId: string, onUpdate: (roles: Role[]) => void): () => void {
    return onSnapshot(query(rolesRef(tenantId), orderBy('name', 'asc')), (snap) => {
      onUpdate(snap.docs.map((d) => mapRole(d.id, d.data(), tenantId)));
    });
  }

  async create(tenantId: string, data: RoleInput, actor: RoleActor): Promise<Role> {
    const now = new Date();
    const ref = await addDoc(rolesRef(tenantId), {
      name: data.name,
      description: data.description ?? null,
      permissions: data.permissions,
      // Nunca `true` a partir do cliente: as regras recusam, e é o que garante que um perfil
      // protegido não possa nascer de uma tela.
      system: false,
      createdAt: serverTimestamp(),
      createdBy: actor.uid,
      updatedAt: serverTimestamp(),
      updatedBy: actor.uid,
    });
    return {
      id: ref.id,
      tenantId,
      name: data.name,
      description: data.description ?? null,
      permissions: data.permissions,
      system: false,
      createdAt: now,
      createdBy: actor.uid,
      updatedAt: now,
      updatedBy: actor.uid,
    };
  }

  async update(
    tenantId: string,
    roleId: string,
    data: Partial<RoleInput>,
    actor: RoleActor,
  ): Promise<void> {
    await updateDoc(doc(rolesRef(tenantId), roleId), {
      ...(data.name === undefined ? {} : { name: data.name }),
      ...(data.description === undefined ? {} : { description: data.description }),
      ...(data.permissions === undefined ? {} : { permissions: data.permissions }),
      updatedAt: serverTimestamp(),
      updatedBy: actor.uid,
    });
  }

  async delete(tenantId: string, roleId: string): Promise<void> {
    await deleteDoc(doc(rolesRef(tenantId), roleId));
  }

  async detachFromMembers(tenantId: string, roleId: string): Promise<void> {
    const members = await getDocs(
      query(collection(db, 'tenants', tenantId, 'members'), where('roleIds', 'array-contains', roleId)),
    );
    await Promise.all(
      members.docs.map((member) =>
        updateDoc(member.ref, { roleIds: arrayRemove(roleId), updatedAt: serverTimestamp() }),
      ),
    );
  }
}
