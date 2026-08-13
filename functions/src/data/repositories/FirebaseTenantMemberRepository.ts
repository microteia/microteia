import type { Firestore } from 'firebase-admin/firestore';
import type { ITenantMemberRepository, TenantMemberInfo } from '../../domain/repositories/ITenantMemberRepository';

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
}
