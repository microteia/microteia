// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useExtensionName } from './useExtensionName';

vi.mock('../../../stores/useInstalledExtensions', () => ({
  useInstalledExtensions: () => ({
    installed: [
      { id: 'com.acme.billing', package: { manifest: { name: '@com.acme.billing/name' } } },
      { id: 'com.acme.blank', package: { manifest: { name: '' } } },
    ],
  }),
}));
vi.mock('../i18n/useT', () => ({
  useLabel: () => (value: string | null | undefined) => (value === '@com.acme.billing/name' ? 'Billing' : value ?? ''),
}));

describe('useExtensionName', () => {
  it('resolve o nome declarado da extensão instalada', () => {
    const { result } = renderHook(() => useExtensionName());
    expect(result.current('com.acme.billing')).toBe('Billing');
  });

  it('devolve o id quando a extensão já não está instalada ou não tem nome', () => {
    const { result } = renderHook(() => useExtensionName());
    expect(result.current('com.acme.gone')).toBe('com.acme.gone');
    expect(result.current('com.acme.blank')).toBe('com.acme.blank');
  });

  it('devolve null para o artefato do escritório', () => {
    const { result } = renderHook(() => useExtensionName());
    expect(result.current(null)).toBeNull();
    expect(result.current(undefined)).toBeNull();
  });
});
