import { describe, it, expect } from 'vitest';
import { parsePackage, serializePackage } from './packageSerialization';
import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';

const pkg: MarketplacePlugin = {
  manifest: { id: 'com.acme.x', version: '1.0.0', kernel: '^1.0.0', name: 'X' },
  summary: 'resumo',
  workflows: [],
};

describe('serializePackage/parsePackage', () => {
  it('round-trip preserva o pacote', () => {
    const result = parsePackage(serializePackage(pkg));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.package).toEqual(pkg);
  });

  it('rejeita JSON inválido', () => {
    const result = parsePackage('{ nope');
    expect(result).toEqual({ ok: false, error: expect.stringContaining('JSON') });
  });

  it('rejeita objeto sem manifest.id', () => {
    const result = parsePackage(JSON.stringify({ summary: 's', workflows: [] }));
    expect(result.ok).toBe(false);
  });

  it('rejeita quando falta a lista workflows', () => {
    const result = parsePackage(JSON.stringify({ manifest: { id: 'com.acme.x' }, summary: 's' }));
    expect(result.ok).toBe(false);
  });

  it('rejeita quando falta o summary', () => {
    const result = parsePackage(JSON.stringify({ manifest: { id: 'com.acme.x' }, workflows: [] }));
    expect(result.ok).toBe(false);
  });
});
