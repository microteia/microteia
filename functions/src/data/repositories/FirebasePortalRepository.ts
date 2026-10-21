import { FieldPath, FieldValue } from 'firebase-admin/firestore';
import type { DocumentData, Firestore, Query } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';
import type {
  IPortalAccountService,
  IPortalRepository,
  PortalDocumentProjection,
  PortalProjection,
  PortalScreen,
  PortalUserGrant,
  PortalUserRecord,
  ProjectionPage,
  RecordPage,
  SharedRecordDocument,
} from '../../domain/repositories/IPortalRepository';
import {
  PORTAL_DOCUMENTS_SUBCOLLECTION,
  PORTAL_INVITES_COLLECTION,
  PORTAL_RECORDS_COLLECTION,
  PORTAL_USERS_COLLECTION,
  asPortalDeclaration,
  portalUploadStagingPath,
} from '../../domain/schema/portal';
import { getBucket } from '../../infrastructure/firebase/initFirebase';
import { PORTAL_SETTINGS_DOC, asPortalHomeSettings, type PortalHomeSettings } from '../../domain/schema/portalExtensionPoints';

const SCREENS_TTL_MS = 30_000;
/** O teto do `array-contains-any` do Firestore. */
const ANY_CHUNK = 30;
const BATCH_LIMIT = 400;

const asString = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);
const asStrings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const toScreen = (id: string, data: DocumentData): PortalScreen => ({
  id,
  collection: asString(data.dataCollection) || id,
  titleFieldKey: asString(data.titleFieldKey) || null,
  titleSingular: asString(data.titleSingular, id),
  titlePlural: asString(data.titlePlural, id),
  icon: asString(data.icon),
  parentEntity: asString(data.parentEntity) || null,
  parentFieldKey: asString(data.parentFieldKey) || null,
  portal: asPortalDeclaration(data.portal),
  fields: (Array.isArray(data.fields) ? data.fields as DocumentData[] : [])
    .filter((field) => typeof field?.key === 'string')
    .map((field) => ({
      key: field.key as string,
      label: asString(field.label, field.key as string),
      type: asString(field.type) || undefined,
      refEntity: asString(field.refEntity) || null,
      multi: field.multi === true,
      required: field.required === true,
      ...(field.defaultValue !== undefined ? { defaultValue: field.defaultValue } : {}),
      ...(Array.isArray(field.options)
        ? {
          options: (field.options as DocumentData[])
            .filter((option) => typeof option?.key === 'string')
            .map((option) => ({ key: option.key as string, label: asString(option.label, option.key as string) })),
        }
        : {}),
    })),
});

const toProjection = (data: DocumentData): PortalProjection => ({
  collection: asString(data.collection),
  recordId: asString(data.recordId),
  screenId: asString(data.screenId),
  subjectKeys: asStrings(data.subjectKeys),
  audience: asStrings(data.audience),
  title: asString(data.title),
  data: (data.data as Record<string, unknown> | undefined) ?? {},
  labels: (data.labels as Record<string, string> | undefined) ?? {},
  parentKeys: asStrings(data.parentKeys),
  parentKey: asString(data.parentKey),
  editable: data.editable === true,
  portalOwner: asString(data.portalOwner) || null,
});

const toSharedDocument = (id: string, data: DocumentData): SharedRecordDocument => ({
  id,
  name: asString(data.name),
  type: asString(data.type) || null,
  description: asString(data.description) || null,
  createdAt: data.createdAt ?? null,
  url: asString(data.url),
});

export class FirebasePortalRepository implements IPortalRepository {
  private readonly screens = new Map<string, { screens: PortalScreen[]; loadedAt: number }>();

  constructor(private readonly db: Firestore) {}

  private tenant(tenantId: string) {
    return this.db.collection('tenants').doc(tenantId);
  }

  private projections(tenantId: string) {
    return this.tenant(tenantId).collection(PORTAL_RECORDS_COLLECTION);
  }

  private portalUsers(tenantId: string) {
    return this.tenant(tenantId).collection(PORTAL_USERS_COLLECTION);
  }

  async getHomeSettings(tenantId: string): Promise<PortalHomeSettings> {
    const snapshot = await this.tenant(tenantId).collection('settings').doc(PORTAL_SETTINGS_DOC).get();
    return asPortalHomeSettings(snapshot.data());
  }

  async getScreens(tenantId: string, options?: { fresh?: boolean }): Promise<PortalScreen[]> {
    const cached = this.screens.get(tenantId);
    if (!options?.fresh && cached && Date.now() - cached.loadedAt < SCREENS_TTL_MS) return cached.screens;
    const snapshot = await this.tenant(tenantId).collection('screenDefinitions').get();
    const screens = snapshot.docs.map((doc) => toScreen(doc.id, doc.data()));
    this.screens.set(tenantId, { screens, loadedAt: Date.now() });
    return screens;
  }

  async getRecord(tenantId: string, collection: string, recordId: string) {
    const snapshot = await this.tenant(tenantId).collection(collection).doc(recordId).get();
    return snapshot.exists ? snapshot.data() : undefined;
  }

  async getRecordsReferencing(tenantId: string, collection: string, fieldKey: string, recordId: string, multi: boolean) {
    const snapshot = await this.tenant(tenantId).collection(collection)
      .where(fieldKey, multi ? 'array-contains' : '==', recordId)
      .get();
    return snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
  }

  async listRecords(tenantId: string, collection: string, after: string | null, pageSize: number): Promise<RecordPage> {
    let query: Query = this.tenant(tenantId).collection(collection).orderBy(FieldPath.documentId()).limit(pageSize);
    if (after) query = query.startAfter(after);
    const snapshot = await query.get();
    return {
      items: snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() })),
      next: snapshot.size === pageSize ? snapshot.docs[snapshot.size - 1].id : null,
    };
  }

  async audienceFor(tenantId: string, subjectKeys: string[]): Promise<string[]> {
    const audience = new Set<string>();
    for (let index = 0; index < subjectKeys.length; index += ANY_CHUNK) {
      const snapshot = await this.portalUsers(tenantId)
        .where('subjectKeys', 'array-contains-any', subjectKeys.slice(index, index + ANY_CHUNK))
        .get();
      snapshot.docs.forEach((doc) => audience.add(doc.id));
    }
    return [...audience].sort();
  }

  async getProjection(tenantId: string, projectionId: string): Promise<PortalProjection | null> {
    const snapshot = await this.projections(tenantId).doc(projectionId).get();
    return snapshot.exists ? toProjection(snapshot.data() ?? {}) : null;
  }

  async writeProjection(tenantId: string, projectionId: string, projection: PortalProjection): Promise<void> {
    await this.projections(tenantId).doc(projectionId).set({ ...projection, updatedAt: FieldValue.serverTimestamp() });
  }

  async deleteProjection(tenantId: string, projectionId: string): Promise<void> {
    const reference = this.projections(tenantId).doc(projectionId);
    await this.db.recursiveDelete(reference);
  }

  async clearDocumentProjections(tenantId: string, projectionId: string): Promise<void> {
    await this.db.recursiveDelete(this.projections(tenantId).doc(projectionId).collection(PORTAL_DOCUMENTS_SUBCOLLECTION));
  }

  private async page(query: Query, after: string | null, pageSize: number): Promise<ProjectionPage> {
    let ordered = query.orderBy(FieldPath.documentId()).limit(pageSize);
    if (after) ordered = ordered.startAfter(after);
    const snapshot = await ordered.get();
    return {
      items: snapshot.docs.map((doc) => ({
        id: doc.id,
        subjectKeys: asStrings(doc.get('subjectKeys')),
        audience: asStrings(doc.get('audience')),
      })),
      next: snapshot.size === pageSize ? snapshot.docs[snapshot.size - 1].id : null,
    };
  }

  projectionsForSubject(tenantId: string, subjectKey: string, after: string | null, pageSize: number) {
    return this.page(this.projections(tenantId).where('subjectKeys', 'array-contains', subjectKey), after, pageSize);
  }

  projectionsOfCollection(tenantId: string, collection: string, after: string | null, pageSize: number) {
    return this.page(this.projections(tenantId).where('collection', '==', collection), after, pageSize);
  }

  async setAudiences(tenantId: string, changes: Array<{ projectionId: string; audience: string[] }>): Promise<void> {
    for (let index = 0; index < changes.length; index += BATCH_LIMIT) {
      const batch = this.db.batch();
      for (const change of changes.slice(index, index + BATCH_LIMIT)) {
        batch.update(this.projections(tenantId).doc(change.projectionId), {
          audience: change.audience,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
    }
  }

  async sharedDocuments(tenantId: string, collection: string, recordId: string): Promise<SharedRecordDocument[]> {
    const snapshot = await this.tenant(tenantId).collection(collection).doc(recordId)
      .collection('documents').where('portalShared', '==', true).get();
    return snapshot.docs
      .filter((doc) => !doc.get('deletedBy'))
      .map((doc) => toSharedDocument(doc.id, doc.data()));
  }

  async getRecordDocument(tenantId: string, collection: string, recordId: string, documentId: string) {
    const snapshot = await this.tenant(tenantId).collection(collection).doc(recordId)
      .collection('documents').doc(documentId).get();
    if (!snapshot.exists) return null;
    const data = snapshot.data() ?? {};
    return { ...toSharedDocument(snapshot.id, data), portalShared: data.portalShared === true && !data.deletedBy };
  }

  async writeDocumentProjection(
    tenantId: string,
    projectionId: string,
    documentId: string,
    projection: PortalDocumentProjection,
  ): Promise<void> {
    await this.projections(tenantId).doc(projectionId)
      .collection(PORTAL_DOCUMENTS_SUBCOLLECTION).doc(documentId)
      .set({ ...projection, sharedAt: FieldValue.serverTimestamp() });
  }

  async deleteDocumentProjection(tenantId: string, projectionId: string, documentId: string): Promise<void> {
    await this.projections(tenantId).doc(projectionId)
      .collection(PORTAL_DOCUMENTS_SUBCOLLECTION).doc(documentId).delete();
  }

  async getPortalUser(tenantId: string, userId: string): Promise<PortalUserRecord | null> {
    const snapshot = await this.portalUsers(tenantId).doc(userId).get();
    if (!snapshot.exists) return null;
    const data = snapshot.data() ?? {};
    return {
      userId: snapshot.id,
      email: asString(data.email),
      displayName: asString(data.displayName),
      subjectKeys: asStrings(data.subjectKeys),
      ...(asString(data.locale) ? { locale: asString(data.locale) } : {}),
    };
  }

  async listPortalUsers(tenantId: string): Promise<PortalUserRecord[]> {
    const snapshot = await this.portalUsers(tenantId).get();
    return snapshot.docs.map((doc) => ({
      userId: doc.id,
      email: asString(doc.get('email')),
      displayName: asString(doc.get('displayName')),
      subjectKeys: asStrings(doc.get('subjectKeys')),
    }));
  }

  async grantSubject(tenantId: string, grant: PortalUserGrant, subjectKey: string): Promise<void> {
    const reference = this.portalUsers(tenantId).doc(grant.userId);
    await this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (snapshot.exists) {
        transaction.update(reference, {
          subjectKeys: FieldValue.arrayUnion(subjectKey),
          tenantName: grant.tenantName,
          ...(grant.locale ? { locale: grant.locale } : {}),
          updatedAt: FieldValue.serverTimestamp(),
        });
        return;
      }
      transaction.set(reference, {
        userId: grant.userId,
        email: grant.email,
        displayName: grant.displayName,
        tenantId,
        tenantName: grant.tenantName,
        subjectKeys: [subjectKey],
        invitedBy: grant.invitedBy,
        ...(grant.locale ? { locale: grant.locale } : {}),
        addedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
  }

  async revokeSubject(tenantId: string, userId: string, subjectKey: string | null): Promise<void> {
    const reference = this.portalUsers(tenantId).doc(userId);
    await this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) return;
      const remaining = subjectKey === null
        ? []
        : asStrings(snapshot.get('subjectKeys')).filter((key) => key !== subjectKey);
      if (remaining.length === 0) {
        transaction.delete(reference);
        return;
      }
      transaction.update(reference, { subjectKeys: remaining, updatedAt: FieldValue.serverTimestamp() });
    });
  }

  async readStagedUpload(tenantId: string, userId: string, uploadId: string) {
    const file = getBucket().file(portalUploadStagingPath(tenantId, userId, uploadId));
    const [exists] = await file.exists();
    if (!exists) return null;
    const [[data], [metadata]] = await Promise.all([file.download(), file.getMetadata()]);
    return { data, contentType: typeof metadata.contentType === 'string' ? metadata.contentType : 'application/octet-stream' };
  }

  async deleteStagedUpload(tenantId: string, userId: string, uploadId: string): Promise<void> {
    await getBucket().file(portalUploadStagingPath(tenantId, userId, uploadId)).delete({ ignoreNotFound: true });
  }

  async markInvite(email: string, tenantId: string): Promise<void> {
    await this.db.collection(PORTAL_INVITES_COLLECTION).doc(email).set({
      tenantIds: FieldValue.arrayUnion(tenantId),
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  async hasInvite(email: string): Promise<boolean> {
    return (await this.db.collection(PORTAL_INVITES_COLLECTION).doc(email).get()).exists;
  }
}

export class FirebasePortalAccountService implements IPortalAccountService {
  constructor(private readonly auth: Auth) {}

  async findUserIdByEmail(email: string) {
    try {
      const user = await this.auth.getUserByEmail(email);
      return { userId: user.uid, displayName: user.displayName ?? null };
    } catch (error) {
      if ((error as { code?: string }).code === 'auth/user-not-found') return null;
      throw error;
    }
  }

  async createAccount(email: string): Promise<string> {
    return (await this.auth.createUser({ email, emailVerified: false })).uid;
  }
}
