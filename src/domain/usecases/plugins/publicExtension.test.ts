import { describe, it, expect } from 'vitest';
import { extensionHasCode, initialPublicStatus, isVersionGreater } from './publicExtension';
import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';

const base: MarketplacePlugin = {
  manifest: { id: 'com.acme.x', version: '1.0.0', kernel: '^1.0.0', name: 'X' },
  summary: '', workflows: [],
};

describe('publicExtension helpers', () => {
  it('extensão com views tem código e entra pending; sem views entra approved', () => {
    const withCode: MarketplacePlugin = { ...base, views: [{ key: 'k', title: 'K', icon: 'layoutGrid', source: 'export default () => null;' }] };
    expect(extensionHasCode(withCode)).toBe(true);
    expect(initialPublicStatus(withCode)).toBe('pending');
    expect(extensionHasCode(base)).toBe(false);
    expect(initialPublicStatus(base)).toBe('approved');
  });

  it('isVersionGreater compara semver', () => {
    expect(isVersionGreater('1.2.0', '1.1.9')).toBe(true);
    expect(isVersionGreater('1.0.0', '1.0.0')).toBe(false);
    expect(isVersionGreater('1.0.0', '1.0.1')).toBe(false);
    expect(isVersionGreater('2.0.0', '1.9.9')).toBe(true);
    expect(isVersionGreater('abc', '1.0.0')).toBe(false);
  });
});
