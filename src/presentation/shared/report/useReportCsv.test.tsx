// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('./useReportGroupLabels', () => ({
  useReportGroupLabels: () => (entry: { key: string } | undefined) => entry?.key ?? '—',
}));

// O schema entra de verdade: é dele que sai o campo que NOMEIA o registro apontado.
vi.mock('../useSchemaContext', () => ({
  useSchemaContext: () => createSchemaContext([
    {
      id: 'clientes',
      titleSingular: 'Cliente',
      titleFieldKey: 'nome',
      fields: [
        { key: 'nome', label: 'Nome', type: 'text', required: false, order: 0, origin: 'design' },
        {
          key: 'sociosIds',
          label: 'Sócios',
          type: 'reference',
          required: false,
          order: 1,
          origin: 'design',
          refEntity: 'clientes',
          multi: true,
        },
      ],
    },
  ]),
}));

import { createSchemaContext } from '../../../domain/schema/pathResolver';

const { useReportCsv } = await import('./useReportCsv');
import type { ReportResult } from '../../../domain/schema/report/reportResult';
import type { ReportSpec } from '../../../domain/schema/report/reportSpec';

/**
 * O CSV que o gesto de baixar produziria, lido do `Blob` em vez do arquivo.
 *
 * `Blob.text()` já descarta o BOM ao decodificar — o arquivo continua com ele.
 */
const exported = async (spec: ReportSpec, result: ReportResult): Promise<string[]> => {
  const original = URL.createObjectURL;
  const captured = new Promise<string>((resolve) => {
    URL.createObjectURL = ((blob: Blob) => {
      void blob.text().then(resolve);
      return 'blob:x';
    }) as typeof URL.createObjectURL;
  });

  const { result: hook } = renderHook(() => useReportCsv(spec, result, 'Relatório'));
  hook.current();
  const text = await captured;
  URL.createObjectURL = original;

  return text.split('\r\n');
};

const TABULAR: ReportSpec = {
  v: 1,
  dataset: {
    table: 'clientes',
    dimensions: [
      { key: 'nome', path: 'values.nome', label: 'Nome' },
      { key: 'cidade', path: 'values.cidade', label: 'Cidade' },
    ],
    measures: [{ key: 'total', op: 'sum', path: 'values.valor', label: 'Faturamento' }],
  },
  shape: { kind: 'tabular', columns: ['nome', 'cidade'] },
};

const RESULT: ReportResult = {
  shape: 'tabular',
  columns: [],
  rows: [],
  records: [
    { id: '1', values: { nome: 'Ana', cidade: 'Recife', valor: 1000 } },
    { id: '2', values: { nome: 'Bruno, Jr.', cidade: 'Olinda', valor: 2000 } },
  ],
  totals: { values: { total: 3000 }, count: 2 },
  scanned: 2,
  complete: true,
  completeGroups: true,
  generatedAt: '2026-03-08T12:00:00.000Z',
};

describe('useReportCsv', () => {
  it('exporta os REGISTROS da lista simples — ler `rows` ali baixava um arquivo vazio', async () => {
    const lines = await exported(TABULAR, RESULT);

    expect(lines.slice(0, 3)).toEqual([
      'Nome,Cidade',
      'Ana,Recife',
      '"Bruno, Jr.",Olinda',
    ]);
  });

  /** A planilha sofria do mesmo mal da tela: o registro apontado saía como `[object Object]`. */
  it('a referência de VÁRIOS sai com os nomes, numa célula só', async () => {
    const spec: ReportSpec = {
      ...TABULAR,
      dataset: {
        ...TABULAR.dataset,
        dimensions: [{ key: 'socios', path: 'sociosIds', label: 'Sócios' }],
      },
      shape: { kind: 'tabular', columns: ['socios'] },
    };

    const lines = await exported(spec, {
      ...RESULT,
      records: [{ id: '1', sociosIds: [{ id: 'c1', nome: 'Ana' }, { id: 'c2', nome: 'Bruno' }] }],
      totals: null,
    });

    expect(lines.slice(0, 2)).toEqual(['Sócios', '"Ana, Bruno"']);
  });

  it('põe o total da lista simples num bloco à parte, com as colunas das medidas', async () => {
    const lines = await exported(TABULAR, RESULT);

    expect(lines.slice(3)).toEqual(['', ',Faturamento', 'core.reports/table.total,3000']);
  });
});
