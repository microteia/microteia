import {
  collection,
  collectionGroup,
  deleteDoc,
  deleteField,
  doc,
  FieldPath,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { ref, uploadBytes } from 'firebase/storage';
import { db, functions, storage } from '../../infrastructure/firebase/config';
import type { IPortalRepository } from '../../domain/repositories/IPortalRepository';
import type {
  PortalContext,
  PortalDocument,
  PortalGuest,
  PortalIdentityInvite,
  PortalLinkOption,
  PortalMembership,
  PortalActionOutcome,
  PortalRecord,
  PortalRecordAction,
  PortalSignInSettingsView,
} from '../../domain/entities/Portal';
import { PORTAL_RECORDS_WINDOW } from '../../domain/entities/Portal';
import { PORTAL_IDENTITY_INVITES_COLLECTION } from '../../domain/schema/portalCollections';
import {
  PORTAL_CLAIM_NORMALIZERS,
  asPortalVerifiedIdentity,
  type PortalClaimNormalize,
  type PortalRequiredClaim,
  type PortalSignInOptions,
  type PortalSignInSettings,
} from '../../domain/schema/portalIdentity';
import {
  PORTAL_DOCUMENTS_SUBCOLLECTION,
  PORTAL_RECORDS_COLLECTION,
  PORTAL_REPROJECTIONS_COLLECTION,
  PORTAL_USERS_COLLECTION,
  portalUploadStagingPath,
} from '../../domain/schema/portal';
import { readPortalReprojectionState, type PortalReprojectionState } from '../../domain/schema/portalReprojection';
import { readPortalSubjectRoles } from '../../domain/schema/portalRole';
import { dateOf, mapPortalRecord, stringsOf, textOf } from './portalRecordMapping';
import { PORTAL_SETTINGS_DOC, asPortalHomeSettings, type PortalHomeSettings } from '../../domain/schema/portalExtensionPoints';
import {
  PORTAL_TEXTS_COLLECTION,
  asPortalTextOverride,
  portalTextDocId,
  type PortalTextOverride,
} from '../../domain/schema/portalText';
import { stampDeletionActor } from '../utils/stampDeletionActor';
import type { DeletionActor } from '../../domain/entities';

const PAGE_LIMIT = PORTAL_RECORDS_WINDOW;

export class FirebasePortalRepository implements IPortalRepository {
  async listMemberships(userId: string): Promise<PortalMembership[]> {
    const snapshot = await getDocs(query(collectionGroup(db, PORTAL_USERS_COLLECTION), where('userId', '==', userId)));
    return snapshot.docs
      .map((one) => ({
        tenantId: one.ref.parent.parent?.id ?? '',
        tenantName: textOf(one.get('tenantName')),
        ...(textOf(one.get('locale')) ? { locale: textOf(one.get('locale')) } : {}),
      }))
      .filter((membership) => membership.tenantId !== '')
      .sort((a, b) => a.tenantName.localeCompare(b.tenantName));
  }

  async getContext(tenantId: string, locale: string): Promise<PortalContext> {
    const call = httpsCallable<{ tenantId: string; locale: string }, PortalContext>(functions, 'getPortalContext');
    return (await call({ tenantId, locale })).data;
  }

  subscribeRecords(
    tenantId: string,
    userId: string,
    collectionName: string,
    onUpdate: (records: PortalRecord[]) => void,
    onError?: (error: Error) => void,
  ): () => void {
    // O filtro por `audience` não é otimização: é o que deixa a regra provar a consulta. Sem ele, o
    // Firestore recusa a lista inteira.
    return onSnapshot(
      query(
        collection(db, 'tenants', tenantId, PORTAL_RECORDS_COLLECTION),
        where('audience', 'array-contains', userId),
        where('collection', '==', collectionName),
        orderBy('updatedAt', 'desc'),
        limit(PAGE_LIMIT),
      ),
      (snapshot) => onUpdate(snapshot.docs.map((one) => mapPortalRecord(one.id, one.data()))),
      (error) => onError?.(error),
    );
  }

  subscribeChildren(
    tenantId: string,
    userId: string,
    collectionName: string,
    parentKey: string,
    max: number,
    onUpdate: (records: PortalRecord[]) => void,
    onError?: (error: Error) => void,
  ): () => void {
    return onSnapshot(
      query(
        collection(db, 'tenants', tenantId, PORTAL_RECORDS_COLLECTION),
        where('audience', 'array-contains', userId),
        where('collection', '==', collectionName),
        where('parentKey', '==', parentKey),
        orderBy('updatedAt', 'desc'),
        limit(max),
      ),
      (snapshot) => onUpdate(snapshot.docs.map((one) => mapPortalRecord(one.id, one.data()))),
      (error) => onError?.(error),
    );
  }

  async getDocuments(tenantId: string, projectionId: string): Promise<PortalDocument[]> {
    const snapshot = await getDocs(
      collection(db, 'tenants', tenantId, PORTAL_RECORDS_COLLECTION, projectionId, PORTAL_DOCUMENTS_SUBCOLLECTION),
    );
    return snapshot.docs
      .map((one) => {
        const data = one.data();
        return {
          id: one.id,
          name: textOf(data.name),
          type: textOf(data.type) || null,
          description: textOf(data.description) || null,
          createdAt: dateOf(data.createdAt),
          sha256: textOf(data.sha256) || null,
        };
      })
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  }

  async getDocumentUrl(tenantId: string, projectionId: string, documentId: string): Promise<string> {
    const call = httpsCallable<{ tenantId: string; projectionId: string; documentId: string }, { url: string }>(
      functions,
      'getPortalDocumentUrl',
    );
    return (await call({ tenantId, projectionId, documentId })).data.url;
  }

  async recordView(tenantId: string, projectionId: string): Promise<void> {
    const call = httpsCallable<{ tenantId: string; projectionId: string }, { recorded: boolean }>(functions, 'recordPortalView');
    await call({ tenantId, projectionId });
  }

  async listRecordActions(tenantId: string, projectionId: string, locale: string): Promise<PortalRecordAction[]> {
    const call = httpsCallable<{ tenantId: string; projectionId: string; locale: string }, { actions: PortalRecordAction[] }>(
      functions,
      'portalRecordActions',
    );
    return (await call({ tenantId, projectionId, locale })).data.actions;
  }

  async runRecordAction(tenantId: string, projectionId: string, actionId: string, locale: string): Promise<PortalActionOutcome> {
    const call = httpsCallable<
      { tenantId: string; projectionId: string; actionId: string; locale: string },
      PortalActionOutcome
    >(functions, 'portalRecordActions');
    return (await call({ tenantId, projectionId, actionId, locale })).data;
  }

  async uploadDocument(input: {
    tenantId: string;
    userId: string;
    collection: string;
    recordId: string;
    file: File;
    type: string;
  }): Promise<{ id: string }> {
    const uploadId = crypto.randomUUID();
    await uploadBytes(ref(storage, portalUploadStagingPath(input.tenantId, input.userId, uploadId)), input.file, {
      contentType: input.file.type || 'application/octet-stream',
    });
    const call = httpsCallable<
      { tenantId: string; collection: string; recordId: string; uploadId: string; name: string; type: string },
      { id: string }
    >(functions, 'attachPortalDocument');
    return (await call({
      tenantId: input.tenantId,
      collection: input.collection,
      recordId: input.recordId,
      uploadId,
      name: input.file.name,
      type: input.type,
    })).data;
  }

  async listLinkOptions(tenantId: string, userId: string, collectionName: string): Promise<PortalLinkOption[]> {
    const snapshot = await getDocs(query(
      collection(db, 'tenants', tenantId, PORTAL_RECORDS_COLLECTION),
      where('audience', 'array-contains', userId),
      where('collection', '==', collectionName),
      orderBy('updatedAt', 'desc'),
      limit(PAGE_LIMIT),
    ));
    return snapshot.docs.map((one) => {
      const record = mapPortalRecord(one.id, one.data());
      return { recordId: record.recordId, label: record.title || record.recordId };
    });
  }

  async submit(input: {
    tenantId: string;
    collection: string;
    linkRecordId: string;
    data: Record<string, unknown>;
    locale: string;
  }): Promise<{ id: string }> {
    const call = httpsCallable<typeof input, { id: string }>(functions, 'submitPortalRecord');
    return (await call(input)).data;
  }

  async listCreateTargets(input: { tenantId: string; collection: string; linkRecordIds: string[] }): Promise<string[]> {
    const call = httpsCallable<typeof input, { open: string[] }>(functions, 'submitPortalRecord');
    return (await call(input)).data.open;
  }

  async update(input: {
    tenantId: string;
    collection: string;
    recordId: string;
    data: Record<string, unknown>;
    locale: string;
  }): Promise<{ id: string }> {
    const call = httpsCallable<typeof input, { id: string }>(functions, 'submitPortalRecord');
    return (await call(input)).data;
  }

  async getHomeSettings(tenantId: string): Promise<PortalHomeSettings> {
    const snapshot = await getDoc(doc(db, 'tenants', tenantId, 'settings', PORTAL_SETTINGS_DOC));
    return asPortalHomeSettings(snapshot.data());
  }

  async saveHomeSettings(tenantId: string, settings: PortalHomeSettings): Promise<void> {
    await setDoc(doc(db, 'tenants', tenantId, 'settings', PORTAL_SETTINGS_DOC), settings);
  }

  async listPortalTexts(tenantId: string): Promise<PortalTextOverride[]> {
    const snapshot = await getDocs(query(collection(db, 'tenants', tenantId, PORTAL_TEXTS_COLLECTION), limit(PAGE_LIMIT)));
    return snapshot.docs.flatMap((entry) => {
      const override = asPortalTextOverride(entry.data());
      return override ? [override] : [];
    });
  }

  async savePortalText(
    tenantId: string,
    { ref: textRef, locale, text, actor }: { ref: string; locale: string; text: string; actor: DeletionActor },
  ): Promise<void> {
    await setDoc(this.portalTextDoc(tenantId, textRef), {
      ref: textRef,
      texts: { [locale]: text },
      updatedAt: serverTimestamp(),
      updatedBy: actor.uid,
      updatedByName: actor.name,
      updatedByPhotoURL: actor.photoURL,
    }, { merge: true });
  }

  async restorePortalText(
    tenantId: string,
    { ref: textRef, locale, actor }: { ref: string; locale: string; actor: DeletionActor },
  ): Promise<void> {
    const target = this.portalTextDoc(tenantId, textRef);
    const snapshot = await getDoc(target);
    if (!snapshot.exists()) return;
    const texts = (snapshot.data().texts ?? {}) as Record<string, unknown>;
    if (Object.keys(texts).some((other) => other !== locale)) {
      await updateDoc(
        target,
        new FieldPath('texts', locale), deleteField(),
        'updatedAt', serverTimestamp(),
        'updatedBy', actor.uid,
        'updatedByName', actor.name,
        'updatedByPhotoURL', actor.photoURL,
      );
      return;
    }
    await stampDeletionActor(target, actor);
    await deleteDoc(target);
  }

  private portalTextDoc(tenantId: string, textRef: string) {
    const id = portalTextDocId(textRef);
    if (!id) throw new Error(textRef);
    return doc(db, 'tenants', tenantId, PORTAL_TEXTS_COLLECTION, id);
  }

  subscribeGuests(
    tenantId: string,
    onUpdate: (guests: PortalGuest[]) => void,
    onError?: (error: Error) => void,
  ): () => void {
    return onSnapshot(
      collection(db, 'tenants', tenantId, PORTAL_USERS_COLLECTION),
      (snapshot) => onUpdate(
        snapshot.docs
          .map((one): PortalGuest => {
            const identity = asPortalVerifiedIdentity(one.get('identity'));
            return {
              userId: one.id,
              email: textOf(one.get('email')),
              displayName: textOf(one.get('displayName')),
              subjectKeys: stringsOf(one.get('subjectKeys')),
              subjectRoles: readPortalSubjectRoles(one.get('subjectRoles')),
              ...(identity ? { identity } : {}),
              ...(one.get('suspended') === true ? { suspended: true } : {}),
            };
          })
          .sort((a, b) => a.email.localeCompare(b.email)),
      ),
      (error) => onError?.(error),
    );
  }

  subscribeReprojections(
    tenantId: string,
    onUpdate: (states: Map<string, PortalReprojectionState>) => void,
  ): () => void {
    return onSnapshot(
      collection(db, 'tenants', tenantId, PORTAL_REPROJECTIONS_COLLECTION),
      (snapshot) => onUpdate(new Map(snapshot.docs.map((one) => [one.id, readPortalReprojectionState(one.data())]))),
      // O documento existe para AVISAR: uma leitura recusada não pode derrubar a aba.
      () => onUpdate(new Map()),
    );
  }

  async invite(
    tenantId: string,
    email: string,
    subjectKey: string,
    locale: string,
    requiredClaim?: PortalRequiredClaim,
    role?: string,
  ): Promise<{ userId: string; created: boolean; inviteId?: string }> {
    const call = httpsCallable<
      { tenantId: string; email: string; subjectKey: string; locale: string; requiredClaim?: PortalRequiredClaim; role?: string },
      { userId: string; created: boolean; inviteId?: string }
    >(functions, 'invitePortalUser');
    return (await call({ tenantId, email, subjectKey, locale, ...(requiredClaim ? { requiredClaim } : {}), ...(role ? { role } : {}) })).data;
  }

  async revoke(tenantId: string, guest: { userId: string } | { inviteId: string }, subjectKey: string | null): Promise<void> {
    const call = httpsCallable<
      { tenantId: string; userId?: string; inviteId?: string; subjectKey: string | null },
      { revoked: boolean }
    >(functions, 'revokePortalUser');
    await call({ tenantId, ...guest, subjectKey });
  }

  subscribeIdentityInvites(
    tenantId: string,
    onUpdate: (invites: PortalIdentityInvite[]) => void,
    onError?: (error: Error) => void,
  ): () => void {
    return onSnapshot(
      collection(db, 'tenants', tenantId, PORTAL_IDENTITY_INVITES_COLLECTION),
      (snapshot) => onUpdate(
        snapshot.docs
          .map((one): PortalIdentityInvite => {
            const claim = (one.get('claim') ?? {}) as Record<string, unknown>;
            const normalize = PORTAL_CLAIM_NORMALIZERS.find((mode) => mode === claim.normalize) as PortalClaimNormalize | undefined;
            return {
              id: one.id,
              email: textOf(one.get('email')),
              displayName: textOf(one.get('displayName')),
              claim: { name: textOf(claim.name), value: textOf(claim.value), ...(normalize ? { normalize } : {}) },
              subjectKeys: stringsOf(one.get('subjectKeys')),
              subjectRoles: readPortalSubjectRoles(one.get('subjectRoles')),
              accepted: stringsOf(one.get('boundUserIds')).length > 0,
            };
          })
          .sort((a, b) => a.email.localeCompare(b.email)),
      ),
      (error) => onError?.(error),
    );
  }

  async getSignInSettings(tenantId: string): Promise<PortalSignInSettingsView> {
    const call = httpsCallable<{ tenantId: string; op: 'get' }, PortalSignInSettingsView>(functions, 'managePortalSignIn');
    return (await call({ tenantId, op: 'get' })).data;
  }

  async saveSignInSettings(
    tenantId: string,
    settings: PortalSignInSettings,
    secrets: Record<string, string | null>,
  ): Promise<PortalSignInSettingsView> {
    const call = httpsCallable<
      { tenantId: string; op: 'save'; settings: PortalSignInSettings; secrets: Record<string, string | null> },
      PortalSignInSettingsView
    >(functions, 'managePortalSignIn');
    return (await call({ tenantId, op: 'save', settings, secrets })).data;
  }

  async getSignInOptions(tenantId: string): Promise<PortalSignInOptions> {
    const call = httpsCallable<{ tenantId: string }, PortalSignInOptions>(functions, 'getPortalSignInOptions');
    return (await call({ tenantId })).data;
  }

  async startSignIn(input: Parameters<IPortalRepository['startSignIn']>[0]): Promise<{ url: string; state: string }> {
    const call = httpsCallable<typeof input, { url: string; state: string }>(functions, 'startPortalSignIn');
    return (await call(input)).data;
  }

  async completeSignIn(state: string, code: string): Promise<{ token: string; tenantId: string; next: string | null }> {
    const call = httpsCallable<{ state: string; code: string }, { token: string; tenantId: string; next: string | null }>(
      functions,
      'completePortalSignIn',
    );
    return (await call({ state, code })).data;
  }
}
