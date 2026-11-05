// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { EntityRecord } from '../../../domain/entities';
import type { RecordCountSpec, RecordQuerySpec } from '../../../domain/services/recordListQuery';

const store: {
  known: Record<string, EntityRecord[]>;
  ensureRecords: ReturnType<typeof vi.fn>;
  countRecords: ReturnType<typeof vi.fn>;
  watched: RecordQuerySpec[];
  delivered: EntityRecord[] | undefined;
} = {
  known: {},
  ensureRecords: vi.fn(),
  countRecords: vi.fn(async (spec: RecordCountSpec) => (spec.allOf[0]?.value === 'open' ? 7 : 2)),
  watched: [],
  delivered: undefined,
};

vi.mock('../../../stores/useRecords', () => ({
  useRecords: () => ({
    knownRecordsByCollection: store.known,
    ensureRecords: store.ensureRecords,
    countRecords: store.countRecords,
  }),
}));

vi.mock('../../../stores/useRecordQuery', () => ({
  useRecordQuery: (spec: RecordQuerySpec | null) => {
    if (spec) store.watched.push(spec);
    return { records: store.delivered ?? [], loaded: store.delivered !== undefined };
  },
}));

const { useRecordsByIds } = await import('./useRecordsByIds');
const { useRecordCounts } = await import('./useRecordCounts');
const { useRecordsWhere } = await import('./useRecordsWhere');
const { storeEvents, StoreEvents } = await import('../../../infrastructure/events/StoreEventEmitter');

const person = (id: string, name: string) => ({ id, collection: 'persons', name }) as unknown as EntityRecord;

beforeEach(() => {
  store.known = {};
  store.ensureRecords.mockClear();
  store.countRecords.mockClear();
  store.watched = [];
  store.delivered = undefined;
});

describe('useRecordsByIds', () => {
  it('pede ao store os ids que faltam e devolve só os pedidos que ele conhece', () => {
    store.known = { persons: [person('p1', 'Maria'), person('p2', 'João'), person('p3', 'Outro')] };
    const { result } = renderHook(() => useRecordsByIds('persons', ['p2', 'p1', 'p9', 'p1']));

    expect(store.ensureRecords).toHaveBeenCalledWith('persons', ['p1', 'p2', 'p9']);
    expect(Object.keys(result.current).sort()).toEqual(['p1', 'p2']);
    expect((result.current.p1 as unknown as { name: string }).name).toBe('Maria');
  });
});

describe('useRecordCounts', () => {
  const groups = { open: [{ field: 'status', value: 'open' }], closed: [{ field: 'status', value: 'closed' }] };

  it('conta cada grupo no servidor, com igualdade por padrão', async () => {
    const { result } = renderHook(() => useRecordCounts('cases', groups));
    expect(result.current.loading).toBe(true);
    expect(result.current.counts).toEqual({ open: null, closed: null });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.counts).toEqual({ open: 7, closed: 2 });
    expect(store.countRecords).toHaveBeenCalledWith({ collection: 'cases', allOf: [{ field: 'status', op: '==', value: 'open' }], range: null });
  });

  it('o intervalo de dia vai junto da igualdade — os vencidos: pendente e vencimento até ontem', async () => {
    const { result } = renderHook(() => useRecordCounts('deadlines', {
      vencidos: [{ field: 'status', value: 'Pendente' }, { field: 'dueDate', to: '2026-11-04' }],
    }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(store.countRecords).toHaveBeenCalledWith({
      collection: 'deadlines',
      allOf: [{ field: 'status', op: '==', value: 'Pendente' }],
      range: { field: 'dueDate', from: null, to: '2026-11-04' },
    });
  });

  it('dois intervalos, ou um sem ponta, não contam nada — e não contam TUDO em silêncio', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { result } = renderHook(() => useRecordCounts('deadlines', {
      dois: [{ field: 'dueDate', to: '2026-11-04' }, { field: 'createdAt', from: '2026-01-01' }],
      vazio: [{ field: 'dueDate', from: '', to: null }],
    }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.counts).toEqual({ dois: null, vazio: null });
    expect(store.countRecords).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('reconta quando um registro é gravado nesta sessão', async () => {
    const { result } = renderHook(() => useRecordCounts('cases', groups));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const before = store.countRecords.mock.calls.length;

    act(() => storeEvents.emit(StoreEvents.RECORDS_UPDATED));

    await waitFor(() => expect(store.countRecords.mock.calls.length).toBe(before + 2));
  });
});

describe('useRecordsWhere', () => {
  const deadline = (id: string, status: string, dueDate: Date) => ({ id, collection: 'deadlines', status, dueDate }) as unknown as EntityRecord;
  const noon = (day: string) => new Date(`${day}T12:00:00.000Z`);

  it('consulta no servidor com as condições, a ordem e o limite pedidos', () => {
    renderHook(() => useRecordsWhere('deadlines', [{ field: 'status', value: 'Pendente' }, { field: 'dueDate', from: '2026-11-05', to: '2026-11-12' }], {
      orderBy: { field: 'dueDate' },
      limit: 6,
    }));
    expect(store.watched.at(-1)).toEqual({
      collection: 'deadlines',
      limit: 6,
      anyOf: [],
      allOf: [{ field: 'status', op: '==', value: 'Pendente' }],
      range: { field: 'dueDate', from: '2026-11-05', to: '2026-11-12' },
      orderBy: { field: 'dueDate', dir: 'asc' },
    });
  });

  /**
   * Quem só lê o que o nomeia recebe a janela restrita no lugar da consulta: é o filtro em memória que
   * dá a ele a mesma resposta — sem ele, o cartão de "vencem esta semana" mostraria qualquer prazo.
   */
  it('confere em memória o que voltou, na ordem pedida, até o limite', () => {
    store.delivered = [
      deadline('fora', 'Pendente', noon('2026-12-01')),
      deadline('b', 'Pendente', noon('2026-11-09')),
      deadline('feito', 'Cumprido', noon('2026-11-06')),
      deadline('a', 'Pendente', noon('2026-11-05')),
      deadline('c', 'Pendente', noon('2026-11-12')),
    ];
    const { result } = renderHook(() => useRecordsWhere('deadlines', [{ field: 'status', value: 'Pendente' }, { field: 'dueDate', from: '2026-11-05', to: '2026-11-12' }], {
      orderBy: { field: 'dueDate', dir: 'asc' },
      limit: 2,
    }));
    expect(result.current.records.map((record) => record.id)).toEqual(['a', 'b']);
    expect(result.current.hasMore).toBe(true);
    expect(result.current.loading).toBe(false);
  });

  it('o limite tem teto: é consulta de cartão, a listagem tem paginate', () => {
    renderHook(() => useRecordsWhere('deadlines', [], { limit: 10_000 }));
    expect(store.watched.at(-1)?.limit).toBe(500);
  });
});
