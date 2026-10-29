import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { DocumentData, Firestore } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';
import type {
  IPortalIdentityAccountService,
  IPortalIdentityConfigRepository,
  IPortalIdentityRepository,
  IPortalSignInRequestRepository,
  PortalIdentityConfig,
  PortalIdentityInvite,
  PortalIdentityProof,
  PortalSignInRequest,
} from '../../domain/repositories/IPortalIdentity';
import {
  PORTAL_IDENTITY_INVITES_COLLECTION,
  PORTAL_IDENTITY_PROOFS_COLLECTION,
  PORTAL_SIGN_IN_REQUESTS_COLLECTION,
  PORTAL_USERS_COLLECTION,
} from '../../domain/schema/portalCollections';
import {
  PORTAL_CLAIM_NORMALIZERS,
  PORTAL_IDENTITY_SECRET_ID,
  asPortalSignInSettings,
  portalClaimKey,
  type PortalClaimNormalize,
} from '../../domain/schema/portalIdentity';

const IN_CHUNK = 30;
const BATCH_SIZE = 400;

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');
const asStrings = (value: unknown): string[] =>
  (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);

const toInvite = (id: string, data: DocumentData): PortalIdentityInvite => {
  const claim = (data.claim ?? {}) as Record<string, unknown>;
  const normalize = PORTAL_CLAIM_NORMALIZERS.includes(claim.normalize as PortalClaimNormalize)
    ? (claim.normalize as PortalClaimNormalize)
    : undefined;
  return {
    id,
    email: asString(data.email),
    displayName: asString(data.displayName),
    claim: { name: asString(claim.name), value: asString(claim.value), ...(normalize ? { normalize } : {}) },
    subjectKeys: asStrings(data.subjectKeys),
    boundUserIds: asStrings(data.boundUserIds),
    invitedBy: asString(data.invitedBy),
    ...(asString(data.locale) ? { locale: asString(data.locale) } : {}),
  };
};

const toProof = (id: string, data: DocumentData): PortalIdentityProof => ({
  userId: id,
  provider: asString(data.provider),
  subject: asString(data.subject),
  level: typeof data.level === 'string' ? data.level : null,
  displayName: asString(data.displayName),
  proofKeys: asStrings(data.proofKeys),
  verifiedAt: data.verifiedAt instanceof Timestamp ? data.verifiedAt.toDate() : new Date(0),
});

/**
 * Os convites por identidade e o acesso de quem os aceitou. Os dois lados ficam sob o escritório:
 * `portalIdentityInvites` (o que a pessoa precisa provar e a que sujeitos dá acesso) e o convite
 * comum, `portalUsers/{uid}`, que é o que as regras e as callables leem — por isso o login grava ali
 * a SOMA dos convites satisfeitos, e toda mudança num convite aceito refaz essa soma.
 */
export class FirebasePortalIdentityRepository implements IPortalIdentityRepository {
  constructor(private readonly db: Firestore) {}

  private invites(tenantId: string) {
    return this.db.collection('tenants').doc(tenantId).collection(PORTAL_IDENTITY_INVITES_COLLECTION);
  }

  private portalUsers(tenantId: string) {
    return this.db.collection('tenants').doc(tenantId).collection(PORTAL_USERS_COLLECTION);
  }

  /** Na raiz e pelo uid, que já é do escritório (`portalIdentityAccountId`); o `tenantId` é conferido na leitura. */
  private proofs() {
    return this.db.collection(PORTAL_IDENTITY_PROOFS_COLLECTION);
  }

  async findInvitesByClaimKeys(tenantId: string, claimKeys: string[]): Promise<PortalIdentityInvite[]> {
    const found = new Map<string, PortalIdentityInvite>();
    for (let index = 0; index < claimKeys.length; index += IN_CHUNK) {
      const snapshot = await this.invites(tenantId).where('claimKey', 'in', claimKeys.slice(index, index + IN_CHUNK)).get();
      snapshot.docs.forEach((doc) => found.set(doc.id, toInvite(doc.id, doc.data())));
    }
    return [...found.values()];
  }

  async getInvite(tenantId: string, inviteId: string): Promise<PortalIdentityInvite | null> {
    const snapshot = await this.invites(tenantId).doc(inviteId).get();
    return snapshot.exists ? toInvite(snapshot.id, snapshot.data() ?? {}) : null;
  }

  async invitesBoundTo(tenantId: string, userId: string): Promise<PortalIdentityInvite[]> {
    const snapshot = await this.invites(tenantId).where('boundUserIds', 'array-contains', userId).get();
    return snapshot.docs.map((doc) => toInvite(doc.id, doc.data()));
  }

  async invitesByEmail(tenantId: string, email: string): Promise<PortalIdentityInvite[]> {
    const snapshot = await this.invites(tenantId).where('email', '==', email).get();
    return snapshot.docs.map((doc) => toInvite(doc.id, doc.data()));
  }

  async grantInvite(
    tenantId: string,
    grant: Parameters<IPortalIdentityRepository['grantInvite']>[1],
    subjectKey: string,
  ): Promise<{ invite: PortalIdentityInvite; granted: boolean }> {
    const claimKey = portalClaimKey(grant.claim.name, grant.claim.value);
    return this.db.runTransaction(async (transaction) => {
      const existing = await transaction.get(this.invites(tenantId).where('claimKey', '==', claimKey).limit(1));
      if (!existing.empty) {
        const doc = existing.docs[0];
        const invite = toInvite(doc.id, doc.data());
        const granted = !invite.subjectKeys.includes(subjectKey);
        if (granted) {
          transaction.update(doc.ref, { subjectKeys: FieldValue.arrayUnion(subjectKey), updatedAt: FieldValue.serverTimestamp() });
        }
        return { invite: { ...invite, subjectKeys: granted ? [...invite.subjectKeys, subjectKey] : invite.subjectKeys }, granted };
      }
      const reference = this.invites(tenantId).doc();
      const data = {
        tenantId,
        email: grant.email,
        displayName: grant.displayName,
        claim: grant.claim,
        claimKey,
        subjectKeys: [subjectKey],
        boundUserIds: [],
        invitedBy: grant.invitedBy,
        ...(grant.locale ? { locale: grant.locale } : {}),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      transaction.set(reference, data);
      return { invite: toInvite(reference.id, data), granted: true };
    });
  }

  async revokeInvite(tenantId: string, inviteId: string, subjectKey: string | null): Promise<boolean> {
    const reference = this.invites(tenantId).doc(inviteId);
    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) return false;
      const current = asStrings(snapshot.get('subjectKeys'));
      const remaining = subjectKey === null ? [] : current.filter((key) => key !== subjectKey);
      if (subjectKey !== null && remaining.length === current.length) return false;
      if (remaining.length === 0) transaction.delete(reference);
      else transaction.update(reference, { subjectKeys: remaining, updatedAt: FieldValue.serverTimestamp() });
      return true;
    });
  }

  async bind(
    tenantId: string,
    binding: Parameters<IPortalIdentityRepository['bind']>[1],
    matched: PortalIdentityInvite[],
  ): Promise<void> {
    const batch = this.db.batch();
    const ids = new Set(matched.map((invite) => invite.id));
    for (const invite of matched) {
      batch.update(this.invites(tenantId).doc(invite.id), { boundUserIds: FieldValue.arrayUnion(binding.userId) });
    }
    for (const stale of await this.invitesBoundTo(tenantId, binding.userId)) {
      if (!ids.has(stale.id)) batch.update(this.invites(tenantId).doc(stale.id), { boundUserIds: FieldValue.arrayRemove(binding.userId) });
    }
    const proof = this.proofs().doc(binding.userId);
    if (binding.proofKeys.length === 0) {
      batch.delete(proof);
    } else {
      batch.set(proof, {
        tenantId,
        provider: binding.verified.provider,
        subject: binding.subject,
        level: binding.verified.level,
        displayName: binding.displayName,
        proofKeys: binding.proofKeys,
        verifiedAt: FieldValue.serverTimestamp(),
      });
    }
    const membership = this.portalUsers(tenantId).doc(binding.userId);
    const subjectKeys = [...new Set(matched.flatMap((invite) => invite.subjectKeys))].sort();
    if (subjectKeys.length === 0) {
      batch.delete(membership);
    } else {
      const exists = (await membership.get()).exists;
      batch.set(membership, {
        userId: binding.userId,
        email: binding.email,
        displayName: binding.displayName,
        tenantId,
        tenantName: binding.tenantName,
        subjectKeys,
        invitedBy: binding.invitedBy,
        ...(binding.locale ? { locale: binding.locale } : {}),
        identity: { ...binding.verified, subject: binding.subject, verifiedAt: FieldValue.serverTimestamp() },
        suspended: FieldValue.delete(),
        ...(exists ? {} : { addedAt: FieldValue.serverTimestamp() }),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    await batch.commit();
  }

  async proofOf(tenantId: string, userId: string): Promise<PortalIdentityProof | null> {
    const snapshot = await this.proofs().doc(userId).get();
    return snapshot.exists && snapshot.get('tenantId') === tenantId ? toProof(snapshot.id, snapshot.data() ?? {}) : null;
  }

  async proofsFor(tenantId: string, proofKey: string): Promise<PortalIdentityProof[]> {
    const snapshot = await this.proofs().where('proofKeys', 'array-contains', proofKey).get();
    return snapshot.docs.filter((doc) => doc.get('tenantId') === tenantId).map((doc) => toProof(doc.id, doc.data()));
  }

  /**
   * Numa transação, e a partir do convite LIDO nela: o convite revogado entre o convite refeito e
   * aqui não religa ninguém, e os sujeitos gravados são a soma dos convites da conta, como no `bind`.
   */
  async rebind(tenantId: string, invite: PortalIdentityInvite, proof: PortalIdentityProof, tenantName: string): Promise<void> {
    const inviteRef = this.invites(tenantId).doc(invite.id);
    const membership = this.portalUsers(tenantId).doc(proof.userId);
    await this.db.runTransaction(async (transaction) => {
      const current = await transaction.get(inviteRef);
      if (!current.exists) return;
      const bound = await transaction.get(this.invites(tenantId).where('boundUserIds', 'array-contains', proof.userId));
      const existing = await transaction.get(membership);
      const subjectKeys = [...new Set([
        ...asStrings(current.get('subjectKeys')),
        ...bound.docs.flatMap((doc) => asStrings(doc.get('subjectKeys'))),
      ])].sort();
      transaction.update(inviteRef, { boundUserIds: FieldValue.arrayUnion(proof.userId), updatedAt: FieldValue.serverTimestamp() });
      if (existing.exists) {
        transaction.update(membership, { subjectKeys, updatedAt: FieldValue.serverTimestamp() });
        return;
      }
      const stored = toInvite(current.id, current.data() ?? {});
      transaction.set(membership, {
        userId: proof.userId,
        email: stored.email,
        displayName: proof.displayName || stored.displayName,
        tenantId,
        tenantName,
        subjectKeys,
        invitedBy: stored.invitedBy,
        ...(stored.locale ? { locale: stored.locale } : {}),
        identity: {
          provider: proof.provider,
          claim: { name: stored.claim.name, value: stored.claim.value },
          level: proof.level,
          subject: proof.subject,
          verifiedAt: Timestamp.fromDate(proof.verifiedAt),
        },
        addedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
  }

  async syncAccount(tenantId: string, userId: string): Promise<void> {
    const subjectKeys = [...new Set((await this.invitesBoundTo(tenantId, userId)).flatMap((invite) => invite.subjectKeys))].sort();
    const membership = this.portalUsers(tenantId).doc(userId);
    await this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(membership);
      if (!snapshot.exists) return;
      if (subjectKeys.length === 0) transaction.delete(membership);
      else transaction.update(membership, { subjectKeys, updatedAt: FieldValue.serverTimestamp() });
    });
  }

  /**
   * Varre os convites do escritório e muda só os de quem entra pelo link de e-mail (sem `identity`).
   * Em lotes: um escritório com milhares de convidados não cabe numa escrita só.
   */
  async setEmailGuestsSuspended(tenantId: string, suspended: boolean): Promise<number> {
    const snapshot = await this.portalUsers(tenantId).get();
    const targets = snapshot.docs.filter((doc) => !doc.get('identity') && (doc.get('suspended') === true) !== suspended);
    for (let index = 0; index < targets.length; index += BATCH_SIZE) {
      const batch = this.db.batch();
      for (const doc of targets.slice(index, index + BATCH_SIZE)) {
        batch.update(doc.ref, { suspended: suspended ? true : FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() });
      }
      await batch.commit();
    }
    return targets.length;
  }
}

/**
 * O pedido de entrada, na RAIZ, pelo hash do `state`: a volta do provedor só traz o `state`, e é com
 * ele que o pedido é achado. O documento é APAGADO ao ser gasto — numa transação, para que duas voltas
 * com o mesmo `state` não passem as duas. O que nunca volta fica com `expiresAt`, o campo de uma
 * política de TTL do Firestore.
 */
export class FirebasePortalSignInRequestRepository implements IPortalSignInRequestRepository {
  constructor(private readonly db: Firestore) {}

  private reference(stateHash: string) {
    return this.db.collection(PORTAL_SIGN_IN_REQUESTS_COLLECTION).doc(stateHash);
  }

  async save(stateHash: string, request: PortalSignInRequest): Promise<void> {
    await this.reference(stateHash).set({
      ...request,
      expiresAt: Timestamp.fromDate(request.expiresAt),
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  async consume(stateHash: string, now: Date): Promise<PortalSignInRequest | null> {
    const reference = this.reference(stateHash);
    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) return null;
      transaction.delete(reference);
      const data = snapshot.data() ?? {};
      const expiresAt = data.expiresAt instanceof Timestamp ? data.expiresAt.toDate() : new Date(0);
      if (expiresAt.getTime() <= now.getTime()) return null;
      return {
        tenantId: asString(data.tenantId),
        providerId: asString(data.providerId),
        redirectUri: asString(data.redirectUri),
        codeVerifier: asString(data.codeVerifier),
        nonce: asString(data.nonce),
        next: asString(data.next) || null,
        inviteId: asString(data.inviteId) || null,
        expiresAt,
      };
    });
  }
}

/**
 * A configuração de entrada do portal: `tenants/{t}/secrets/portal-identity`. `secrets` é reservada e
 * nenhuma regra a libera — o navegador não lê nem grava; a callable `managePortalSignIn` é a porta.
 */
export class FirebasePortalIdentityConfigRepository implements IPortalIdentityConfigRepository {
  constructor(private readonly db: Firestore) {}

  private reference(tenantId: string) {
    return this.db.collection('tenants').doc(tenantId).collection('secrets').doc(PORTAL_IDENTITY_SECRET_ID);
  }

  async get(tenantId: string): Promise<PortalIdentityConfig> {
    const data = (await this.reference(tenantId).get()).data() ?? {};
    const raw = typeof data.secrets === 'object' && data.secrets !== null ? (data.secrets as Record<string, unknown>) : {};
    const secrets = Object.fromEntries(Object.entries(raw).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
    return { settings: asPortalSignInSettings(data), secrets };
  }

  async save(tenantId: string, config: PortalIdentityConfig, userId: string): Promise<void> {
    await this.reference(tenantId).set({
      emailLink: config.settings.emailLink,
      providers: config.settings.providers,
      secrets: config.secrets,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: userId,
    });
  }
}

/**
 * A conta de quem entra por um provedor, e o token que abre a sessão dela. `createCustomToken` assina
 * com a conta de serviço das functions: sem a permissão `iam.serviceAccounts.signBlob` sobre ela, a
 * entrada falha aqui — e o log diz isso, em vez de o convidado ver só "não foi possível entrar".
 */
export class FirebasePortalIdentityAccountService implements IPortalIdentityAccountService {
  constructor(private readonly auth: Auth) {}

  async ensureAccount(userId: string, displayName: string): Promise<void> {
    try {
      await this.auth.createUser({ uid: userId, ...(displayName ? { displayName: displayName.slice(0, 120) } : {}) });
    } catch (error) {
      if ((error as { code?: string }).code !== 'auth/uid-already-exists') throw error;
    }
  }

  async signInToken(userId: string): Promise<string> {
    return this.auth.createCustomToken(userId);
  }
}
