import { describe, expect, it } from 'vitest';
import { createPluginHost } from '../kernel';
import { hasErrors } from '../domain/schema/plugin/diagnostics';
import { CORE_PLUGINS } from './index';
import {
  UI_MENU_POINT,
  UI_PAGE_POINT,
  UI_SLOT_POINT,
  USER_MENU_SURFACE,
  WORKSPACE_SLOT_SURFACES,
  type UiMenuItemMetadata,
  type UiPageMetadata,
} from '../domain/schema/ui/uiExtensionPoints';
import { isScreenIconKey } from '../domain/schema/ui/screenIconCatalog';

const loadedHost = () => {
  const host = createPluginHost();
  const result = host.load(CORE_PLUGINS);
  return { host, result };
};

const menuItemsOf = (surface: string): UiMenuItemMetadata[] => {
  const { host } = loadedHost();
  return host.contributions
    .query(UI_MENU_POINT)
    .map((contribution) => contribution.metadata as unknown as UiMenuItemMetadata)
    .filter((metadata) => metadata.surface === surface);
};

describe('o menu do usuário como contribuição', () => {
  it('carrega junto dos demais plugins do núcleo, sem diagnóstico', () => {
    const { result } = loadedHost();
    expect(hasErrors(result.diagnostics)).toBe(false);
  });

  /**
   * As oito linhas que a barra lateral tinha escritas à mão viraram contribuição. O teste não afirma
   * que são OITO — afirma que TODAS chegam por contribuição, e que a nona cabe pelo mesmo caminho.
   */
  it('traz os itens que a barra lateral escrevia à mão', () => {
    expect(menuItemsOf(USER_MENU_SURFACE).map((item) => item.key).sort()).toEqual([
      'access-management',
      'actions',
      'data-processor',
      'marketplace',
      'screen-builder',
      'scripts',
      'workflows',
      'profile',
    ].sort());
  });

  /**
   * O que motivou a mudança: cada item vive no plugin DONO da tela que ele abre, e é isso que o faz
   * sumir junto com ela. Enquanto os oito moravam no shell, desinstalar o plugin dono deixava a linha
   * no menu abrindo uma aba que ninguém sabe renderizar.
   */
  it('cada item é do plugin dono da tela que ele abre', () => {
    const { host } = loadedHost();
    const owners = new Map(
      host.contributions
        .query(UI_PAGE_POINT)
        .map((contribution) => [
          (contribution.metadata as unknown as UiPageMetadata).key,
          contribution.pluginId,
        ]),
    );

    const misplaced = host.contributions
      .query(UI_MENU_POINT)
      .map((contribution) => ({
        contribution,
        metadata: contribution.metadata as unknown as UiMenuItemMetadata,
      }))
      .filter(({ metadata }) => metadata.action.kind === 'openTab')
      .filter(({ contribution, metadata }) => {
        const tabKey = metadata.action.kind === 'openTab' ? metadata.action.tabKey : '';
        return owners.get(tabKey) !== contribution.pluginId;
      })
      .map(({ metadata }) => metadata.key);

    expect(misplaced).toEqual([]);
  });

  it('preserva a permissão que cada linha exigia antes', () => {
    const byKey = new Map(menuItemsOf(USER_MENU_SURFACE).map((item) => [item.key, item]));
    expect(byKey.get('profile')?.requiredPermissions).toBeUndefined();
    expect(byKey.get('access-management')?.requiresSystemAdmin).toBe(true);
    expect(byKey.get('screen-builder')?.requiredPermissions).toEqual(['screens.manage']);
    expect(byKey.get('workflows')?.requiredPermissions).toEqual(['automation.manage']);
    expect(byKey.get('scripts')?.requiredPermissions).toEqual(['automation.manage']);
    expect(byKey.get('actions')?.requiredPermissions).toEqual(['automation.manage']);
    expect(byKey.get('data-processor')?.requiredPermissions).toEqual(['data-processor.use']);
    expect(byKey.get('marketplace')?.requiredPermissions).toEqual(['extensions.manage']);
  });

  it('mantém a ordem em que as linhas apareciam', () => {
    const ordered = [...menuItemsOf(USER_MENU_SURFACE)].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    expect(ordered.map((item) => item.key)).toEqual([
      'profile',
      'access-management',
      'screen-builder',
      'workflows',
      'scripts',
      'actions',
      'data-processor',
      'marketplace',
    ]);
  });

  /** Ícone é CHAVE do conjunto curado, nunca componente — é o que mantém a metadata serializável. */
  it('todo ícone declarado existe no conjunto curado', () => {
    const unknown = menuItemsOf(USER_MENU_SURFACE)
      .map((item) => item.icon)
      .filter((icon): icon is string => !!icon)
      .filter((icon) => !isScreenIconKey(icon));
    expect(unknown).toEqual([]);
  });
});

describe('as regiões do shell', () => {
  /**
   * O núcleo declara as regiões e não ocupa nenhuma: quem coloca conteúdo ali é a instalação. Um
   * trecho nosso em qualquer uma delas seria vocabulário nosso no shell de todo escritório — a mesma
   * razão pela qual a extensão do Painel não declara widget nenhum.
   */
  it('nenhuma vem ocupada pelo núcleo', () => {
    const { host } = loadedHost();
    expect(host.contributions.query(UI_SLOT_POINT)).toEqual([]);
  });

  it('são um nome só, declarado num lugar só', () => {
    const names = Object.values(WORKSPACE_SLOT_SURFACES);
    expect(new Set(names).size).toBe(names.length);
  });
});
