import { describe, it, expect } from 'vitest';
import type { QualifiedContribution } from '../../domain/schema/plugin/contribution';
import { navigablePages, resolvePageContribution, visibleNavItems } from './resolveUiContributions';
import type { UiNavMetadata, UiPageMetadata } from '../../domain/schema/ui/uiExtensionPoints';

const pageContribution = (id: string, metadata: Partial<UiPageMetadata>): QualifiedContribution => ({
  pluginId: 'com.acme.x',
  point: 'ui.page',
  id,
  apiVersion: '1.0.0',
  metadata: { key: '', title: id, icon: 'apps', ...metadata } as unknown as Record<string, unknown>,
});

const navContribution = (metadata: Partial<UiNavMetadata>): QualifiedContribution => ({
  pluginId: 'com.acme.x',
  point: 'ui.nav',
  id: metadata.key ?? 'x',
  apiVersion: '1.0.0',
  metadata: { key: 'x', label: 'X', icon: 'apps', order: 0, ...metadata } as unknown as Record<string, unknown>,
});

describe('resolvePageContribution', () => {
  it('devolve undefined para lista vazia', () => {
    expect(resolvePageContribution([], 'qualquer')).toBeUndefined();
  });

  it('casa por chave exata', () => {
    const pages = [pageContribution('a', { key: 'persons' }), pageContribution('b', { key: 'cases' })];
    expect(resolvePageContribution(pages, 'cases')?.id).toBe('b');
  });

  it('a chave exata vence o prefixo que também casaria', () => {
    const pages = [
      pageContribution('prefixo', { keyPrefix: 'dyn' }),
      pageContribution('exata', { key: 'dyn' }),
    ];
    expect(resolvePageContribution(pages, 'dyn')?.id).toBe('exata');
  });

  it('casa por prefixo', () => {
    const pages = [pageContribution('a', { keyPrefix: 'view-person:' })];
    expect(resolvePageContribution(pages, 'view-person:123')?.id).toBe('a');
  });

  it('prefere o prefixo mais longo, independente da ordem da lista', () => {
    const curto = pageContribution('curto', { keyPrefix: 'new-person:' });
    const longo = pageContribution('longo', { keyPrefix: 'new-person:clone:' });

    expect(resolvePageContribution([curto, longo], 'new-person:clone:1')?.id).toBe('longo');
    expect(resolvePageContribution([longo, curto], 'new-person:clone:1')?.id).toBe('longo');
  });

  it('não casa prefixo parcial no meio da chave', () => {
    const pages = [pageContribution('a', { keyPrefix: 'person:' })];
    expect(resolvePageContribution(pages, 'view-person:1')).toBeUndefined();
  });
});

describe('navigablePages', () => {
  const pages = [
    pageContribution('a', { key: 'persons' }),
    pageContribution('b', { keyPrefix: 'view-person:' }),
    pageContribution('c', { key: 'access-management', requiredRole: 'SYSTEM' }),
  ];

  it('exclui abas paramétricas e telas sem chave', () => {
    expect(navigablePages(pages, 'SYSTEM').map((p) => p.key)).toEqual(['persons', 'access-management']);
  });

  it('esconde tela que exige papel que o usuário não tem', () => {
    expect(navigablePages(pages, 'USER').map((p) => p.key)).toEqual(['persons']);
  });

  it('SYSTEM enxerga tudo', () => {
    expect(navigablePages(pages, 'SYSTEM')).toHaveLength(2);
  });

  it('trata papel nulo como sem permissão', () => {
    expect(navigablePages(pages, null).map((p) => p.key)).toEqual(['persons']);
  });
});

describe('visibleNavItems', () => {
  const items = [
    navContribution({ key: 'b', order: 20 }),
    navContribution({ key: 'a', order: 10 }),
    navContribution({ key: 'admin', order: 30, requiresTenantAdmin: true }),
  ];

  it('ordena por order, não pela ordem das contribuições', () => {
    const visible = visibleNavItems(items, { isSystemAdmin: true, isTenantAdmin: true });
    expect(visible.map((item) => item.key)).toEqual(['a', 'b', 'admin']);
  });

  it('esconde item de admin de usuário comum', () => {
    const visible = visibleNavItems(items, { isSystemAdmin: false, isTenantAdmin: false });
    expect(visible.map((item) => item.key)).toEqual(['a', 'b']);
  });

  it('admin do escritório enxerga o item restrito', () => {
    const visible = visibleNavItems(items, { isSystemAdmin: false, isTenantAdmin: true });
    expect(visible.map((item) => item.key)).toContain('admin');
  });

  it('admin do sistema enxerga o item restrito', () => {
    const visible = visibleNavItems(items, { isSystemAdmin: true, isTenantAdmin: false });
    expect(visible.map((item) => item.key)).toContain('admin');
  });
});
