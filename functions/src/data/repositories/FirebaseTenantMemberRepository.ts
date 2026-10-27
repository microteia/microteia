import type { DocumentSnapshot, Firestore } from 'firebase-admin/firestore';
import type { ITenantMemberRepository, MemberAccess, TenantMemberInfo } from '../../domain/repositories/ITenantMemberRepository';
import { memberMfaRequirementFrom } from '../../domain/schema/memberMfa';

const stringsOf = (value: unknown): string[] =>
  (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);

const accessOf = (snap: DocumentSnapshot): MemberAccess => {
  const data = snap.data() ?? {};
  return {
    userId: typeof data.userId === 'string' ? data.userId : snap.id,
    displayName: typeof data.displayName === 'string' ? data.displayName : '',
    email: typeof data.email === 'string' ? data.email : '',
    roleIds: stringsOf(data.roleIds),
    permissions: stringsOf(data.permissions),
    mfa: memberMfaRequirementFrom(data.mfa),
  };
};

export class FirebaseTenantMemberRepository implements ITenantMemberRepository {
  constructor(private readonly db: Firestore) {}

  async isMember(tenantId: string, userId: string): Promise<boolean> {
    const memberSnap = await this.db
      .collection('tenants')
      .doc(tenantId)
      .collection('members')
      .doc(userId)
      .get();

    return memberSnap.exists;
  }

  async getMemberRole(tenantId: string, userId: string): Promise<string | null> {
    const memberSnap = await this.db
      .collection('tenants')
      .doc(tenantId)
      .collection('members')
      .doc(userId)
      .get();

    if (!memberSnap.exists) {
      return null;
    }

    const data = memberSnap.data() as { role?: string };
    return data.role ?? null;
  }

  async getMemberPermissions(tenantId: string, userId: string): Promise<string[]> {
    const memberSnap = await this.db
      .collection('tenants')
      .doc(tenantId)
      .collection('members')
      .doc(userId)
      .get();

    const permissions = memberSnap.data()?.permissions;
    return Array.isArray(permissions) ? (permissions as string[]) : [];
  }

  async getMemberCatalogStamp(tenantId: string, userId: string): Promise<string | null> {
    const memberSnap = await this.db
      .collection('tenants')
      .doc(tenantId)
      .collection('members')
      .doc(userId)
      .get();

    const stamp = memberSnap.data()?.permissionsCatalog;
    return typeof stamp === 'string' ? stamp : null;
  }

  async getMember(tenantId: string, userId: string): Promise<TenantMemberInfo | null> {
    const memberSnap = await this.db
      .collection('tenants')
      .doc(tenantId)
      .collection('members')
      .doc(userId)
      .get();

    if (!memberSnap.exists) {
      return null;
    }

    const data = memberSnap.data() as { role?: string; displayName?: string };
    return { role: data.role ?? null, displayName: data.displayName ?? '' };
  }

  async getMemberAccess(tenantId: string, userId: string): Promise<MemberAccess | null> {
    const memberSnap = await this.db.doc(`tenants/${tenantId}/members/${userId}`).get();
    return memberSnap.exists ? accessOf(memberSnap) : null;
  }

  async listMemberAccess(tenantId: string): Promise<MemberAccess[]> {
    const snap = await this.db.collection(`tenants/${tenantId}/members`).get();
    return snap.docs.map(accessOf);
  }
}
