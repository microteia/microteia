import { describe, it, expect } from 'vitest';
import { packageFingerprint, parsePackage, serializePackage } from './packageSerialization';
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
    expect(result).toEqual({ ok: false, error: '@core.marketplace/issue.package.not-json' });
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

/**
 * A cópia instalada volta do Firestore com as chaves dos mapas em outra ordem e sem as ausentes.
 * Comparar conteúdo por `JSON.stringify` direto acusaria diferença sempre — era o que fazia a
 * extensão do catálogo embutido pedir "Atualização" logo depois de instalada.
 */
describe('packageFingerprint', () => {
  const original: MarketplacePlugin = {
    manifest: { id: 'com.acme.x', version: '1.0.0', kernel: '^1.0.0', name: 'X' },
    summary: 'resumo',
    workflows: [],
    screens: [{
      key: 'venda', titleSingular: 'Venda', titlePlural: 'Vendas', icon: 'apps', titleFieldKey: 'nome',
      fields: [{ key: 'nome', label: 'Nome', type: 'text', required: true, order: 0 }],
    }],
  };

  it('ignora a ordem das chaves', () => {
    const reordered = JSON.parse(JSON.stringify({
      workflows: original.workflows,
      summary: original.summary,
      screens: original.screens?.map(({ icon, ...rest }) => ({ ...rest, icon })),
      manifest: { name: 'X', kernel: '^1.0.0', version: '1.0.0', id: 'com.acme.x' },
    })) as MarketplacePlugin;
    expect(packageFingerprint(reordered)).toBe(packageFingerprint(original));
  });

  it('ignora propriedades ausentes vs. undefined', () => {
    const withUndefined = { ...original, startup: undefined } as MarketplacePlugin;
    expect(packageFingerprint(withUndefined)).toBe(packageFingerprint(original));
  });

  it('acusa diferença real de conteúdo', () => {
    const changed: MarketplacePlugin = { ...original, summary: 'outro' };
    expect(packageFingerprint(changed)).not.toBe(packageFingerprint(original));
  });
});
