import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { DocumentData, Firestore } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';
import type { IMfaFactorRepository, MfaFactor, MfaFactorChange } from '../../domain/repositories/IMfaFactorRepository';
import type { IMemberMfaPolicyRepository, IMfaSessionMinter } from '../../domain/repositories/IMemberMfaPolicyRepository';
import type { MemberMfaPolicy } from '../../domain/schema/memberMfa';
import {
  MEMBER_MFA_POLICY_COLLECTION,
  MFA_FACTOR_COLLECTION,
  MFA_SESSION_CLAIM,
  memberMfaPolicyOf,
} from '../../domain/schema/memberMfa';

const dateOf = (value: unknown): Date | null => (value instanceof Timestamp ? value.toDate() : null);

const factorOf = (data: DocumentData): MfaFactor => {
  const pending = data.pending as { secret?: unknown; expiresAt?: unknown } | null | undefined;
  const pendingExpiresAt = dateOf(pending?.expiresAt);
  return {
    secret: typeof data.secret === 'string' ? data.secret : null,
    enrolledAt: dateOf(data.enrolledAt),
    pending: typeof pending?.secret === 'string' && pendingExpiresAt ? { secret: pending.secret, expiresAt: pendingExpiresAt } : null,
    recoveryCodes: Array.isArray(data.recoveryCodes) ? data.recoveryCodes.filter((item): item is string => typeof item === 'string') : [],
    lastStep: typeof data.lastStep === 'number' ? data.lastStep : null,
    failures: typeof data.failures === 'number' ? data.failures : 0,
    lockedUntil: dateOf(data.lockedUntil),
    lastVerifiedAt: dateOf(data.lastVerifiedAt),
  };
};

const timestampOrNull = (value: Date | null): Timestamp | null => (value ? Timestamp.fromDate(value) : null);

const documentOf = (factor: MfaFactor): DocumentData => ({
  secret: factor.secret,
  enrolledAt: timestampOrNull(factor.enrolledAt),
  pending: factor.pending ? { secret: factor.pending.secret, expiresAt: Timestamp.fromDate(factor.pending.expiresAt) } : null,
  recoveryCodes: factor.recoveryCodes,
  lastStep: factor.lastStep,
  failures: factor.failures,
  lockedUntil: timestampOrNull(factor.lockedUntil),
  lastVerifiedAt: timestampOrNull(factor.lastVerifiedAt),
  updatedAt: FieldValue.serverTimestamp(),
});

/** `mfaFactors/{uid}` — fechado a todo cliente no `firestore.rules`; só o Admin SDK o lê. */
export class FirestoreMfaFactorRepository implements IMfaFactorRepository {
  constructor(private readonly db: Firestore) {}

  private ref(userId: string) {
    return this.db.collection(MFA_FACTOR_COLLECTION).doc(userId);
  }

  async get(userId: string): Promise<MfaFactor | null> {
    const snap = await this.ref(userId).get();
    return snap.exists ? factorOf(snap.data() ?? {}) : null;
  }

  async getMany(userIds: string[]): Promise<Map<string, MfaFactor>> {
    const found = new Map<string, MfaFactor>();
    if (userIds.length === 0) return found;
    const snaps = await this.db.getAll(...userIds.map((userId) => this.ref(userId)));
    for (const snap of snaps) if (snap.exists) found.set(snap.id, factorOf(snap.data() ?? {}));
    return found;
  }

  async update<T>(userId: string, change: (current: MfaFactor | null) => MfaFactorChange<T>): Promise<T> {
    const ref = this.ref(userId);
    return this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const { next, result } = change(snap.exists ? factorOf(snap.data() ?? {}) : null);
      if (next === null) tx.delete(ref);
      else if (next !== undefined) tx.set(ref, documentOf(next));
      return result;
    });
  }

  async remove(userId: string): Promise<boolean> {
    const ref = this.ref(userId);
    return this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return false;
      tx.delete(ref);
      return true;
    });
  }
}

/** `memberMfaPolicies/{tenantId}` — `write: false` nas regras; a callable `manageMemberMfa` é a porta. */
export class FirestoreMemberMfaPolicyRepository implements IMemberMfaPolicyRepository {
  constructor(private readonly db: Firestore) {}

  async get(tenantId: string): Promise<MemberMfaPolicy> {
    const snap = await this.db.collection(MEMBER_MFA_POLICY_COLLECTION).doc(tenantId).get();
    return memberMfaPolicyOf(snap.data());
  }

  async save(tenantId: string, policy: MemberMfaPolicy, authorId: string): Promise<void> {
    await this.db.collection(MEMBER_MFA_POLICY_COLLECTION).doc(tenantId).set({
      ...policy,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: authorId,
    });
  }
}

/**
 * A sessão que carrega a prova. `createCustomToken` assina com a conta de serviço das functions — o mesmo
 * requisito da entrada do portal por provedor de identidade (`iam.serviceAccounts.signBlob`). A claim
 * vai no TOKEN, e não no usuário: vale só para a sessão que provou o fator.
 */
export class FirebaseMfaSessionMinter implements IMfaSessionMinter {
  constructor(private readonly auth: Auth) {}

  async mint(userId: string, verifiedAt: number): Promise<string> {
    return this.auth.createCustomToken(userId, { [MFA_SESSION_CLAIM]: verifiedAt });
  }
}
