import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import type { ITenantRepository, AddTenantMemberInput, CreateTenantInput } from '../../domain/repositories/ITenantRepository';
import type { Tenant } from '../../domain/entities/Tenant';
import { alreadyExists, notFound } from '../../domain/errors/DomainError';
import { ARTIFACT_PREFIX_SETTING } from '../../domain/schema/plugin/artifactPrefix';

export class FirebaseTenantRepository implements ITenantRepository {
  constructor(private readonly db: Firestore) {}

  async createTenant(data: CreateTenantInput): Promise<Tenant> {
    const now = new Date();
    const ref = this.db.collection('tenants').doc();
    const payload = {
      name: data.name,
      ownerId: data.ownerId,
      email: data.email,
      phone: null,
      address: null,
      logoURL: null,
      allowedSenders: [] as string[],
      allowedSubjects: [] as string[],
      plan: data.plan,
      memberLimit: data.memberLimit,
      memberCount: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    // O escritório e o prefixo nascem no mesmo lote: não existe escritório sem prefixo para alguém
    // criar a primeira tela nele.
    const batch = this.db.batch();
    batch.set(ref, payload);
    batch.set(ref.collection('settings').doc('tenant'), {
      scope: 'tenant',
      values: { [ARTIFACT_PREFIX_SETTING]: data.artifactPrefix },
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: data.ownerId,
    });
    await batch.commit();
    return { id: ref.id, ...payload, createdAt: now, updatedAt: now };
  }

  async getById(tenantId: string): Promise<Tenant | null> {
    try {
      const doc = await this.db.collection('tenants').doc(tenantId).get();

      if (!doc.exists) {
        return null;
      }

      const data = doc.data()!;
      return {
        id: doc.id,
        name: data.name,
        ownerId: data.ownerId,
        email: data.email ?? null,
        phone: data.phone ?? null,
        address: data.address ?? null,
        logoURL: data.logoURL ?? null,
        allowedSenders: data.allowedSenders ?? [],
        allowedSubjects: data.allowedSubjects ?? [],
        plan: data.plan ?? 'solo',
        memberLimit: data.memberLimit ?? null,
        memberCount: data.memberCount ?? 0,
        createdAt: data.createdAt?.toDate() ?? new Date(),
        updatedAt: data.updatedAt?.toDate() ?? new Date(),
      };
    } catch (error) {
      console.error(`Erro ao buscar tenant ${tenantId}:`, error);
      return null;
    }
  }

  async addMemberIfWithinLimit(tenantId: string, member: AddTenantMemberInput): Promise<void> {
    const tenantRef = this.db.collection('tenants').doc(tenantId);
    const memberRef = tenantRef.collection('members').doc(member.userId);

    await this.db.runTransaction(async (tx) => {
      const tenantSnap = await tx.get(tenantRef);
      if (!tenantSnap.exists) {
        throw notFound('@core.workspace/tenant.not-found');
      }
      const memberSnap = await tx.get(memberRef);
      if (memberSnap.exists) {
        throw alreadyExists('@core.tenant/member.already-member');
      }

      const data = tenantSnap.data()!;
      let count = data.memberCount as number | undefined;
      if (count === undefined) {
        // Tenant criado antes desta feature: usa a contagem real como baseline única.
        const agg = await tenantRef.collection('members').count().get();
        count = agg.data().count;
      }
      const limit = (data.memberLimit as number | null | undefined) ?? null;
      if (limit !== null && count >= limit) {
        throw new Error('MEMBER_LIMIT_REACHED');
      }

      tx.set(memberRef, {
        userId: member.userId,
        tenantId,
        roleIds: member.roleIds,
        displayName: member.displayName,
        email: member.email,
        photoURL: member.photoURL,
        addedAt: FieldValue.serverTimestamp(),
        addedBy: member.addedBy,
      });
      tx.update(tenantRef, { memberCount: count + 1, updatedAt: FieldValue.serverTimestamp() });
    });

    try {
      await this.db.collection('users').doc(member.userId).set(
        { tenantIds: FieldValue.arrayUnion(tenantId) },
        { merge: true },
      );
    } catch {
      // Non-critical: mesmo comportamento do client atual (getTenantsForUser tem fallback via collectionGroup).
    }
  }

  async removeMember(tenantId: string, userId: string, removedBy: string): Promise<void> {
    const tenantRef = this.db.collection('tenants').doc(tenantId);
    const memberRef = tenantRef.collection('members').doc(userId);

    // Stamp separado da transação: um único commit não pode ter update() e delete() no mesmo doc
    // (o segundo sobrescreveria o primeiro) — a trigger de auditoria lê este campo no snapshot "before".
    await memberRef.update({ deletedBy: removedBy }).catch(() => undefined);

    await this.db.runTransaction(async (tx) => {
      const tenantSnap = await tx.get(tenantRef);
      const memberSnap = await tx.get(memberRef);
      if (!memberSnap.exists) return;

      const count = (tenantSnap.data()?.memberCount as number | undefined) ?? 0;
      tx.delete(memberRef);
      if (tenantSnap.exists) {
        tx.update(tenantRef, { memberCount: Math.max(0, count - 1), updatedAt: FieldValue.serverTimestamp() });
      }
    });

    try {
      await this.db.collection('users').doc(userId).update({ tenantIds: FieldValue.arrayRemove(tenantId) });
    } catch {
      // Non-critical: mesma limitação de escrita cross-user do client atual.
    }
  }
}
