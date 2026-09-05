// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('./useReportGroupLabels', () => ({
  useReportGroupLabels: () => (entry: { key: string } | undefined) => entry?.key ?? '—',
}));

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

  it('põe o total da lista simples num bloco à parte, com as colunas das medidas', async () => {
    const lines = await exported(TABULAR, RESULT);

    expect(lines.slice(3)).toEqual(['', ',Faturamento', 'core.reports/table.total,3000']);
  });
});
