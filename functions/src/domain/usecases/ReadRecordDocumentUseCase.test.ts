import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { makeReadRecordDocumentUseCase } from './ReadRecordDocumentUseCase';
import type { ReadRecordDocumentDeps } from './ReadRecordDocumentUseCase';
import type { StoredRecordDocument } from '../repositories/IRecordDocumentStore';
import { PdfPasswordError, PdfUnreadableError } from '../repositories/IPdfTextExtractor';
import type { IPdfTextExtractor } from '../repositories/IPdfTextExtractor';
import type { PdfTextItem } from '../schema/pdfText';
import type { SchemaScreen } from '../schema/pathResolver';
import { fakeScreenProvider } from '../repositories/fakeScreenProvider';
import { MAX_SOURCE_TEXT_CHARACTERS } from '../schema/invocationSource';

const screensWith = (hasDocuments: boolean) => fakeScreenProvider([
  { id: 'bills', titleSingular: 'Bill', titleFieldKey: 'name', hasDocuments, fields: [] },
] as unknown as SchemaScreen[]);

const PATH = 'tenants/t/bills/b1/1700000000000_conta.pdf';

const pdfDocument = (extra: Partial<StoredRecordDocument> = {}): StoredRecordDocument => ({
  id: 'd1', name: 'conta.pdf', contentType: 'application/pdf', storagePath: PATH, size: 10, ...extra,
});

/** Um PDF de mentira: cada página é a lista de trechos que a biblioteca devolveria. */
const fakePdf = (pages: PdfTextItem[][], closed: string[] = []): IPdfTextExtractor => ({
  open: async () => ({
    pageCount: pages.length,
    pageItems: async (page) => pages[page - 1],
    close: async () => {
      closed.push('closed');
    },
  }),
});

const BILL = [
  [{ str: 'CNPJ 00.000.000/0001-00', hasEOL: true }, { str: 'TUSD 0,83544863', hasEOL: true }],
  [{ str: 'Histórico', hasEOL: true }],
];

const deps = (extra: Partial<ReadRecordDocumentDeps> = {}, stored: StoredRecordDocument | null = pdfDocument()): ReadRecordDocumentDeps => ({
  screens: screensWith(true),
  documents: {
    find: async (_tenantId, collection, recordId, documentId) =>
      collection === 'bills' && recordId === 'b1' && documentId === 'd1' ? stored : null,
    read: async (path) => (path === stored?.storagePath ? Buffer.from('%PDF-conteudo') : null),
  },
  pdf: fakePdf(BILL),
  ...extra,
});

const request = { tenantId: 't', collection: 'bills', recordId: 'b1', documentId: 'd1' };

describe('ReadRecordDocumentUseCase', () => {
  it('lê o PDF inteiro, uma página por bloco separado por form feed, e o hash do que leu', async () => {
    const closed: string[] = [];
    const result = await makeReadRecordDocumentUseCase(deps({ pdf: fakePdf(BILL, closed) })).execute(request);
    expect(result).toMatchObject({
      ok: true,
      name: 'conta.pdf',
      text: 'CNPJ 00.000.000/0001-00 TUSD 0,83544863\fHistórico',
      pageCount: 2,
      pagesRead: [1, 2],
      hasText: true,
      sha256: createHash('sha256').update('%PDF-conteudo').digest('hex'),
    });
    expect(closed).toEqual(['closed']);
  });

  it('lê só as páginas pedidas, preservando as linhas quando pedido', async () => {
    const result = await makeReadRecordDocumentUseCase(deps()).execute({ ...request, pages: '1', layout: 'lines' });
    expect(result).toMatchObject({ ok: true, text: 'CNPJ 00.000.000/0001-00\nTUSD 0,83544863', pagesRead: [1] });
  });

  it('página que o documento não tem é recusa', async () => {
    const result = await makeReadRecordDocumentUseCase(deps()).execute({ ...request, pages: '3' });
    expect(!result.ok && result.error).toBe('@core.automation/step.read-document.pages-out-of-range');
  });

  it('PDF escaneado é sucesso sem texto, para uma condição decidir', async () => {
    const result = await makeReadRecordDocumentUseCase(deps({ pdf: fakePdf([[], [{ str: ' ' }]]) })).execute(request);
    expect(result).toMatchObject({ ok: true, hasText: false, pageCount: 2 });
  });

  it('lê um documento de texto como ele é, sem a marca de BOM', async () => {
    const csv = pdfDocument({ name: 'leituras.csv', contentType: 'text/csv', storagePath: 'tenants/t/bills/b1/leituras.csv' });
    const result = await makeReadRecordDocumentUseCase(deps({
      documents: { find: async () => csv, read: async () => Buffer.from('\uFEFFkwh;valor\n120;98,10') },
    }, csv)).execute(request);
    expect(result).toMatchObject({ ok: true, text: 'kwh;valor\n120;98,10', pageCount: 1, pagesRead: [1] });
  });

  it('recusa o caminho que não é da pasta do próprio registro', async () => {
    for (const storagePath of ['tenants/t/mail_messages/k/message.eml', 'tenants/t/bills/b2/x.pdf', 'tenants/t/bills/b1/../b2/x.pdf', 'tenants/u/bills/b1/x.pdf']) {
      const stored = pdfDocument({ storagePath });
      const result = await makeReadRecordDocumentUseCase(deps({}, stored)).execute(request);
      expect(!result.ok && result.error, storagePath).toBe('@core.automation/step.read-document.outside-record');
    }
  });

  it('recusa imagem, PDF com senha, arquivo corrompido e arquivo que sumiu do bucket', async () => {
    const image = await makeReadRecordDocumentUseCase(deps({}, pdfDocument({ contentType: 'image/png' }))).execute(request);
    expect(!image.ok && image.error).toBe('@core.automation/step.read-document.unsupported-type');

    const locked = await makeReadRecordDocumentUseCase(deps({ pdf: { open: async () => { throw new PdfPasswordError(); } } })).execute(request);
    expect(!locked.ok && locked.error).toBe('@core.automation/step.read-document.encrypted');

    const broken = await makeReadRecordDocumentUseCase(deps({ pdf: { open: async () => { throw new PdfUnreadableError('x'); } } })).execute(request);
    expect(!broken.ok && broken.error).toBe('@core.automation/step.read-document.unreadable');

    const gone = await makeReadRecordDocumentUseCase(deps({
      documents: { find: async () => pdfDocument(), read: async () => null },
    })).execute(request);
    expect(!gone.ok && gone.error).toBe('@core.automation/step.read-document.file-missing');
  });

  it('texto acima do teto é recusado, nunca cortado', async () => {
    const huge = [[{ str: 'x'.repeat(MAX_SOURCE_TEXT_CHARACTERS + 1) }]];
    const result = await makeReadRecordDocumentUseCase(deps({ pdf: fakePdf(huge) })).execute(request);
    expect(!result.ok && result.error).toBe('@core.automation/step.read-document.text-too-large');
  });

  it('documento que não existe, tela sem a aba e coleção desconhecida', async () => {
    const missing = await makeReadRecordDocumentUseCase(deps()).execute({ ...request, documentId: 'outro' });
    expect(!missing.ok && missing.error).toBe('@core.automation/step.read-document.not-found');

    const disabled = await makeReadRecordDocumentUseCase(deps({ screens: screensWith(false) })).execute(request);
    expect(!disabled.ok && disabled.error).toBe('@core.documents/render.documents-disabled');

    const unknown = await makeReadRecordDocumentUseCase(deps()).execute({ ...request, collection: 'nada' });
    expect(!unknown.ok && unknown.error).toBe('@core.automation/mutation.table.unknown');
  });
});

describe('ReadRecordDocumentUseCase — tipo vazio', () => {
  it('deduz o tipo pela extensão quando o navegador não o gravou', async () => {
    const result = await makeReadRecordDocumentUseCase(deps({}, pdfDocument({ contentType: '' }))).execute(request);
    expect(result).toMatchObject({ ok: true, contentType: 'application/pdf' });
  });
});
