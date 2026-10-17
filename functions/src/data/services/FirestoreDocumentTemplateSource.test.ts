import { describe, it, expect, vi } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { FirestoreDocumentTemplateSource } from './FirestoreDocumentTemplateSource';
import type { InstalledExtensionCache } from './InstalledExtensionCache';
import { fakeScreenProvider } from '../../domain/repositories/fakeScreenProvider';
import type { SchemaScreen } from '../../domain/schema/pathResolver';
import { documentTemplateContribution } from '../../domain/schema/document/documentTemplate';
import type { DocumentTemplateSpec } from '../../domain/schema/document/documentTemplate';
import { makeRenderDocumentUseCase } from '../../domain/usecases/RenderDocumentUseCase';
import type { IRecordDocumentWriter, RecordDocumentFile } from '../../domain/repositories/IRecordDocumentWriter';
import type { IDocumentRecordReader } from '../../domain/repositories/IDocumentGenerationPorts';

const SCREENS = [
  {
    id: 'financeiro',
    collection: 'financials',
    sourceId: 'microteia:financeiro',
    titleSingular: 'Entry',
    titleFieldKey: 'name',
    hasDocuments: true,
    fields: [{ key: 'name', label: 'Name', type: 'text', required: true, order: 0, origin: 'custom' }],
  },
  {
    id: 'parcelas',
    collection: 'installments',
    sourceId: 'microteia:parcelas',
    titleSingular: 'Installment',
    titleFieldKey: 'amount',
    fields: [
      { key: 'amount', label: 'Amount', type: 'number', required: false, order: 0, origin: 'custom' },
      { key: 'entryId', label: 'Entry', type: 'reference', refEntity: 'financials', required: false, order: 1, origin: 'custom' },
    ],
  },
] as unknown as SchemaScreen[];

const RECEIPT: DocumentTemplateSpec = {
  key: 'receipt',
  title: 'Receipt',
  collection: '',
  screenSourceId: 'microteia:financeiro',
  format: 'markdown',
  body: '{{name}}{{#each parcelas}}{{amount}}{{/each}}',
  datasets: [{ name: 'parcelas', from: '', fromSourceId: 'microteia:parcelas', via: 'entryId' }],
};

const source = (): FirestoreDocumentTemplateSource => {
  const db = { collection: () => ({ get: async () => ({ docs: [] }) }) } as unknown as Firestore;
  const extensions = {
    documentTemplates: async () => [{ ...documentTemplateContribution(RECEIPT), pluginId: 'com.acme' }],
  } as unknown as InstalledExtensionCache;
  return new FirestoreDocumentTemplateSource(db, extensions, fakeScreenProvider(SCREENS));
};

describe('FirestoreDocumentTemplateSource', () => {
  it('traduz o sourceId da tela para a coleção FÍSICA, não para a chave da tela', async () => {
    const [resolved] = await source().resolve('t1');

    expect(resolved.collection).toBe('financials');
    expect(resolved.datasets?.[0].from).toBe('installments');
  });

  it('o modelo de uma tela de chave diferente da coleção é gerado sobre o registro dela', async () => {
    const read: string[] = [];
    const records: IDocumentRecordReader = {
      record: async (_tenantId, collection, recordId) => {
        read.push(collection);
        return { ok: true, value: { id: recordId, name: 'Fee' } };
      },
      children: async (_tenantId, dataset) => {
        read.push(dataset.from);
        return { ok: true, value: [{ id: 'i1', amount: 10 }] };
      },
    };
    const attached: RecordDocumentFile[] = [];
    const writer: IRecordDocumentWriter = {
      attach: vi.fn(async (file: RecordDocumentFile) => {
        attached.push(file);
        return { id: 'd1', name: file.name, url: 'https://x', storagePath: 'p', contentType: file.contentType, size: 1 };
      }),
    };
    const useCase = makeRenderDocumentUseCase({
      templates: source(),
      screens: fakeScreenProvider(SCREENS),
      records,
      renderer: {
        templateText: (one) => one.body ?? '',
        render: async () => ({ data: Buffer.from('%PDF'), contentType: 'application/pdf', extension: 'pdf', issues: [] }),
      },
      writer,
      downloads: { save: vi.fn() },
      downloadPolicyOf: async () => ({ retentionDays: 7, automationVisibility: 'managers' }),
      localeOf: async () => 'pt-BR',
      timeZoneOf: async () => 'America/Sao_Paulo',
    });

    const result = await useCase.execute({
      tenantId: 't1',
      templateKey: 'receipt',
      recordId: 'r1',
      collection: 'financials',
      author: { uid: 'u1', name: 'Ana', via: 'ui' },
    });

    expect(result.ok).toBe(true);
    expect(read).toEqual(['financials', 'installments']);
    expect(attached[0]).toMatchObject({ physicalCollection: 'financials', recordId: 'r1' });
  });
});
