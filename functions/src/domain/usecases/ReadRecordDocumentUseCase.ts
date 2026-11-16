import { createHash } from 'node:crypto';
import { resolveQueryTable } from '../schema/querySpec';
import {
  READ_DOCUMENT_MAX_BYTES,
  READ_DOCUMENT_PAGE_SEPARATOR,
  parsePageSelection,
  readableDocumentKind,
} from '../schema/documentRead';
import { MAX_SOURCE_TEXT_CHARACTERS } from '../schema/invocationSource';
import { pdfPageText } from '../schema/pdfText';
import { agentDocumentContentType } from '../schema/agent/agentDocument';
import type { PdfTextLayout } from '../schema/pdfText';
import type { IScreenDefinitionProvider } from '../repositories/IScreenDefinitionProvider';
import type { IRecordDocumentStore } from '../repositories/IRecordDocumentStore';
import { PdfPasswordError } from '../repositories/IPdfTextExtractor';
import type { IPdfTextExtractor } from '../repositories/IPdfTextExtractor';

export interface ReadRecordDocumentRequest {
  tenantId: string;
  /** A coleção FÍSICA do registro dono do documento. */
  collection: string;
  recordId: string;
  documentId: string;
  /** `""` = todas; ver `parsePageSelection`. Ignorado num documento de texto. */
  pages?: string;
  layout?: PdfTextLayout;
}

export interface ReadRecordDocumentValue {
  documentId: string;
  name: string;
  contentType: string;
  size: number;
  /** Do conteúdo LIDO, e não o carimbado no documento — que pode ainda não existir. */
  sha256: string;
  /** As páginas lidas, separadas por `READ_DOCUMENT_PAGE_SEPARATOR`. */
  text: string;
  pageCount: number;
  pagesRead: number[];
  /** Falso num PDF escaneado: há páginas, e nenhuma tem camada de texto. */
  hasText: boolean;
}

export type ReadRecordDocumentResult =
  | ({ ok: true } & ReadRecordDocumentValue)
  | { ok: false; error: string; errorParams?: Record<string, string> };

export interface ReadRecordDocumentDeps {
  screens: IScreenDefinitionProvider;
  documents: IRecordDocumentStore;
  pdf: IPdfTextExtractor;
}

export interface ReadRecordDocumentUseCase {
  execute(request: ReadRecordDocumentRequest): Promise<ReadRecordDocumentResult>;
}

const failure = (error: string, errorParams?: Record<string, string>): ReadRecordDocumentResult =>
  errorParams ? { ok: false, error, errorParams } : { ok: false, error };

/**
 * O caminho do arquivo vem do documento, e o documento é gravado pelo navegador sem que as regras o
 * confiram. Sem esta guarda, um membro que pode anexar apontaria o documento para a mensagem de e-mail
 * guardada de uma caixa pessoal, ou para o arquivo de outro registro, e o passo o leria por ele.
 */
const belongsToRecord = (storagePath: string, tenantId: string, collection: string, recordId: string): boolean =>
  storagePath.startsWith(`tenants/${tenantId}/${collection}/${recordId}/`)
  && !storagePath.split('/').some((segment) => segment === '..' || segment === '.');

const decodeText = (data: Buffer): string => data.toString('utf8').replace(/^\uFEFF/, '');

export const makeReadRecordDocumentUseCase = (deps: ReadRecordDocumentDeps): ReadRecordDocumentUseCase => ({
  execute: async (request) => {
    const schema = await deps.screens.getSchemaContext(request.tenantId);
    const screen = schema.screens.get(request.collection);
    if (!resolveQueryTable(request.collection, schema) || !screen) {
      return failure('@core.automation/mutation.table.unknown', { table: request.collection });
    }
    if (screen.hasDocuments !== true) {
      return failure('@core.documents/render.documents-disabled', { collection: request.collection });
    }

    const document = request.recordId && request.documentId
      ? await deps.documents.find(request.tenantId, request.collection, request.recordId, request.documentId)
      : null;
    if (!document) return failure('@core.automation/step.read-document.not-found');
    if (!belongsToRecord(document.storagePath, request.tenantId, request.collection, request.recordId)) {
      return failure('@core.automation/step.read-document.outside-record', { name: document.name });
    }

    // O navegador grava o `type` do arquivo, que vem vazio quando o sistema não o reconhece.
    const contentType = agentDocumentContentType(document.name, document.contentType);
    const kind = readableDocumentKind(contentType);
    if (!kind) {
      return failure('@core.automation/step.read-document.unsupported-type', { name: document.name, contentType });
    }
    if ((document.size ?? 0) > READ_DOCUMENT_MAX_BYTES) {
      return failure('@core.automation/step.read-document.file-too-large', { name: document.name });
    }

    const data = await deps.documents.read(document.storagePath);
    if (!data) return failure('@core.automation/step.read-document.file-missing', { name: document.name });
    if (data.length > READ_DOCUMENT_MAX_BYTES) {
      return failure('@core.automation/step.read-document.file-too-large', { name: document.name });
    }

    let text: string;
    let pageCount: number;
    let pagesRead: number[];
    if (kind === 'text') {
      text = decodeText(data);
      pageCount = 1;
      pagesRead = [1];
    } else {
      let pdf;
      try {
        pdf = await deps.pdf.open(new Uint8Array(data));
      } catch (error) {
        return error instanceof PdfPasswordError
          ? failure('@core.automation/step.read-document.encrypted', { name: document.name })
          : failure('@core.automation/step.read-document.unreadable', { name: document.name });
      }
      try {
        const selection = parsePageSelection(request.pages ?? '', pdf.pageCount);
        if (!selection.ok) return failure(selection.message, selection.messageParams);
        const pageTexts: string[] = [];
        for (const page of selection.pages) {
          pageTexts.push(pdfPageText(await pdf.pageItems(page), request.layout ?? 'flat'));
        }
        text = pageTexts.join(READ_DOCUMENT_PAGE_SEPARATOR);
        pageCount = pdf.pageCount;
        pagesRead = selection.pages;
      } finally {
        await pdf.close().catch(() => undefined);
      }
    }

    // Recusa, nunca corte: um leitor determinístico que recebesse metade da conta leria outra conta.
    if (text.length > MAX_SOURCE_TEXT_CHARACTERS) {
      return failure('@core.automation/step.read-document.text-too-large', {
        name: document.name,
        count: String(text.length),
        max: String(MAX_SOURCE_TEXT_CHARACTERS),
      });
    }

    return {
      ok: true,
      documentId: document.id,
      name: document.name,
      contentType,
      size: data.length,
      sha256: createHash('sha256').update(data).digest('hex'),
      text,
      pageCount,
      pagesRead,
      hasText: text.split(READ_DOCUMENT_PAGE_SEPARATOR).some((page) => page.trim() !== ''),
    };
  },
});
