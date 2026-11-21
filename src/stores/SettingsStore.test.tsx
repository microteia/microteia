// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { SettingsScope, SettingsValues } from '../domain/schema/settings';

let emit: (scope: SettingsScope, values: SettingsValues) => void = () => undefined;
const settingsRepository = {
  subscribe: (...args: [string, string, typeof emit]) => {
    emit = args[2];
    return () => undefined;
  },
  save: vi.fn(async () => undefined),
};

vi.mock('../infrastructure/di/useDI', () => ({ useDI: () => ({ settingsRepository }) }));
vi.mock('./useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('./useTenant', () => ({ useTenant: () => ({ currentTenant: { id: 't1' } }) }));

import { SettingsStoreProvider } from './SettingsStore';
import { useSettings } from './useSettings';

const wrapper = ({ children }: { children: React.ReactNode }) => <SettingsStoreProvider>{children}</SettingsStoreProvider>;

describe('SettingsStore — os dois escopos (#15)', () => {
  it('isLoading cai com o primeiro escopo; allScopesLoaded só com os dois', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.allScopesLoaded).toBe(false);

    act(() => emit('tenant', { 'workspace.restoreTabs': true }));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.allScopesLoaded).toBe(false);

    act(() => emit('user', { 'workspace.restoreTabs': false }));
    expect(result.current.allScopesLoaded).toBe(true);
    expect(result.current.values.user['workspace.restoreTabs']).toBe(false);
  });
});
