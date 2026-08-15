// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { FieldDefinition } from '../../domain/entities';

vi.mock('../../stores/useLookups', () => ({
  useLookups: () => ({
    getOptions: (collection: string) => (collection === 'situacoes'
      ? [{ key: 'pending', label: 'Pendente' }, { key: 'reviewed', label: 'Revisado' }]
      : []),
  }),
}));

vi.mock('./useReferenceOptions', () => ({
  useReferenceOptions: () => ({}),
}));

vi.mock('styled-components', () => ({
  useTheme: () => ({ colors: {} }),
}));

const { useCustomFieldListing, FILTER_RANGE_TO_SUFFIX } = await import('./useCustomFieldListing');

const dueDate: FieldDefinition = {
  key: 'dueDate',
  label: 'Vencimento',
  type: 'date',
  required: false,
  order: 0,
  filterable: true,
} as FieldDefinition;

const listing = () => renderHook(() => useCustomFieldListing([dueDate])).result.current;

const matches = (iso: string, tokens: Record<string, string[]>): boolean =>
  listing().matchesFilters({ dueDate: iso }, tokens);

/**
 * Numa listagem, a data que interessa é quase sempre um INTERVALO — o vencimento do mês, a
 * distribuição do ano. Enquanto o filtro declarado casava data exata, a tela de Financeiro tinha de
 * montar `dueDateFrom`/`dueDateTo` em código, e nenhuma tela do escritório alcançava o mesmo.
 */
describe('filtro de data por intervalo', () => {
  it('oferece as duas pontas do intervalo para o campo de data', () => {
    const keys = listing().filterDefs.map((def) => def.key);
    expect(keys).toEqual(['dueDate', `dueDate${FILTER_RANGE_TO_SUFFIX}`]);
    expect(listing().filterDefs.map((def) => def.label)).toEqual([
      'core.records/filter.range-from',
      'core.records/filter.range-to',
    ]);
  });

  it('as duas pontas são inclusivas', () => {
    const range = { dueDate: ['2026-08-01'], [`dueDate${FILTER_RANGE_TO_SUFFIX}`]: ['2026-08-31'] };
    expect(matches('2026-08-01', range)).toBe(true);
    expect(matches('2026-08-31', range)).toBe(true);
    expect(matches('2026-08-15', range)).toBe(true);
    expect(matches('2026-07-31', range)).toBe(false);
    expect(matches('2026-09-01', range)).toBe(false);
  });

  it('cada ponta vale sozinha', () => {
    expect(matches('2026-08-15', { dueDate: ['2026-08-01'] })).toBe(true);
    expect(matches('2026-07-15', { dueDate: ['2026-08-01'] })).toBe(false);
    expect(matches('2026-07-15', { [`dueDate${FILTER_RANGE_TO_SUFFIX}`]: ['2026-08-01'] })).toBe(true);
    expect(matches('2026-09-15', { [`dueDate${FILTER_RANGE_TO_SUFFIX}`]: ['2026-08-01'] })).toBe(false);
  });

  it('sem filtro nenhum, tudo passa; sem data no registro, o intervalo exclui', () => {
    expect(matches('2026-01-01', {})).toBe(true);
    expect(listing().matchesFilters({}, { dueDate: ['2026-08-01'] })).toBe(false);
  });
});

const status: FieldDefinition = {
  key: 'status',
  label: 'Situação',
  type: 'select',
  required: false,
  order: 0,
  filterable: true,
  lookupCollection: 'situacoes',
} as FieldDefinition;

const statusListing = () => renderHook(() => useCustomFieldListing([status])).result.current;

/**
 * O valor de uma opção é a CHAVE — o que está gravado no registro —, e o rótulo é só o que se lê. Na
 * lista cadastrada no escritório os dois são o mesmo texto, e por isso a troca passava despercebida;
 * na lista cuja chave difere do rótulo (a situação de um push é `pending`, e se lê "Pendente") o
 * filtro não casava registro nenhum e o chip exibia a chave crua.
 */
describe('filtro de lista de opções', () => {
  it('o filtro oferece o rótulo e vale pela chave', () => {
    expect(statusListing().filterDefs[0].options).toEqual([
      { value: 'pending', label: 'Pendente', color: undefined },
      { value: 'reviewed', label: 'Revisado', color: undefined },
    ]);
  });

  it('casa o registro pela chave gravada', () => {
    expect(statusListing().matchesFilters({ status: 'pending' }, { status: ['pending'] })).toBe(true);
    expect(statusListing().matchesFilters({ status: 'reviewed' }, { status: ['pending'] })).toBe(false);
  });

  it('o cartão exibe o rótulo, e não a chave', () => {
    expect(statusListing().displayValue({ status: 'pending' }, status)).toBe('Pendente');
  });
});
