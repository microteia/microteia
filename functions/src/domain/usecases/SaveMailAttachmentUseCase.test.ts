import { describe, expect, it } from 'vitest';
import { makeSaveMailAttachmentUseCase } from './SaveMailAttachmentUseCase';
import type { MailAttachmentContent, SaveMailAttachmentDeps } from './SaveMailAttachmentUseCase';
import type { RecordDocumentFile } from '../repositories/IRecordDocumentWriter';
import type { SchemaScreen } from '../schema/pathResolver';
import { fakeScreenProvider } from '../repositories/fakeScreenProvider';
import { AGENT_DOCUMENT_MAX_BYTES } from '../schema/agent/agentDocument';

const attachment = (name: string, contentType: string, size = 3): MailAttachmentContent => ({
  name, contentType, size, content: Buffer.alloc(size),
});

const screensWith = (hasDocuments: boolean) => fakeScreenProvider([
  { id: 'cases', titleSingular: 'Case', titleFieldKey: 'name', hasDocuments, fields: [] },
] as unknown as SchemaScreen[]);

const deps = (
  attachments: MailAttachmentContent[],
  written: RecordDocumentFile[] = [],
  extra: Partial<SaveMailAttachmentDeps> = {},
): SaveMailAttachmentDeps => ({
  messages: { getMessage: async (_tenantId, key) => (key === 'k1' ? { rawStoragePath: 'tenants/t/mail_messages/k1/message.eml' } : null) },
  raw: { save: async () => '', read: async () => Buffer.from('raw') },
  attachments: async () => attachments,
  screens: screensWith(true),
  records: { record: async () => ({ ok: true, value: { id: 'c1' } }), children: async () => ({ ok: true, value: [] }) } as unknown as SaveMailAttachmentDeps['records'],
  writer: {
    attach: async (file) => {
      written.push(file);
      return { id: `d${written.length}`, name: file.name, url: 'u', storagePath: 'p', contentType: file.contentType, size: file.data.length, sha256: 'h' };
    },
  },
  timeZoneOf: async () => 'America/Bahia',
  ...extra,
});

const request = { tenantId: 't', messageKey: 'k1', collection: 'cases', recordId: 'c1', author: { uid: 'workflow-engine', name: null, via: 'automation' as const } };

describe('SaveMailAttachmentUseCase', () => {
  it('grava os anexos que casam, com o tipo de documento pedido', async () => {
    const written: RecordDocumentFile[] = [];
    const uc = makeSaveMailAttachmentUseCase(deps([attachment('Decisão.PDF', 'application/pdf'), attachment('logo.png', 'image/png')], written));
    const result = await uc.execute({ ...request, contentType: 'application/pdf', documentType: 'decisao' });
    expect(result.ok && result.saved.map((document) => document.name)).toEqual(['Decisão.PDF']);
    expect(written[0]).toMatchObject({ physicalCollection: 'cases', recordId: 'c1', type: 'decisao' });
  });

  it('nenhum anexo que case não é falha: o fluxo decide pela contagem', async () => {
    const result = await makeSaveMailAttachmentUseCase(deps([attachment('a.png', 'image/png')])).execute({ ...request, nameContains: 'decisao' });
    expect(result).toEqual({ ok: true, saved: [], tooLarge: [] });
  });

  it('o anexo acima do teto de documento fica de fora, nomeado', async () => {
    const big = attachment('enorme.pdf', 'application/pdf', AGENT_DOCUMENT_MAX_BYTES);
    const result = await makeSaveMailAttachmentUseCase(deps([big])).execute(request);
    expect(result).toEqual({ ok: true, saved: [], tooLarge: ['enorme.pdf'] });
  });

  it('a mensagem que expirou, ou entregue antes de ser guardada, reprova dizendo por quê', async () => {
    const result = await makeSaveMailAttachmentUseCase(deps([])).execute({ ...request, messageKey: 'velha' });
    expect(result).toEqual({ ok: false, error: '@core.automation/step.save-mail-attachment.message-gone' });
  });

  it('tela sem a aba Documentos e registro inexistente reprovam antes de ler anexo', async () => {
    let read = false;
    const semAba = await makeSaveMailAttachmentUseCase(deps([], [], {
      screens: screensWith(false),
      attachments: async () => { read = true; return []; },
    })).execute(request);
    expect(!semAba.ok && semAba.error).toBe('@core.documents/render.documents-disabled');

    const semRegistro = await makeSaveMailAttachmentUseCase(deps([], [], {
      records: { record: async () => ({ ok: true, value: null }) } as unknown as SaveMailAttachmentDeps['records'],
      attachments: async () => { read = true; return []; },
    })).execute(request);
    expect(!semRegistro.ok && semRegistro.error).toBe('@core.records/record.not-found');
    expect(read).toBe(false);
  });
});
