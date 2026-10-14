import { describe, it, expect } from 'vitest';
import type { QualifiedContribution } from '../../domain/schema/plugin/contribution';
import {
  declaredNavGroups,
  groupNavSections,
  homePageKey,
  navigablePages,
  resolvePageContribution,
  visibleNavItems,
  visibleSettingsSections,
} from './resolveUiContributions';
import type { SettingsSection } from '../../domain/schema/settings';
import type { UiNavGroupMetadata, UiNavMetadata, UiPageMetadata } from '../../domain/schema/ui/uiExtensionPoints';

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

describe('homePageKey', () => {
  const allowAll = () => true;

  it('sem página declarada como inicial, não há tela inicial', () => {
    expect(homePageKey([pageContribution('a', { key: 'reports' })], allowAll, false)).toBeUndefined();
  });

  it('devolve a chave da primeira página declarada como inicial', () => {
    const pages = [
      pageContribution('a', { key: 'reports' }),
      pageContribution('b', { key: 'painel', home: true }),
      pageContribution('c', { key: 'outra', home: true }),
    ];
    expect(homePageKey(pages, allowAll, false)).toBe('painel');
  });

  it('ignora a página inicial que a pessoa não pode ver', () => {
    const pages = [
      pageContribution('a', { key: 'restrita', home: true, requiredPermissions: ['x.read'] }),
      pageContribution('b', { key: 'admin', home: true, requiresSystemAdmin: true }),
      pageContribution('c', { key: 'livre', home: true }),
    ];
    expect(homePageKey(pages, () => false, false)).toBe('livre');
  });

  it('ignora página paramétrica, que não tem aba própria a abrir', () => {
    expect(homePageKey([pageContribution('a', { keyPrefix: 'view:', home: true })], allowAll, false)).toBeUndefined();
  });
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
    expect(visibleNavItems(items, canAll, false).map((item) => item.key)).toEqual(['a', 'b', 'audit']);
  });

  it('esconde o item cuja permissão o usuário não tem', () => {
    expect(visibleNavItems(items, canNothing, false).map((item) => item.key)).toEqual(['a', 'b']);
  });

  it('quem tem a permissão enxerga o item restrito', () => {
    expect(visibleNavItems(items, canOnly('audit.read'), false).map((item) => item.key)).toContain('audit');
  });

  it('o item do administrador global não aparece por permissão de escritório', () => {
    const global = [navContribution({ key: 'access', order: 10, requiresSystemAdmin: true })];
    expect(visibleNavItems(global, canAll, false)).toEqual([]);
    expect(visibleNavItems(global, canNothing, true).map((item) => item.key)).toEqual(['access']);
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

describe('declaredNavGroups', () => {
  const groupContribution = (pluginId: string, metadata: Partial<UiNavGroupMetadata>): QualifiedContribution => ({
    pluginId,
    point: 'ui.nav.group',
    id: metadata.key ?? 'g',
    apiVersion: '1.0.0',
    metadata: { label: 'G', order: 0, ...metadata } as unknown as Record<string, unknown>,
  });

  it('a mesma chave declarada por duas extensões é UM grupo, com o rótulo da primeira carregada', () => {
    const groups = declaredNavGroups([
      groupContribution('com.acme.a', { key: 'agenda', label: 'Agenda', order: 20 }),
      groupContribution('com.acme.b', { key: 'agenda', label: 'Outra', order: 90 }),
    ]);
    expect(groups).toEqual([{ key: 'agenda', label: 'Agenda', order: 20 }]);
  });

  it('a declaração sem chave não forma grupo', () => {
    expect(declaredNavGroups([groupContribution('com.acme.a', { key: '' })])).toEqual([]);
  });
});

describe('groupNavSections', () => {
  type Item = { key: string; order: number; group?: string };
  const item = (key: string, order: number, group?: string): Item => ({ key, order, group });
  const group = (key: string, order: number): UiNavGroupMetadata => ({ key, label: key, order });
  const shape = (sections: ReturnType<typeof groupNavSections<Item>>) =>
    sections.map((section) => [section.group?.key ?? null, section.items.map((i) => i.key)]);

  it('sem grupo declarado, o menu é uma seção solta na ordem de sempre', () => {
    const items = [item('painel', 10), item('tarefas', 15), item('relatorios', 95)];
    expect(shape(groupNavSections(items, []))).toEqual([[null, ['painel', 'tarefas', 'relatorios']]]);
  });

  it('o grupo ocupa a posição do order dele entre os itens soltos', () => {
    const items = [
      item('painel', 10),
      item('calendario', 20, 'agenda'),
      item('dias-uteis', 21, 'agenda'),
      item('relatorios', 95),
      item('configuracoes', 115, 'admin'),
      item('escritorio', 110, 'admin'),
    ];
    expect(shape(groupNavSections(items, [group('agenda', 20), group('admin', 110)]))).toEqual([
      [null, ['painel']],
      ['agenda', ['calendario', 'dias-uteis']],
      [null, ['relatorios']],
      ['admin', ['escritorio', 'configuracoes']],
    ]);
  });

  it('item que aponta para um grupo não instalado fica solto, na posição dele — nunca some', () => {
    const items = [item('painel', 10), item('prazos', 30, 'juridico')];
    expect(shape(groupNavSections(items, []))).toEqual([[null, ['painel', 'prazos']]]);
  });

  it('grupo sem item visível não aparece', () => {
    expect(shape(groupNavSections([item('painel', 10)], [group('admin', 110)]))).toEqual([[null, ['painel']]]);
  });

  it('grupo com um item só não ganha título, e o item se junta aos soltos vizinhos', () => {
    const items = [item('painel', 10), item('auditoria', 120, 'admin'), item('relatorios', 95)];
    expect(shape(groupNavSections(items, [group('admin', 110)]))).toEqual([
      [null, ['painel', 'relatorios', 'auditoria']],
    ]);
  });
});
