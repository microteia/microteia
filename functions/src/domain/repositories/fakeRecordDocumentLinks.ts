import type { IRecordDocumentLinks, RecordDocumentRef, SignedDocumentLinkRequest } from './IRecordDocumentLinks';
import { recordDocumentStoragePath } from '../services/recordDocumentHash';
import {
  RECORD_DOCUMENT_LINK_SEAL_FIELD,
  downloadTokenOf,
  hasRecordDocumentLinkSeal,
  isRecordDocumentLinkSealed,
  needsRecordDocumentLinkRotation,
  pendingRecordDocumentLinkToken,
} from '../services/recordDocumentLinks';

/** O link permanente como o Storage o monta — o token é o que importa. */
export const fakeDownloadUrl = (storagePath: string, token: string): string =>
  `https://files.test/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;

/**
 * Os links sobre o MESMO mapa de documentos do `makeFakePortalRepository` (`coleção/registro/documento`).
 * O token do arquivo fica em `tokens`, por caminho: é ele que diz se um link permanente ainda abre.
 */
export const makeFakeRecordDocumentLinks = (documents: Map<string, Record<string, unknown>>, tenantId = 't1') => {
  const tokens = new Map<string, string>();
  const signed: SignedDocumentLinkRequest[] = [];
  let sequence = 0;
  const keyOf = (ref: RecordDocumentRef) => `${ref.collection}/${ref.recordId}/${ref.documentId}`;
  const pathOf = (ref: RecordDocumentRef, data: Record<string, unknown>) =>
    recordDocumentStoragePath({ tenantId: ref.tenantId, parent: ref.collection, parentId: ref.recordId }, data);

  const links: IRecordDocumentLinks = {
    sign: async (request) => {
      signed.push(request);
      return `https://signed.test/${encodeURIComponent(request.storagePath)}?expires=${request.expiresAt.toISOString()}`;
    },
    rotate: async (ref) => {
      const data = documents.get(keyOf(ref));
      if (!data || data.deletedBy || isRecordDocumentLinkSealed(data)) return false;
      const storagePath = pathOf(ref, data);
      if (!storagePath) return false;
      const token = pendingRecordDocumentLinkToken(data) ?? `rotated-${(sequence += 1)}`;
      tokens.set(storagePath, token);
      documents.set(keyOf(ref), { ...data, [RECORD_DOCUMENT_LINK_SEAL_FIELD]: token, url: fakeDownloadUrl(storagePath, token) });
      return true;
    },
    seal: async (ref) => {
      const data = documents.get(keyOf(ref));
      const token = data ? downloadTokenOf(data.url) : null;
      if (data && token && !hasRecordDocumentLinkSeal(data)) {
        documents.set(keyOf(ref), { ...data, [RECORD_DOCUMENT_LINK_SEAL_FIELD]: token });
      }
    },
    unseal: async (ref) => {
      const data = documents.get(keyOf(ref));
      if (!data) return;
      const rest = { ...data };
      delete rest[RECORD_DOCUMENT_LINK_SEAL_FIELD];
      documents.set(keyOf(ref), rest);
    },
    pendingRotation: async (tenant, collection, recordId) =>
      [...documents.entries()]
        .filter(([key]) => key.startsWith(`${collection}/${recordId}/`))
        .filter(([key, data]) => needsRecordDocumentLinkRotation(data)
          && pathOf({ tenantId: tenant, collection, recordId, documentId: key.split('/').pop() as string }, data) !== null)
        .map(([key]) => key.split('/').pop() as string),
  };

  /** Um documento com arquivo na pasta do registro e o token do upload no link permanente. */
  const attach = (collection: string, recordId: string, documentId: string, data: Record<string, unknown> = {}) => {
    const storagePath = `tenants/${tenantId}/${collection}/${recordId}/${documentId}.pdf`;
    const token = `upload-${documentId}`;
    tokens.set(storagePath, token);
    documents.set(`${collection}/${recordId}/${documentId}`, {
      name: `${documentId}.pdf`, storagePath, url: fakeDownloadUrl(storagePath, token), ...data,
    });
  };

  /** O link permanente ainda abre o arquivo — o token dele é o que o arquivo tem. */
  const opens = (url: string): boolean => {
    const storagePath = decodeURIComponent(new URL(url).pathname.slice(1));
    return tokens.get(storagePath) === downloadTokenOf(url);
  };

  return { links, signed, attach, opens };
};
