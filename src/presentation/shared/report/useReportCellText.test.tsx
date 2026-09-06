// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createSchemaContext } from '../../../domain/schema/pathResolver';
import type { SchemaScreen } from '../../../domain/schema/pathResolver';
import type { FieldDefinition } from '../../../domain/entities/entitySchemas';
import type { ReportSpec } from '../../../domain/schema/report/reportSpec';

const field = (partial: Partial<FieldDefinition> & { key: string }): FieldDefinition => ({
  label: partial.key,
  type: 'text',
  required: false,
  order: 0,
  origin: 'design',
  ...partial,
});

const SCREENS: SchemaScreen[] = [
  {
    id: 'processos',
    collection: 'cases',
    titleSingular: 'Processo',
    titleFieldKey: 'title',
    fields: [
      field({ key: 'title' }),
      field({ key: 'dueDate', type: 'date' }),
      field({ key: 'activeIds', type: 'reference', refEntity: 'persons', multi: true }),
      field({ key: 'passiveId', type: 'reference', refEntity: 'persons' }),
    ],
  },
  {
    id: 'pessoas',
    collection: 'persons',
    titleSingular: 'Pessoa',
    titleFieldKey: 'name',
    fields: [field({ key: 'name' })],
  },
];

vi.mock('../useSchemaContext', () => ({
  useSchemaContext: () => createSchemaContext(SCREENS),
}));

const { useReportCellText } = await import('./useReportCellText');

const SPEC: ReportSpec = {
  v: 1,
  dataset: {
    table: 'cases',
    dimensions: [
      { key: 'titulo', path: 'title' },
      { key: 'ativo', path: 'activeIds' },
      { key: 'passivo', path: 'passiveId' },
      { key: 'venc', path: 'dueDate' },
      { key: 'venc_mes', path: 'dueDate', granularity: 'month', timeZone: 'UTC' },
    ],
  },
  shape: { kind: 'tabular', columns: ['titulo', 'ativo', 'passivo', 'venc', 'venc_mes'] },
};

const cellOf = (record: Record<string, unknown>, dimensionKey: string): string => {
  const { result } = renderHook(() => useReportCellText(SPEC));
  const dimension = (SPEC.dataset.dimensions ?? []).find((one) => one.key === dimensionKey);
  return result.current(record, dimension!);
};

/**
 * O defeito que chegou à tela: a coluna de uma referência de VÁRIOS mostrava
 * `[object Object],[object Object]`. A linha chega hidratada, e o `String` de um registro não é o
 * nome dele — é o dado inteiro perdido sem uma palavra dizendo que se perdeu.
 */
describe('useReportCellText', () => {
  it('a referência de VÁRIOS vira a lista dos nomes', () => {
    const text = cellOf(
      { id: '1', activeIds: [{ id: 'p1', name: 'Ana' }, { id: 'p2', name: 'Bruno' }] },
      'ativo',
    );

    expect(text).toBe('Ana, Bruno');
  });

  it('a referência de UM vira o nome, e não o registro inteiro', () => {
    expect(cellOf({ id: '1', passiveId: { id: 'p3', name: 'Carla' } }, 'passivo')).toBe('Carla');
  });

  it('registro apontado sem título cai em "sem título", nunca no objeto cru', () => {
    const text = cellOf({ id: '1', passiveId: { id: 'p4' } }, 'passivo');

    expect(text).toContain('record.untitled');
    expect(text).not.toContain('object');
  });

  it('o campo comum continua passando intacto', () => {
    expect(cellOf({ id: '1', title: 'Ação de indenização' }, 'titulo')).toBe('Ação de indenização');
  });

  it('ausência é célula vazia', () => {
    expect(cellOf({ id: '1' }, 'passivo')).toBe('');
    expect(cellOf({ id: '1', activeIds: [] }, 'ativo')).toBe('');
  });

  /**
   * A data chegava do servidor como o `{}` que o codificador da callable faz de um `Date`, e a
   * coluna mostrava `[object Object]`. Ela atravessa como texto ISO, e aqui vira data de verdade —
   * o texto ISO cru é o formato do arquivo, não o que se lê numa tabela.
   */
  it('a data vira data, e não o texto ISO cru', () => {
    const text = cellOf({ id: '1', dueDate: '2026-03-01T12:00:00.000Z' }, 'venc');

    expect(text).toContain('2026');
    expect(text).not.toContain('T12:00');
    expect(text).not.toContain('object');
  });

  it('o corte declarado é honrado — quem escolheu "Por mês" vê o mês', () => {
    expect(cellOf({ id: '1', dueDate: '2026-03-01T12:00:00.000Z' }, 'venc_mes')).toBe('2026-03');
  });
});
