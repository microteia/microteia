import type { SchemaContext } from '../schema/pathResolver';
import { resolveQueryTable } from '../schema/querySpec';
import { grants, PERMISSION_DOWNLOADS_MANAGE } from '../schema/access';
import { collectionPermissionId } from '../schema/access/permission';
import { canSeeDownload } from '../schema/document/documentDownloads';
import type { IScreenDefinitionProvider } from '../repositories/IScreenDefinitionProvider';
import type { IDocumentRecordReader } from '../repositories/IDocumentGenerationPorts';
import type { IDownloadStore } from '../repositories/IDownloadStore';
import type {
  AttachedRecordDocument,
  IRecordDocumentWriter,
  RecordDocumentAuthor,
} from '../repositories/IRecordDocumentWriter';
import type { RecordReader } from '../schema/memberVisibility';

export interface AttachDownloadRequest {
  tenantId: string;
  downloadId: string;
  /** A coleção FÍSICA do registro de destino. */
  collection: string;
  recordId: string;
  documentType?: string;
  author: RecordDocumentAuthor;
  /** As permissões de quem anexa — o que decide se ele vê o item e se edita o registro. */
  permissions: readonly string[];
  /** Quem anexa. O registro que ele não vê (`memberVisibility`) responde como ausente. */
  reader?: RecordReader;
}

export type AttachDownloadResult =
  | {
    ok: true;
    document: AttachedRecordDocument;
    /** Saiu de Downloads (`true`) ou ficou lá também (`false`, quando quem anexou não podia apagá-lo). */
    moved: boolean;
  }
  | { ok: false; error: string; errorParams?: Record<string, string> };

export interface AttachDownloadDeps {
  downloads: IDownloadStore;
  screens: IScreenDefinitionProvider;
  records: IDocumentRecordReader;
  writer: IRecordDocumentWriter;
  timeZoneOf(tenantId: string): Promise<string>;
}

export interface AttachDownloadToRecordUseCase {
  execute(request: AttachDownloadRequest): Promise<AttachDownloadResult>;
}

const failure = (error: string, errorParams?: Record<string, string>): AttachDownloadResult =>
  errorParams ? { ok: false, error, errorParams } : { ok: false, error };

const screenOf = (schema: SchemaContext, collection: string) => schema.screens.get(collection);

/**
 * Tornar PERMANENTE um arquivo de Downloads: ele vai para a aba Documentos de um registro e sai de
 * Downloads. É MOVER, e não copiar — o arquivo temporário que ficasse para trás venceria sozinho, mas
 * até lá seriam dois arquivos iguais com destinos diferentes. A exceção é quem anexa o arquivo PÚBLICO
 * de outra pessoa: ver não é poder apagar (a mesma regra do Firestore), e aí o item fica onde está.
 *
 * As recusas, na ordem da pergunta: o item existe e quem pede o vê (quem não o vê ouve "não existe",
 * como na regra); a tela existe; quem pede edita o registro; a tela tem a aba Documentos; o registro
 * existe. Só então o arquivo é lido e anexado, e só depois de anexado o item sai de Downloads.
 */
export const makeAttachDownloadToRecordUseCase = (deps: AttachDownloadDeps): AttachDownloadToRecordUseCase => ({
  execute: async (request) => {
    const item = await deps.downloads.get(request.tenantId, request.downloadId);
    const manages = grants(request.permissions, PERMISSION_DOWNLOADS_MANAGE);
    if (!item || !canSeeDownload(item, request.author.uid, manages)) {
      return failure('@core.documents/downloads.not-found');
    }

    const schema = await deps.screens.getSchemaContext(request.tenantId);
    if (!resolveQueryTable(request.collection, schema) || !screenOf(schema, request.collection)) {
      return failure('@core.automation/mutation.table.unknown', { table: request.collection });
    }
    const permission = collectionPermissionId(request.collection, 'update');
    if (!grants(request.permissions, permission)) return failure('@core.access/permission.denied', { permission });
    if (screenOf(schema, request.collection)?.hasDocuments !== true) {
      return failure('@core.documents/render.documents-disabled', { collection: request.collection });
    }

    const timeZone = await deps.timeZoneOf(request.tenantId);
    const record = await deps.records.record(
      request.tenantId,
      request.collection,
      request.recordId,
      [],
      timeZone,
      undefined,
      request.reader,
    );
    if (!record.ok) return failure(record.error, record.errorParams);
    if (!record.value) return failure('@core.records/record.not-found');

    const data = await deps.downloads.readFile(item.storagePath);
    const document = await deps.writer.attach({
      tenantId: request.tenantId,
      physicalCollection: request.collection,
      recordId: request.recordId,
      name: item.name,
      contentType: item.contentType,
      data,
      type: request.documentType ?? null,
      author: request.author,
    });
    const moved = manages || item.ownerId === request.author.uid;
    if (moved) await deps.downloads.delete(request.tenantId, item.id);
    return { ok: true, document, moved };
  },
});
