import { describe, expect, it } from 'vitest';
import { makeShareRecordDocumentsUseCase } from './ShareRecordDocumentsUseCase';
import type { ShareRecordDocumentsRequest } from './ShareRecordDocumentsUseCase';
import { fakeScreenProvider } from '../repositories/fakeScreenProvider';
import type { IRecordDocumentSharing, SharableRecordDocument } from '../repositories/IRecordDocumentSharing';
import type { SchemaScreen } from '../schema/pathResolver';

const screens = [
  {
    id: 'orders',
    titleSingular: 'Order',
    titleFieldKey: 'code',
    hasDocuments: true,
    fields: [{ key: 'code', label: 'Code', type: 'text', required: true, order: 0, origin: 'custom' }],
  },
  {
    id: 'plain',
    titleSingular: 'Plain',
    titleFieldKey: 'code',
    fields: [{ key: 'code', label: 'Code', type: 'text', required: true, order: 0, origin: 'custom' }],
  },
] as unknown as SchemaScreen[];

interface FakeSharing extends IRecordDocumentSharing {
  writes: { ids: readonly string[]; shared: boolean; actor: string }[];
}

const fakeSharing = (
  documents: SharableRecordDocument[],
  options: { portal?: boolean; exists?: boolean } = {},
): FakeSharing => {
  const writes: FakeSharing['writes'] = [];
  return {
    writes,
    recordExists: async () => options.exists ?? true,
    documents: async () => documents,
    setPortalShared: async (_t, _c, _r, ids, shared, actor) => {
      writes.push({ ids, shared, actor });
    },
    portalShowsDocuments: async () => options.portal ?? true,
  };
};

const request = (overrides: Partial<ShareRecordDocumentsRequest> = {}): ShareRecordDocumentsRequest => ({
  tenantId: 't1',
  collection: 'orders',
  recordId: 'r1',
  shared: true,
  actorUid: 'workflow-engine',
  ...overrides,
});

const DOCS: SharableRecordDocument[] = [
  { id: 'd1', type: 'Invoice', portalShared: false },
  { id: 'd2', type: 'Receipt', portalShared: true },
  { id: 'd3', portalShared: false },
];

const run = (sharing: FakeSharing, overrides: Partial<ShareRecordDocumentsRequest> = {}) =>
  makeShareRecordDocumentsUseCase({ screens: fakeScreenProvider(screens), sharing }).execute(request(overrides));

describe('ShareRecordDocumentsUseCase', () => {
  it('sem documentId, compartilha todos os documentos do registro, e só grava os que mudam', async () => {
    const sharing = fakeSharing(DOCS);
    expect(await run(sharing)).toEqual({ ok: true, matched: 3, changed: 2, shared: true });
    expect(sharing.writes).toEqual([{ ids: ['d1', 'd3'], shared: true, actor: 'workflow-engine' }]);
  });

  it('é idempotente: o que já está no estado pedido não é regravado', async () => {
    const sharing = fakeSharing([{ id: 'd2', portalShared: true }]);
    expect(await run(sharing)).toEqual({ ok: true, matched: 1, changed: 0, shared: true });
    expect(sharing.writes).toEqual([]);
  });

  it('filtra por documento e por tipo, e o documento que não é do registro reprova com erro nomeado', async () => {
    expect(await run(fakeSharing(DOCS), { documentId: 'd1' })).toMatchObject({ ok: true, matched: 1, changed: 1 });
    expect(await run(fakeSharing(DOCS), { documentType: 'Receipt', shared: false })).toMatchObject({ ok: true, matched: 1, changed: 1 });
    expect(await run(fakeSharing(DOCS), { documentId: 'other' })).toEqual({
      ok: false,
      error: '@core.documents/share.document-not-found',
      errorParams: { document: 'other', record: 'r1' },
    });
  });

  it('compartilhar exige que o portal mostre documentos; deixar de compartilhar, não', async () => {
    expect(await run(fakeSharing(DOCS, { portal: false }))).toMatchObject({ ok: false, error: '@core.documents/share.portal-off' });
    expect(await run(fakeSharing(DOCS, { portal: false }), { shared: false })).toMatchObject({ ok: true, changed: 1 });
  });

  it('recusa tela desconhecida, tela sem documentos, registro inexistente e quem não pode editar', async () => {
    expect(await run(fakeSharing(DOCS), { collection: 'nope' })).toMatchObject({ error: '@core.automation/mutation.table.unknown' });
    expect(await run(fakeSharing(DOCS), { collection: 'plain' })).toMatchObject({ error: '@core.documents/render.documents-disabled' });
    expect(await run(fakeSharing(DOCS, { exists: false }))).toMatchObject({ error: '@core.records/record.not-found' });
    expect(await run(fakeSharing(DOCS), { permissions: ['orders.read'] })).toEqual({
      ok: false,
      error: '@core.access/permission.denied',
      errorParams: { permission: 'orders.update' },
    });
    expect(await run(fakeSharing(DOCS), { permissions: ['orders.update'] })).toMatchObject({ ok: true });
  });
});
