import { describe, it, expect } from 'vitest';
import { reportFileText } from './reportFileText';
import { createSchemaContext } from '../schema/pathResolver';
import type { SchemaScreen } from '../schema/pathResolver';
import { buildMessageCatalog } from '../schema/i18n/messages';
import { REPORT_OTHERS_KEY } from '../schema/report/reportSpec';
import type { ReportSpec } from '../schema/report/reportSpec';
import type { ReportResult } from '../schema/report/reportResult';

const faturas: SchemaScreen = {
  id: 'faturas',
  titleSingular: 'Fatura',
  titleFieldKey: 'numero',
  fields: [
    { key: 'numero', label: 'Número', type: 'text', required: false, order: 0, origin: 'design' },
    {
      key: 'situacao', label: 'Situação', type: 'select', required: false, order: 1, origin: 'design',
      options: [{ key: 'pending', label: '@acme/status.pending' }, { key: 'paid', label: 'Paga' }],
    },
    { key: 'clienteId', label: 'Cliente', type: 'reference', refEntity: 'clientes', required: false, order: 2, origin: 'design' },
    { key: 'uf', label: 'UF', type: 'select', lookupCollection: 'ufs', required: false, order: 3, origin: 'design' },
  ],
};
const clientes: SchemaScreen = {
  id: 'clientes', titleSingular: 'Cliente', titleFieldKey: 'nome',
  fields: [{ key: 'nome', label: 'Nome', type: 'text', required: false, order: 0, origin: 'design' }],
};
const schema = createSchemaContext([faturas, clientes], []);
const catalog = buildMessageCatalog([
  { locale: 'en', namespace: 'acme', messages: { 'status.pending': 'Pending' } },
  { locale: 'en', namespace: 'core.reports', messages: { 'group.empty': '(none)', 'group.others': 'Others', 'table.total': 'Total', 'csv.partial': 'Partial: {scanned}' } },
], 'en');

const spec: ReportSpec = {
  v: 1,
  dataset: {
    table: 'faturas',
    dimensions: [
      { key: 'situacao', path: 'situacao' }, { key: 'cliente', path: 'clienteId' }, { key: 'uf', path: 'uf' },
    ],
    measures: [{ key: 'total', op: 'sum', path: 'valor', format: { kind: 'number', decimals: 2 } }],
  },
  shape: { kind: 'summary', groupBy: [{ dimension: 'situacao' }], values: ['total'] },
};
const result: ReportResult = {
  shape: 'summary', columns: [], rows: [], totals: null, scanned: 1, complete: true, completeGroups: true, generatedAt: '',
};

const read: string[] = [];
const text = (formatted: boolean) => reportFileText({
  tenantId: 't1', spec, result: {
    ...result,
    rows: [
      { keys: [{ dimension: 'cliente', key: 'c1' }], values: {}, count: 1, level: 0 },
      { keys: [{ dimension: 'uf', key: 'BA' }], values: {}, count: 1, level: 0 },
    ],
  },
  schema, catalog, locale: 'pt-BR', formatted,
  sources: {
    getRecords: async (_t, collection, ids) => {
      read.push(`${collection}:${ids.join(',')}`);
      return new Map(ids.map((id) => [id, { nome: id === 'c1' ? 'Ana' : 'Bia' }]));
    },
    getLookupOptions: async (_t, _collection, keys) => keys.map((key) => ({ key, label: key === 'BA' ? 'Bahia' : key })),
  },
});

describe('reportFileText — o relatório como o escritório o lê, no servidor', () => {
  it('opção traduzida, lista do escritório, registro apontado, "Outros" e "sem valor"', async () => {
    const t = await text(false);
    expect(t.group({ dimension: 'situacao', key: 'pending' })).toBe('Pending');
    expect(t.group({ dimension: 'situacao', key: 'paid' })).toBe('Paga');
    expect(t.group({ dimension: 'cliente', key: 'c1' })).toBe('Ana');
    expect(t.group({ dimension: 'uf', key: 'BA' })).toBe('Bahia');
    expect(t.group({ dimension: 'situacao', key: '' })).toBe('(none)');
    expect(t.group({ dimension: 'situacao', key: REPORT_OTHERS_KEY })).toBe('Others');
    expect(t.group({ dimension: 'mes', key: '2026-03', label: '2026-03' })).toBe('2026-03');
  });

  it('lê cada coleção apontada UMA vez, com todos os ids', () => {
    expect(read).toContain('clientes:c1');
  });

  it('o número sai cru para a planilha e formatado no idioma do escritório para o PDF', async () => {
    expect((await text(false)).number(1234.5, { kind: 'number', decimals: 2 })).toBe('1234.5');
    expect((await text(true)).number(1234.5, { kind: 'number', decimals: 2 })).toBe('1.234,50');
    expect((await text(true)).number(null, undefined)).toBe('');
  });

  it('a célula de um registro hidratado mostra o título, não o id', async () => {
    const t = await text(false);
    expect(t.cell({ clienteId: { id: 'c1', nome: 'Ana' } }, { key: 'cliente', path: 'clienteId' })).toBe('Ana');
  });
});
