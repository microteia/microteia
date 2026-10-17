import { describe, it, expect, vi } from 'vitest';
import { makeAttachDownloadToRecordUseCase } from './AttachDownloadToRecordUseCase';
import type { AttachDownloadRequest } from './AttachDownloadToRecordUseCase';
import { fakeScreenProvider } from '../repositories/fakeScreenProvider';
import type { SchemaScreen } from '../schema/pathResolver';
import type { IDownloadStore, StoredDownload } from '../repositories/IDownloadStore';
import type { IRecordDocumentWriter, RecordDocumentFile } from '../repositories/IRecordDocumentWriter';

const SCREENS = [
  { id: 'contracts', titleSingular: 'Contract', titleFieldKey: 'name', hasDocuments: true, fields: [] },
  { id: 'notes', titleSingular: 'Note', titleFieldKey: 'name', fields: [] },
] as unknown as SchemaScreen[];

const ITEM: StoredDownload = {
  id: 'd1',
  name: 'Receipt.pdf',
  storagePath: 'tenants/t1/downloads/d1/Receipt.pdf',
  contentType: 'application/pdf',
  ownerId: 'ana',
  visibility: 'owner',
};

const setup = (item: StoredDownload | null = ITEM) => {
  const attached: RecordDocumentFile[] = [];
  const deleted: string[] = [];
  const downloads: IDownloadStore = {
    get: async () => item,
    readFile: async () => Buffer.from('%PDF'),
    delete: async (_tenantId, id) => { deleted.push(id); },
  };
  const writer: IRecordDocumentWriter = {
    attach: vi.fn(async (file: RecordDocumentFile) => {
      attached.push(file);
      return { id: 'doc1', name: file.name, url: 'https://x', storagePath: 'p', contentType: file.contentType, size: 4 };
    }),
  };
  const useCase = makeAttachDownloadToRecordUseCase({
    downloads,
    screens: fakeScreenProvider(SCREENS),
    records: {
      record: async (_tenantId, _collection, recordId) => ({ ok: true, value: recordId === 'c1' ? { id: 'c1' } : null }),
      children: async () => ({ ok: true, value: [] }),
    },
    writer,
    timeZoneOf: async () => 'UTC',
  });
  return { useCase, attached, deleted };
};

const request = (overrides: Partial<AttachDownloadRequest> = {}): AttachDownloadRequest => ({
  tenantId: 't1',
  downloadId: 'd1',
  collection: 'contracts',
  recordId: 'c1',
  author: { uid: 'ana', name: 'Ana', via: 'ui' },
  permissions: ['contracts.update'],
  ...overrides,
});

describe('AttachDownloadToRecordUseCase', () => {
  it('move: anexa o arquivo ao registro e só depois o tira de Downloads', async () => {
    const { useCase, attached, deleted } = setup();

    expect(await useCase.execute(request())).toMatchObject({ ok: true, document: { id: 'doc1' }, moved: true });
    expect(attached[0]).toMatchObject({ physicalCollection: 'contracts', recordId: 'c1', name: 'Receipt.pdf' });
    expect(deleted).toEqual(['d1']);
  });

  it('o item de outra pessoa, privado, "não existe" para quem não gerencia — e existe para quem gerencia', async () => {
    const { useCase } = setup();
    const bia = { uid: 'bia', name: 'Bia', via: 'ui' as const };

    expect(await useCase.execute(request({ author: bia })))
      .toMatchObject({ ok: false, error: '@core.documents/downloads.not-found' });
    expect(await useCase.execute(request({ author: bia, permissions: ['contracts.update', 'downloads.manage'] })))
      .toMatchObject({ ok: true });
  });

  it('o público é de todos, mas quem não é dono COPIA: ver não é poder tirar de Downloads', async () => {
    const { useCase, deleted } = setup({ ...ITEM, visibility: 'everyone' });

    expect(await useCase.execute(request({ author: { uid: 'bia', name: 'Bia', via: 'ui' } })))
      .toMatchObject({ ok: true, moved: false });
    expect(deleted).toEqual([]);
  });

  it('sem editar o registro, sem aba ou sem registro: recusa, e o item continua em Downloads', async () => {
    const { useCase, deleted } = setup();

    expect(await useCase.execute(request({ permissions: ['contracts.read'] })))
      .toMatchObject({ ok: false, error: '@core.access/permission.denied' });
    expect(await useCase.execute(request({ collection: 'notes', permissions: ['notes.update'] })))
      .toMatchObject({ ok: false, error: '@core.documents/render.documents-disabled' });
    expect(await useCase.execute(request({ recordId: 'ghost' })))
      .toMatchObject({ ok: false, error: '@core.records/record.not-found' });
    expect(deleted).toEqual([]);
  });
});
