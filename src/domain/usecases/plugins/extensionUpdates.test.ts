import { describe, expect, it } from 'vitest';
import { hasExtensionUpdate } from './extensionUpdates';
import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';

const pkg = (version: string, summary = ''): MarketplacePlugin => ({
  manifest: { id: 'com.acme.docs', version, kernel: '^2.0.0', name: 'Docs' },
  summary,
  workflows: [],
} as unknown as MarketplacePlugin);

describe('hasExtensionUpdate', () => {
  it('sem ninguém oferecendo nada, não há atualização', () => {
    expect(hasExtensionUpdate('1.0.0', pkg('1.0.0'), { offeredVersions: [], builtin: null }))
      .toBe(false);
  });

  it('versão oferecida MAIOR que a instalada é atualização', () => {
    expect(hasExtensionUpdate('1.0.0', pkg('1.0.0'), { offeredVersions: ['1.1.0'], builtin: null }))
      .toBe(true);
  });

  it('versão oferecida igual ou menor não é atualização', () => {
    expect(hasExtensionUpdate('2.0.0', pkg('2.0.0'), { offeredVersions: ['2.0.0', '1.9.9'], builtin: null }))
      .toBe(false);
  });

  it('basta UMA das origens oferecer versão maior', () => {
    expect(hasExtensionUpdate('1.0.0', pkg('1.0.0'), { offeredVersions: ['0.9.0', '1.0.1'], builtin: null }))
      .toBe(true);
  });

  it('o embutido conta pelo CONTEÚDO, não pela versão — é o caso da extensão de primeira parte em desenvolvimento', () => {
    const installed = pkg('1.0.0', 'antes');
    expect(hasExtensionUpdate('1.0.0', installed, { offeredVersions: [], builtin: pkg('1.0.0', 'depois') }))
      .toBe(true);
  });

  it('embutido de conteúdo idêntico não acusa atualização a cada leitura', () => {
    expect(hasExtensionUpdate('1.0.0', pkg('1.0.0', 'igual'), { offeredVersions: [], builtin: pkg('1.0.0', 'igual') }))
      .toBe(false);
  });

  it('a ordem das chaves não conta: a cópia volta do Firestore ordenada, e comparar literal acusaria sempre', () => {
    const installed = { summary: 'x', workflows: [], manifest: { version: '1.0.0', id: 'com.acme.docs', name: 'Docs', kernel: '^2.0.0' } } as unknown as MarketplacePlugin;
    expect(hasExtensionUpdate('1.0.0', installed, { offeredVersions: [], builtin: pkg('1.0.0', 'x') }))
      .toBe(false);
  });
});
