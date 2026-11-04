// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { EntityRecord } from '../../../domain/entities';
import type { RecordQueryClause } from '../../../domain/services/recordListQuery';

const store: {
  known: Record<string, EntityRecord[]>;
  ensureRecords: ReturnType<typeof vi.fn>;
  countRecords: ReturnType<typeof vi.fn>;
} = {
  known: {},
  ensureRecords: vi.fn(),
  countRecords: vi.fn(async (_collection: string, clauses: readonly RecordQueryClause[]) => (clauses[0]?.value === 'open' ? 7 : 2)),
};

vi.mock('../../../stores/useRecords', () => ({
  useRecords: () => ({
    knownRecordsByCollection: store.known,
    ensureRecords: store.ensureRecords,
    countRecords: store.countRecords,
  }),
}));

const { useRecordsByIds } = await import('./useRecordsByIds');
const { useRecordCounts } = await import('./useRecordCounts');
const { storeEvents, StoreEvents } = await import('../../../infrastructure/events/StoreEventEmitter');

const person = (id: string, name: string) => ({ id, collection: 'persons', name }) as unknown as EntityRecord;

beforeEach(() => {
  store.known = {};
  store.ensureRecords.mockClear();
  store.countRecords.mockClear();
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
    expect(store.countRecords).toHaveBeenCalledWith('cases', [{ field: 'status', op: '==', value: 'open' }]);
  });

  it('reconta quando um registro é gravado nesta sessão', async () => {
    const { result } = renderHook(() => useRecordCounts('cases', groups));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const before = store.countRecords.mock.calls.length;

    act(() => storeEvents.emit(StoreEvents.RECORDS_UPDATED));

    await waitFor(() => expect(store.countRecords.mock.calls.length).toBe(before + 2));
  });
});
