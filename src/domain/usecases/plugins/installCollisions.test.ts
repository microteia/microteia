import { describe, expect, it } from 'vitest';
import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import { fieldCollisionIssues, installCollisionIssues, prefixChangeIssue } from './installCollisions';

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

describe('fieldCollisionIssues — o campo de terceiros nunca é substituído calado', () => {
  const field = (key: string) => ({ key, label: key, type: 'text' as const, required: false, order: 0 });
  const declaring = (...keys: string[]) => pkg({ screens: [{ ...screen('pedidos', 'src-pedidos'), fields: keys.map(field) }] });
  const installed = (fields: { key: string; origin?: string; ownerPluginId?: string | null }[], owners = ['com.acme.x']) => ({
    id: 'pedidos', sourceId: 'src-pedidos', ownerPluginIds: owners, fields,
  });

  it('a versão nova que declara a chave de um campo do escritório é recusada, nomeando tela e campo', () => {
    const issues = fieldCollisionIssues(declaring('nome', 'motivo'), [installed([
      { key: 'nome', origin: 'plugin', ownerPluginId: 'com.acme.x' },
      { key: 'motivo', origin: 'design' },
    ])]);
    expect(issues).toEqual([{
      message: '@core.marketplace/install.collision.field',
      messageParams: { screen: 'pedidos', field: 'motivo' },
    }]);
  });

  it('a chave do campo que outra extensão complementou é recusa que nomeia a outra extensão', () => {
    const issues = fieldCollisionIssues(declaring('nome', 'motivo'), [installed([
      { key: 'motivo', origin: 'plugin', ownerPluginId: 'com.other' },
    ])]);
    expect(issues[0].message).toBe('@core.marketplace/install.collision.field.extension');
    expect(issues[0].messageParams).toEqual({ screen: 'pedidos', field: 'motivo', extension: 'com.other' });
  });

  it('chaves que não se cruzam passam: o campo de terceiros é preservado pela atualização', () => {
    expect(fieldCollisionIssues(declaring('nome', 'motivo'), [installed([
      { key: 'nome', origin: 'plugin', ownerPluginId: 'com.acme.x' },
      { key: 'observacao', origin: 'design' },
      { key: 'nota', origin: 'plugin', ownerPluginId: 'com.other' },
    ])])).toEqual([]);
  });

  it('a primeira instalação sobre uma tela do escritório (adoção) assume os campos de mesma chave', () => {
    expect(fieldCollisionIssues(declaring('motivo'), [installed([{ key: 'motivo', origin: 'design' }], [])])).toEqual([]);
  });

  it('o campo de outro DONO da mesma tela e o campo de pacote antigo sem carimbo não são de terceiros', () => {
    expect(fieldCollisionIssues(declaring('motivo', 'nome'), [installed([
      { key: 'motivo', origin: 'plugin', ownerPluginId: 'com.co-owner' },
      { key: 'nome', origin: 'plugin' },
    ], ['com.co-owner', 'com.acme.x'])])).toEqual([]);
  });

  it('o complemento que cairia sobre um campo da tela alvo é recusado — do dono dela ou do escritório', () => {
    const patching = pkg({ screenPatches: [{ target: 'pedidos', fields: [field('motivo'), field('nota')] }] });
    const target = {
      id: 'pedidos', ownerPluginIds: ['com.owner'],
      fields: [
        { key: 'motivo', origin: 'plugin', ownerPluginId: 'com.owner' },
        { key: 'nota', origin: 'design' },
      ],
    };
    expect(fieldCollisionIssues(patching, [target]).map((one) => one.message)).toEqual([
      '@core.marketplace/install.collision.field.extension',
      '@core.marketplace/install.collision.field',
    ]);
  });

  it('o complemento reaplicado sobre os próprios campos passa', () => {
    const patching = pkg({ screenPatches: [{ target: 'pedidos', fields: [field('nota')] }] });
    const target = { id: 'pedidos', ownerPluginIds: ['com.owner'], fields: [{ key: 'nota', origin: 'plugin', ownerPluginId: 'com.acme.x' }] };
    expect(fieldCollisionIssues(patching, [target])).toEqual([]);
  });

  it('installCollisionIssues inclui a recusa de campo', () => {
    const current = { ...empty, screens: [installed([{ key: 'motivo', origin: 'design' }])] };
    expect(installCollisionIssues(declaring('motivo'), current)).toHaveLength(1);
  });
});
