import { describe, expect, it } from 'vitest';
import type { MarketplacePlugin, ScreenModuleTemplate } from '../../entities/MarketplacePlugin';
import type { Contribution } from '../../schema/plugin/contribution';
import { UI_API_VERSION, UI_MENU_POINT, UI_NAV_POINT, UI_PAGE_POINT, USER_MENU_SURFACE } from '../../schema/ui/uiExtensionPoints';
import { navTargetChecks, navTargetIssues, navTargetOf, navTargetOwnerOf, withResolvedNavScreens } from './navTargets';

const screen = (key: string, sourceId?: string): ScreenModuleTemplate => ({
  key,
  ...(sourceId ? { sourceId } : {}),
  titleSingular: key,
  titlePlural: key,
  icon: 'star',
  fields: [],
  titleFieldKey: 'title',
});

const navOf = (metadata: Record<string, unknown>, id = 'item'): Contribution => ({
  point: UI_NAV_POINT,
  id,
  apiVersion: UI_API_VERSION,
  metadata: { label: 'Item', icon: 'star', order: 1, ...metadata },
});

const menuOf = (action: Record<string, unknown>, id = 'menu-item'): Contribution => ({
  point: UI_MENU_POINT,
  id,
  apiVersion: UI_API_VERSION,
  metadata: { surface: USER_MENU_SURFACE, key: id, title: 'Item', action },
});

const pageOf = (key: string, keyPrefix?: string): Contribution => ({
  point: UI_PAGE_POINT,
  id: `page-${key || keyPrefix}`,
  apiVersion: UI_API_VERSION,
  metadata: { key, ...(keyPrefix ? { keyPrefix } : {}), title: 'Page', icon: 'star' },
  impl: { kind: 'code', key: 'view' },
});

const pkgWith = (
  contributes: Contribution[],
  screens: ScreenModuleTemplate[] = [],
  dependencies: Record<string, string> = {},
): MarketplacePlugin => ({
  summary: 'x',
  manifest: {
    id: 'com.acme.produtos',
    version: '1.0.0',
    kernel: '^2.0.0',
    name: 'Produtos',
    dependencies,
    contributes,
  },
  workflows: [],
  screens,
});

describe('o alvo de um item de menu', () => {
  it('lê o ui.nav e o openTab do ui.menu pela mesma porta, e ignora o resto', () => {
    expect(navTargetOf(navOf({ key: 'x' }))).toEqual({ key: 'x', screen: undefined, screenSourceId: undefined });
    expect(navTargetOf(menuOf({ kind: 'openTab', screen: 'produtos' })))
      .toEqual({ key: undefined, screen: 'produtos', screenSourceId: undefined });
    expect(navTargetOf(menuOf({ kind: 'url', href: 'https://exemplo.com' }))).toBeNull();
    expect(navTargetOf(pageOf('x'))).toBeNull();
  });
});

describe('navTargetIssues — o item que não leva a lugar nenhum', () => {
  it('aceita a chave de uma página do próprio pacote, por chave ou por prefixo', () => {
    const pkg = pkgWith([navOf({ key: 'resumo' }), menuOf({ kind: 'openTab', tabKey: 'det:1' }), pageOf('resumo'), pageOf('', 'det:')]);
    expect(navTargetIssues(pkg)).toEqual([]);
  });

  it('aceita a chave de uma página do kernel sem dependência declarada', () => {
    expect(navTargetIssues(pkgWith([navOf({ key: 'reports' }), menuOf({ kind: 'openTab', tabKey: 'marketplace' })]))).toEqual([]);
  });

  /**
   * O caso que originou a regra: a chave da tela não é chave de aba. A lista é `dyn:<chave instalada>`,
   * e o item abria uma aba que nenhuma página desenha.
   */
  it('recusa a chave de uma tela escrita como chave de aba, sugerindo o screen: pelo nome', () => {
    expect(navTargetIssues(pkgWith([navOf({ key: 'produtos' })], [screen('produtos')]))).toEqual([{
      message: '@core.marketplace/issue.package.nav.dangling.screen',
      messageParams: { key: 'produtos', screen: 'produtos' },
    }]);
  });

  it('recusa a chave que nada desenha, com a frase genérica quando não há tela com aquele nome', () => {
    expect(navTargetIssues(pkgWith([menuOf({ kind: 'openTab', tabKey: 'fantasma' })]))).toEqual([{
      message: '@core.marketplace/issue.package.nav.dangling',
      messageParams: { key: 'fantasma' },
    }]);
  });

  it('aceita screen: que aponta uma tela do pacote, e recusa a que não existe', () => {
    expect(navTargetIssues(pkgWith([navOf({ screen: 'produtos' })], [screen('produtos')]))).toEqual([]);
    expect(navTargetIssues(pkgWith([navOf({ screen: 'produto' })], [screen('produtos')]))).toEqual([{
      message: '@core.marketplace/issue.package.nav.screen-unknown',
      messageParams: { id: 'item', screen: 'produto' },
    }]);
  });

  it('exige UM alvo só', () => {
    const issues = navTargetIssues(pkgWith([navOf({ key: 'x', screen: 'produtos' }), navOf({}, 'vazio')], [screen('produtos')]));
    expect(issues.map((issue) => issue.message)).toEqual([
      '@core.marketplace/issue.package.nav.target',
      '@core.marketplace/issue.package.nav.target',
    ]);
  });

  it('confere screenSourceId contra as telas do pacote e das dependências enxergadas', () => {
    const dependency = navTargetOwnerOf(pkgWith([pageOf('estoque')], [screen('itens', 'acme:itens')]));
    const own = pkgWith(
      [navOf({ screenSourceId: 'acme:itens' }), navOf({ key: 'estoque' }, 'b')],
      [],
      { 'com.acme.produtos-base': '^1.0.0' },
    );
    const visible = [{ ...dependency, pluginId: 'com.acme.produtos-base' }];

    expect(navTargetIssues(own, visible)).toEqual([]);
    expect(navTargetIssues(pkgWith([navOf({ screenSourceId: 'acme:nada' })]))).toEqual([{
      message: '@core.marketplace/issue.package.nav.source-id-unknown',
      messageParams: { id: 'item', sourceId: 'acme:nada' },
    }]);
  });

  /**
   * A dependência que quem pergunta não enxerga pode ter a página. Recusar o que não se viu ensinaria
   * o autor a ignorar a recusa — o veredito é "não dá para conferir daqui", e fica fora das recusas.
   */
  it('não recusa o que pode morar numa dependência que não se enxerga', () => {
    const pkg = pkgWith([navOf({ key: 'estoque' }), navOf({ screenSourceId: 'acme:itens' }, 'b')], [], { 'com.acme.base': '^1.0.0' });
    expect(navTargetIssues(pkg)).toEqual([]);
    expect(navTargetChecks(pkg).map((check) => [check.verdict, check.unseen])).toEqual([
      ['unverifiable', ['com.acme.base']],
      ['unverifiable', ['com.acme.base']],
    ]);
  });

  it('ignora a página de uma extensão que o pacote não declara em dependencies', () => {
    const other = { pluginId: 'com.acme.outra', pages: [{ key: 'estoque' }], screens: [] };
    expect(navTargetIssues(pkgWith([navOf({ key: 'estoque' })]), [other]).map((issue) => issue.message))
      .toEqual(['@core.marketplace/issue.package.nav.dangling']);
  });
});

describe('withResolvedNavScreens — o pacote como o kernel o carrega', () => {
  it('troca screen pelo sourceId da tela, no ui.nav e no openTab, e deixa o resto intacto', () => {
    const pkg = pkgWith(
      [navOf({ screen: 'produtos', badge: { collection: 'produtos' } }), menuOf({ kind: 'openTab', screen: 'legado' }), navOf({ key: 'x' }, 'c')],
      [screen('produtos', 'acme:produtos'), screen('legado')],
    );
    const [nav, menu, plain] = withResolvedNavScreens(pkg).contributes ?? [];

    expect(nav.metadata).toEqual({ label: 'Item', icon: 'star', order: 1, badge: { collection: 'produtos' }, screenSourceId: 'acme:produtos' });
    expect(menu.metadata.action).toEqual({ kind: 'openTab', screenSourceId: 'legado' });
    expect(plain).toBe(pkg.manifest.contributes?.[2]);
  });

  it('não inventa alvo para a tela que o pacote não traz', () => {
    const pkg = pkgWith([navOf({ screen: 'ausente' })]);
    expect(withResolvedNavScreens(pkg).contributes?.[0].metadata.screen).toBe('ausente');
  });
});
