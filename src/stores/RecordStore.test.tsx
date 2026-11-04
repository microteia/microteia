// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { EntityRecord } from '../domain/entities';

interface Subscription {
  collection: string;
  limit: number | undefined;
  deliver: (records: EntityRecord[]) => void;
  active: boolean;
}

const subscriptions: Subscription[] = [];

const repository = {
  subscribe: vi.fn((
    _tenantId: string,
    collection: string,
    onUpdate: (records: EntityRecord[]) => void,
    _onError: unknown,
    _visibleTo: unknown,
    limit?: number,
  ) => {
    const subscription: Subscription = { collection, limit, deliver: onUpdate, active: true };
    subscriptions.push(subscription);
    return () => { subscription.active = false; };
  }),
};

vi.mock('./useTenant', () => ({ useTenant: () => ({ currentTenant: { id: 't1', ownerId: 'u1' }, members: [] }) }));
vi.mock('./useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', photoURL: null }, userRole: 'USER', effectiveName: 'Fulano' }) }));
vi.mock('./useScreenDefinitions', () => ({ useScreenDefinitions: () => ({ definitions: [], dynamicScreens: [] }) }));
vi.mock('../infrastructure/di/useDI', () => ({
  useDI: () => ({ recordRepository: repository, recordNoteRepository: {}, recordDocumentRepository: {} }),
}));

const { RecordStoreProvider } = await import('./RecordStore');
const { useRecords } = await import('./useRecords');

const wrapper = ({ children }: { children: React.ReactNode }) => <RecordStoreProvider>{children}</RecordStoreProvider>;
const live = (collection: string) => subscriptions.filter((subscription) => subscription.collection === collection && subscription.active);

beforeEach(() => {
  vi.useFakeTimers();
  subscriptions.length = 0;
  repository.subscribe.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('RecordStore — a coleção é assinada enquanto alguém a pede', () => {
  it('sem pedido nenhum, nada é lido', () => {
    renderHook(() => useRecords(), { wrapper });
    expect(repository.subscribe).not.toHaveBeenCalled();
  });

  it('dois pedidos da mesma coleção são uma assinatura só, com a maior janela', () => {
    const { result } = renderHook(() => useRecords(), { wrapper });
    act(() => { result.current.demand(['cases'], 50); });
    act(() => { result.current.demand(['cases'], 500); });

    expect(live('cases')).toHaveLength(1);
    expect(live('cases')[0].limit).toBe(500);
  });

  it('a coleção só aparece carregada depois que a assinatura responde', () => {
    const { result } = renderHook(() => useRecords(), { wrapper });
    act(() => { result.current.demand(['cases'], 500); });
    expect(result.current.loadedCollections.has('cases')).toBe(false);
    expect(result.current.isLoading).toBe(true);

    act(() => live('cases')[0].deliver([{ id: 'c1', collection: 'cases' } as EntityRecord]));
    expect(result.current.loadedCollections.has('cases')).toBe(true);
    expect(result.current.recordsByCollection.cases.map((record) => record.id)).toEqual(['c1']);
  });

  it('soltar espera a carência: trocar de aba e voltar não reassina', () => {
    const { result } = renderHook(() => useRecords(), { wrapper });
    let release = () => undefined as void;
    act(() => { release = result.current.demand(['cases'], 500); });
    act(() => live('cases')[0].deliver([]));

    act(() => release());
    act(() => { vi.advanceTimersByTime(30_000); });
    act(() => { result.current.demand(['cases'], 500); });
    expect(repository.subscribe).toHaveBeenCalledTimes(1);
  });

  it('depois da carência, sem ninguém pedindo, a assinatura é desfeita e a coleção sai da memória', () => {
    const { result } = renderHook(() => useRecords(), { wrapper });
    let release = () => undefined as void;
    act(() => { release = result.current.demand(['cases'], 500); });
    act(() => live('cases')[0].deliver([{ id: 'c1', collection: 'cases' } as EntityRecord]));

    act(() => release());
    act(() => { vi.advanceTimersByTime(61_000); });

    expect(live('cases')).toHaveLength(0);
    expect(result.current.recordsByCollection.cases).toBeUndefined();
  });
});
