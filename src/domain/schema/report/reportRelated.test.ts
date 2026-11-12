import { describe, it, expect } from 'vitest';
import { keepByRelated, relatedParentIds, relatedQuery } from './reportRelated';
import { deriveReportRequires } from './reportCapabilities';
import type { ReportSpec } from './reportSpec';

describe('com ou sem relacionados', () => {
  it('os ids apontados contam cada item da referência múltipla, e ignoram o vazio', () => {
    expect([...relatedParentIds([{ clienteId: 'a' }, { clienteId: ['b', 'c'] }, { clienteId: '' }, {}], 'clienteId')].sort())
      .toEqual(['a', 'b', 'c']);
  });

  it('com quem TEM, sem quem NÃO tem — e várias condições valem juntas', () => {
    const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(keepByRelated(rows, [{ mode: 'with', ids: new Set(['a', 'b']) }]).map((row) => row.id)).toEqual(['a', 'b']);
    expect(keepByRelated(rows, [{ mode: 'without', ids: new Set(['a']) }]).map((row) => row.id)).toEqual(['b', 'c']);
    expect(keepByRelated(rows, [
      { mode: 'with', ids: new Set(['a', 'b']) },
      { mode: 'without', ids: new Set(['a']) },
    ]).map((row) => row.id)).toEqual(['b']);
  });

  it('a leitura do relacionado traz só a ligação e o que a condição lê', () => {
    expect(relatedQuery({ table: 'pedidos', via: 'clienteId', mode: 'without', includeWhen: 'valor > 10' }, 2000))
      .toMatchObject({ table: 'pedidos', limit: 2000, projections: ['clienteId', 'valor'] });
  });

  it('o spec que usa pede o token próprio — o kernel que não o conhece recusa em vez de contar todos', () => {
    const spec: ReportSpec = {
      v: 1,
      dataset: { table: 'clientes', related: [{ table: 'pedidos', via: 'clienteId', mode: 'without' }], measures: [{ key: 'n', op: 'count' }] },
      shape: { kind: 'tabular', columns: [] },
    };
    expect(deriveReportRequires(spec)).toContain('dataset.related');
  });
});
