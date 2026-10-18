import { describe, expect, it } from 'vitest';
import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import { installCollisionIssues, prefixChangeIssue } from './installCollisions';

const pkg = (overrides: Partial<MarketplacePlugin> = {}, dependencies?: Record<string, string>): MarketplacePlugin => ({
  summary: 'S',
  manifest: { id: 'com.acme.x', version: '1.0.0', kernel: '^2.0.0', name: 'X', ...(dependencies ? { dependencies } : {}) },
  workflows: [],
  ...overrides,
});

const screen = (key: string, sourceId?: string) => ({
  key, ...(sourceId ? { sourceId } : {}), titleSingular: 'A', titlePlural: 'As', icon: 'star', titleFieldKey: 'n', fields: [],
});

const empty = { screens: [], lookups: [], tagLists: [] };

describe('installCollisionIssues', () => {
  it('nome livre passa', () => {
    expect(installCollisionIssues(pkg({ screens: [screen('docAgreement', 'src')] }), empty)).toEqual([]);
  });

  it('a mesma tela (mesmo sourceId) é reinstalação ou adoção, e passa — mesmo numa chave com sufixo antigo', () => {
    const current = { ...empty, screens: [{ id: 'docAgreement_2', sourceId: 'src' }] };
    expect(installCollisionIssues(pkg({ screens: [screen('docAgreement', 'src')] }), current)).toEqual([]);
  });

  it('o nome tomado por OUTRA tela, lista ou etiqueta é recusa, em vez de virar "_2"', () => {
    const taken = { screens: [{ id: 'docAgreement' }], lookups: [{ collection: 'status' }], tagLists: [] };
    const issues = installCollisionIssues(pkg({ screens: [screen('docAgreement', 'src'), screen('status', 'src2')] }), taken);
    expect(issues.map((one) => one.messageParams?.name)).toEqual(['docAgreement', 'status']);
    expect(issues[0].message).toBe('@core.marketplace/install.collision.screen');
  });

  it('o nome do sistema é recusa', () => {
    expect(installCollisionIssues(pkg({ screens: [screen('settings', 'src')] }), empty)).toHaveLength(1);
  });

  it('lista de outra extensão sem relação é recusa; da dependência, do escritório ou dela mesma, compartilha', () => {
    const lists = (owner?: string) => ({ ...empty, lookups: [{ collection: 'status', ...(owner ? { ownerPluginIds: [owner] } : {}) }] });
    const declaring = (deps?: Record<string, string>) => pkg({ lookups: [{ collection: 'status', label: 'S' }] }, deps);

    expect(installCollisionIssues(declaring(), lists('com.other'))).toHaveLength(1);
    expect(installCollisionIssues(declaring({ 'com.other': '^1.0.0' }), lists('com.other'))).toEqual([]);
    expect(installCollisionIssues(declaring(), lists())).toEqual([]);
    expect(installCollisionIssues(declaring(), lists('com.acme.x'))).toEqual([]);
  });
});

describe('prefixChangeIssue', () => {
  const withPrefix = (prefix?: string) => ({ ...pkg(), manifest: { ...pkg().manifest, ...(prefix ? { prefix } : {}) } });

  it('trocar ou tirar o prefixo é recusa', () => {
    expect(prefixChangeIssue(withPrefix('beta'), withPrefix('acme'))?.messageParams).toEqual({ from: 'acme', to: 'beta' });
    expect(prefixChangeIssue(withPrefix(), withPrefix('acme'))).not.toBeNull();
  });

  it('manter, instalar pela primeira vez ou acrescentar a quem não tinha passa', () => {
    expect(prefixChangeIssue(withPrefix('acme'), withPrefix('acme'))).toBeNull();
    expect(prefixChangeIssue(withPrefix('acme'), undefined)).toBeNull();
    expect(prefixChangeIssue(withPrefix('acme'), withPrefix())).toBeNull();
  });
});
