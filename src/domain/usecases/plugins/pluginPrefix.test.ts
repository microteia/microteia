import { describe, expect, it } from 'vitest';
import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import { lacksPackagePrefix, packagePrefixIssues } from './pluginPrefix';

const pkg = (prefix: string | undefined, overrides: Partial<MarketplacePlugin> = {}): MarketplacePlugin => ({
  summary: 'S',
  manifest: { id: 'com.acme.x', version: '1.0.0', kernel: '^2.50.0', name: 'X', ...(prefix !== undefined ? { prefix } : {}) },
  workflows: [],
  ...overrides,
});

const full: Partial<MarketplacePlugin> = {
  screens: [{ key: 'acme_cliente', titleSingular: 'C', titlePlural: 'Cs', icon: 'star', titleFieldKey: 'n', fields: [] }],
  lookups: [{ collection: 'acme_status', label: 'S' }],
  workflows: [{ templateId: 'acme-avisar', name: 'A', eventName: 'workflow.called', version: 1, condition: { kind: 'AlwaysTrue' }, steps: [] }],
};

describe('packagePrefixIssues', () => {
  it('sem prefixo declarado, nada é cobrado — e o check avisa da falta', () => {
    expect(packagePrefixIssues(pkg(undefined, { screens: [{ ...full.screens![0], key: 'cliente' }] }))).toEqual([]);
    expect(lacksPackagePrefix(pkg(undefined, full))).toBe(true);
    expect(lacksPackagePrefix(pkg(undefined))).toBe(false);
  });

  it('com prefixo, todo nome criado com ele passa', () => {
    expect(packagePrefixIssues(pkg('acme', full))).toEqual([]);
  });

  it('o nome que escapa é recusa, dizendo como ele deveria começar', () => {
    const issues = packagePrefixIssues(pkg('acme', {
      ...full,
      screens: [{ ...full.screens![0], key: 'cliente' }],
      workflows: [{ ...full.workflows![0], templateId: 'avisar' }],
    }));
    expect(issues.map((one) => one.messageParams)).toEqual([
      { name: 'cliente', head: 'acme_' },
      { name: 'avisar', head: 'acme-' },
    ]);
  });

  it('a lista do kernel não é do pacote, e não é cobrada', () => {
    expect(packagePrefixIssues(pkg('acme', { lookups: [{ collection: 'documentTypes', label: 'T' }] }))).toEqual([]);
  });

  it('prefixo fora do formato é recusa', () => {
    expect(packagePrefixIssues(pkg('ACME'))).toEqual([
      { message: '@core.marketplace/issue.prefix.invalid', messageParams: { prefix: 'ACME' } },
    ]);
  });
});
