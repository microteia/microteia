import type { SchemaContext } from '../schema/pathResolver';
import { resolveQueryTable } from '../schema/querySpec';
import { AGENT_DOCUMENT_MAX_BYTES, agentDocumentContentType, agentDocumentName } from '../schema/agent/agentDocument';
import { matchesAttachment } from '../schema/mailbox';
import type { IScreenDefinitionProvider } from '../repositories/IScreenDefinitionProvider';
import type { IDocumentRecordReader } from '../repositories/IDocumentGenerationPorts';
import type { IMailRawStore } from '../repositories/IMailRawStore';
import type { AttachedRecordDocument, IRecordDocumentWriter, RecordDocumentAuthor } from '../repositories/IRecordDocumentWriter';

export interface MailAttachmentContent {
  name: string;
  contentType: string;
  size: number;
  content: Buffer;
}

export interface SaveMailAttachmentRequest {
  tenantId: string;
  /** A chave da mensagem entregue — o `event.id` do gatilho "Ao receber e-mail". */
  messageKey: string;
  /** A coleção FÍSICA do registro de destino. */
  collection: string;
  recordId: string;
  nameContains?: string;
  contentType?: string;
  documentType?: string;
  author: RecordDocumentAuthor;
}

export type SaveMailAttachmentResult =
  | {
    ok: true;
    saved: AttachedRecordDocument[];
    /** Os anexos que casaram e não couberam (acima do teto de documento). */
    tooLarge: string[];
  }
  | { ok: false; error: string; errorParams?: Record<string, string> };

export interface SaveMailAttachmentDeps {
  messages: { getMessage(tenantId: string, key: string): Promise<{ rawStoragePath: string | null } | null> };
  raw: IMailRawStore;
  attachments: (raw: Buffer) => Promise<MailAttachmentContent[]>;
  screens: IScreenDefinitionProvider;
  records: IDocumentRecordReader;
  writer: IRecordDocumentWriter;
  timeZoneOf(tenantId: string): Promise<string>;
}

export interface SaveMailAttachmentUseCase {
  execute(request: SaveMailAttachmentRequest): Promise<SaveMailAttachmentResult>;
}

const failure = (error: string, errorParams?: Record<string, string>): SaveMailAttachmentResult =>
  errorParams ? { ok: false, error, errorParams } : { ok: false, error };

const screenOf = (schema: SchemaContext, collection: string) => schema.screens.get(collection);

/**
 * Grava na aba Documentos de um registro os anexos de uma mensagem ENTREGUE — tirados da cópia guardada
 * (`.eml`), e não da caixa: vale igual para a lida por IMAP e para a encaminhada, e continua valendo se a
 * senha da caixa mudar.
 *
 * Roda como o escritório, como os outros passos que gravam: a regra que decide o que entra é o filtro da
 * automação, e quem a escreveu escolheu o registro. As recusas, na ordem: a mensagem ainda está guardada; a
 * tela existe e tem a aba Documentos; o registro existe. Nenhum anexo que case não é falha — o e-mail sem o
 * PDF é a notícia, e o fluxo decide pelo `count`.
 */
export const makeSaveMailAttachmentUseCase = (deps: SaveMailAttachmentDeps): SaveMailAttachmentUseCase => ({
  execute: async (request) => {
    const message = request.messageKey ? await deps.messages.getMessage(request.tenantId, request.messageKey) : null;
    const raw = message?.rawStoragePath ? await deps.raw.read(message.rawStoragePath) : null;
    if (!raw) return failure('@core.automation/step.save-mail-attachment.message-gone');

    const schema = await deps.screens.getSchemaContext(request.tenantId);
    if (!resolveQueryTable(request.collection, schema) || !screenOf(schema, request.collection)) {
      return failure('@core.automation/mutation.table.unknown', { table: request.collection });
    }
    if (screenOf(schema, request.collection)?.hasDocuments !== true) {
      return failure('@core.documents/render.documents-disabled', { collection: request.collection });
    }

    const timeZone = await deps.timeZoneOf(request.tenantId);
    const record = await deps.records.record(request.tenantId, request.collection, request.recordId, [], timeZone);
    if (!record.ok) return failure(record.error, record.errorParams);
    if (!record.value) return failure('@core.records/record.not-found');

    const wanted = (await deps.attachments(raw))
      .filter((attachment) => matchesAttachment(attachment, { nameContains: request.nameContains, contentType: request.contentType }));

    const saved: AttachedRecordDocument[] = [];
    const tooLarge: string[] = [];
    for (const [index, attachment] of wanted.entries()) {
      const name = agentDocumentName(attachment.name) ?? `attachment-${index + 1}`;
      if (attachment.content.length >= AGENT_DOCUMENT_MAX_BYTES) {
        tooLarge.push(name);
        continue;
      }
      saved.push(await deps.writer.attach({
        tenantId: request.tenantId,
        physicalCollection: request.collection,
        recordId: request.recordId,
        name,
        contentType: agentDocumentContentType(name, attachment.contentType),
        data: attachment.content,
        type: request.documentType ?? null,
        author: request.author,
      }));
    }
    return { ok: true, saved, tooLarge };
  },
});
