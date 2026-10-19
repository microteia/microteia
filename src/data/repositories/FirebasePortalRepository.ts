import {
  collection,
  collectionGroup,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../infrastructure/firebase/config';
import type { IPortalRepository } from '../../domain/repositories/IPortalRepository';
import type {
  PortalContext,
  PortalDocument,
  PortalGuest,
  PortalLinkOption,
  PortalMembership,
  PortalRecord,
} from '../../domain/entities/Portal';
import {
  PORTAL_DOCUMENTS_SUBCOLLECTION,
  PORTAL_RECORDS_COLLECTION,
  PORTAL_USERS_COLLECTION,
} from '../../domain/schema/portal';

const PAGE_LIMIT = 200;

const textOf = (value: unknown): string => (typeof value === 'string' ? value : '');
const dateOf = (value: unknown): Date | null => (value instanceof Timestamp ? value.toDate() : null);
const stringsOf = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const mapRecord = (id: string, data: Record<string, unknown>): PortalRecord => ({
  id,
  collection: textOf(data.collection),
  recordId: textOf(data.recordId),
  screenId: textOf(data.screenId),
  title: textOf(data.title),
  data: (data.data as Record<string, unknown> | undefined) ?? {},
  labels: (data.labels as Record<string, string> | undefined) ?? {},
  // Projeções gravadas antes do campo: o sujeito é o pai de quem aponta direto para a tela-sujeito,
  // que é o caso comum. O resto se acerta na próxima gravação do registro.
  parentKeys: stringsOf(data.parentKeys).length > 0 ? stringsOf(data.parentKeys) : stringsOf(data.subjectKeys),
  updatedAt: dateOf(data.updatedAt),
});

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
      (snapshot) => onUpdate(snapshot.docs.map((one) => mapRecord(one.id, one.data()))),
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

  async listLinkOptions(tenantId: string, userId: string, collectionName: string): Promise<PortalLinkOption[]> {
    const snapshot = await getDocs(query(
      collection(db, 'tenants', tenantId, PORTAL_RECORDS_COLLECTION),
      where('audience', 'array-contains', userId),
      where('collection', '==', collectionName),
      orderBy('updatedAt', 'desc'),
      limit(PAGE_LIMIT),
    ));
    return snapshot.docs.map((one) => {
      const record = mapRecord(one.id, one.data());
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

  subscribeGuests(
    tenantId: string,
    onUpdate: (guests: PortalGuest[]) => void,
    onError?: (error: Error) => void,
  ): () => void {
    return onSnapshot(
      collection(db, 'tenants', tenantId, PORTAL_USERS_COLLECTION),
      (snapshot) => onUpdate(
        snapshot.docs
          .map((one) => ({
            userId: one.id,
            email: textOf(one.get('email')),
            displayName: textOf(one.get('displayName')),
            subjectKeys: stringsOf(one.get('subjectKeys')),
          }))
          .sort((a, b) => a.email.localeCompare(b.email)),
      ),
      (error) => onError?.(error),
    );
  }

  async invite(tenantId: string, email: string, subjectKey: string, locale: string): Promise<{ userId: string; created: boolean }> {
    const call = httpsCallable<
      { tenantId: string; email: string; subjectKey: string; locale: string },
      { userId: string; created: boolean }
    >(functions, 'invitePortalUser');
    return (await call({ tenantId, email, subjectKey, locale })).data;
  }

  async revoke(tenantId: string, userId: string, subjectKey: string | null): Promise<void> {
    const call = httpsCallable<{ tenantId: string; userId: string; subjectKey: string | null }, { revoked: boolean }>(
      functions,
      'revokePortalUser',
    );
    await call({ tenantId, userId, subjectKey });
  }
}
