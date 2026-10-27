import { RESERVED_COLLECTIONS } from '../schema/screenEntity';

/**
 * O campo do documento do registro com o SHA-256 do arquivo, em hexadecimal. É de SISTEMA: o
 * `firestore.rules` recusa o cliente que o escreve, e o servidor só o grava quando ele falta — nunca
 * o reescreve.
 */
export const RECORD_DOCUMENT_HASH_FIELD = 'sha256';

/** As chaves que só o servidor carimba depois da gravação de quem anexou — não são alteração de ninguém. */
export const RECORD_DOCUMENT_SERVER_STAMPS: readonly string[] = [RECORD_DOCUMENT_HASH_FIELD];

export interface RecordDocumentLocation {
  tenantId: string;
  parent: string;
  parentId: string;
}

/**
 * O caminho do arquivo que deve ser lido para carimbar o hash, ou `null` quando não há o que carimbar:
 * o documento foi apagado, já tem hash, está sendo excluído, ou não é de um registro de tela.
 *
 * O `storagePath` é dado do CLIENTE. Só vale o que mora na pasta do próprio registro — senão um
 * documento forjado faria o servidor ler o arquivo de outro registro, ou de outro escritório.
 */
export const recordDocumentFileToHash = (
  location: RecordDocumentLocation,
  data: Record<string, unknown> | null,
): string | null => {
  if (!data || typeof data[RECORD_DOCUMENT_HASH_FIELD] === 'string' || data.deletedBy) return null;
  return recordDocumentStoragePath(location, data);
};

/**
 * O caminho do arquivo do documento, só se ele mora na pasta do próprio registro. O `storagePath` é dado
 * do CLIENTE: sem essa conferência, um documento forjado faria o servidor ler, assinar ou trocar o
 * token do arquivo de outro registro, ou de outro escritório.
 */
export const recordDocumentStoragePath = (
  location: RecordDocumentLocation,
  data: Record<string, unknown> | null,
): string | null => {
  if (!data || RESERVED_COLLECTIONS.has(location.parent)) return null;
  const storagePath = data.storagePath;
  if (typeof storagePath !== 'string') return null;
  const folder = `tenants/${location.tenantId}/${location.parent}/${location.parentId}/`;
  if (!storagePath.startsWith(folder) || storagePath.length === folder.length) return null;
  return storagePath.split('/').some((segment) => segment === '..' || segment === '') ? null : storagePath;
};
