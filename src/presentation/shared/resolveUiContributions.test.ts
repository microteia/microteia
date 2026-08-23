import { describe, it, expect } from 'vitest';
import type { QualifiedContribution } from '../../domain/schema/plugin/contribution';
import {
  navigablePages,
  resolvePageContribution,
  visibleNavItems,
  visibleSettingsSections,
} from './resolveUiContributions';
import type { SettingsSection } from '../../domain/schema/settings';
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

const canAll = () => true;
const canNothing = () => false;
const canOnly = (...granted: string[]) => (required: string[]) =>
  required.some((permission) => granted.includes(permission));

describe('navigablePages', () => {
  const pages = [
    pageContribution('a', { key: 'persons' }),
    pageContribution('b', { keyPrefix: 'view-person:' }),
    pageContribution('c', { key: 'audit-logs', requiredPermissions: ['audit.read'] }),
    pageContribution('d', { key: 'access-management', requiresSystemAdmin: true }),
  ];

  it('exclui abas paramétricas e telas sem chave', () => {
    expect(navigablePages(pages, canAll, true).map((p) => p.key)).toEqual([
      'persons',
      'audit-logs',
      'access-management',
    ]);
  });

  it('esconde tela cuja permissão o usuário não tem', () => {
    expect(navigablePages(pages, canNothing, false).map((p) => p.key)).toEqual(['persons']);
  });

  it('basta UMA das permissões exigidas', () => {
    expect(navigablePages(pages, canOnly('audit.read'), false).map((p) => p.key)).toEqual([
      'persons',
      'audit-logs',
    ]);
  });

  it('a tela do administrador GLOBAL não se abre por permissão de escritório', () => {
    expect(navigablePages(pages, canAll, false).map((p) => p.key)).not.toContain('access-management');
  });
});

describe('visibleNavItems', () => {
  const items = [
    navContribution({ key: 'b', order: 20 }),
    navContribution({ key: 'a', order: 10 }),
    navContribution({ key: 'audit', order: 30, requiredPermissions: ['audit.read'] }),
  ];

  it('ordena por order, não pela ordem das contribuições', () => {
    expect(visibleNavItems(items, canAll).map((item) => item.key)).toEqual(['a', 'b', 'audit']);
  });

  it('esconde o item cuja permissão o usuário não tem', () => {
    expect(visibleNavItems(items, canNothing).map((item) => item.key)).toEqual(['a', 'b']);
  });

  it('quem tem a permissão enxerga o item restrito', () => {
    expect(visibleNavItems(items, canOnly('audit.read')).map((item) => item.key)).toContain('audit');
  });
});

/**
 * Uma seção de Configurações era a ÚNICA contribuição de UI sem `requiredPermissions`: tela, menu,
 * widget e aba a tinham. O que a extensão expunha ali só podia ficar sob a permissão de configurar o
 * escritório inteiro, ou sob nenhuma.
 */
describe('visibleSettingsSections', () => {
  const section = (key: string, requiredPermissions?: string[]): SettingsSection => ({
    key,
    title: key,
    properties: [],
    ...(requiredPermissions ? { requiredPermissions } : {}),
  });

  const sections = [
    section('appearance'),
    section('push', ['pushes.manage-inbox']),
    section('billing', ['billing.read', 'billing.manage']),
  ];

  it('a seção sem exigência aparece para todo mundo', () => {
    expect(visibleSettingsSections(sections, canNothing).map((s) => s.key)).toEqual(['appearance']);
  });

  it('basta UMA das permissões exigidas, como em toda contribuição de UI', () => {
    expect(visibleSettingsSections(sections, canOnly('billing.manage')).map((s) => s.key)).toEqual([
      'appearance',
      'billing',
    ]);
  });

  it('quem tem tudo vê tudo, e a ordem recebida é preservada', () => {
    expect(visibleSettingsSections(sections, canAll).map((s) => s.key)).toEqual([
      'appearance',
      'push',
      'billing',
    ]);
  });

  it('lista vazia de exigências é o mesmo que não exigir nada', () => {
    expect(visibleSettingsSections([section('x', [])], canNothing).map((s) => s.key)).toEqual(['x']);
  });
});
