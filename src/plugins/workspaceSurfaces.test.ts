import { describe, expect, it } from 'vitest';
import { createPluginHost } from '../kernel';
import { hasErrors } from '../domain/schema/plugin/diagnostics';
import { CORE_PLUGINS } from './index';
import {
  UI_MENU_POINT,
  UI_NAV_POINT,
  UI_PAGE_POINT,
  UI_SLOT_POINT,
  USER_MENU_SURFACE,
  WORKSPACE_SLOT_SURFACES,
  type UiMenuItemMetadata,
  type UiNavMetadata,
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
   * O menu do usuário é da PESSOA: o perfil dela (e a aparência, que o shell desenha à parte). As
   * ferramentas do escritório que moravam aqui foram para a barra lateral, cada uma no seu grupo.
   */
  it('traz só o que é da pessoa', () => {
    expect(menuItemsOf(USER_MENU_SURFACE).map((item) => item.key)).toEqual(['profile']);
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
        const tabKey = metadata.action.kind === 'openTab' ? (metadata.action.tabKey ?? '') : '';
        return owners.get(tabKey) !== contribution.pluginId;
      })
      .map(({ metadata }) => metadata.key);

    expect(misplaced).toEqual([]);
  });

  it('as ferramentas levadas para a barra lateral preservam a permissão que exigiam no menu', () => {
    const { host } = loadedHost();
    const byKey = new Map(
      host.contributions
        .query(UI_NAV_POINT)
        .map((contribution) => contribution.metadata as unknown as UiNavMetadata)
        .map((metadata) => [metadata.key, metadata]),
    );
    expect(byKey.get('access-management')?.requiresSystemAdmin).toBe(true);
    expect(byKey.get('screen-builder')?.requiredPermissions).toEqual(['screens.manage']);
    expect(byKey.get('workflows')?.requiredPermissions).toEqual(['automation.manage']);
    expect(byKey.get('scripts')?.requiredPermissions).toEqual(['automation.manage']);
    expect(byKey.get('actions')?.requiredPermissions).toEqual(['automation.manage']);
    expect(byKey.get('document-templates')?.requiredPermissions).toEqual(['document-templates.manage']);
    expect(byKey.get('data-processor')?.requiredPermissions).toEqual(['data-processor.use']);
    expect(byKey.get('marketplace')?.requiredPermissions).toEqual(['extensions.manage']);
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
   * O núcleo declara as regiões e ocupa UMA: o sino, que é o leitor do canal "no app" do passo
   * Notificar — sem ele a entrega não chegaria a ninguém. Fora ele, quem coloca conteúdo ali é a
   * instalação: um trecho nosso seria vocabulário nosso no shell de todo escritório, a mesma razão
   * pela qual a extensão do Painel não declara widget nenhum. A lista é fechada de propósito — o
   * próximo trecho do núcleo tem de passar por aqui e explicar por que é capacidade, e não marca.
   */
  it('só o sino e o assistente vêm ocupados pelo núcleo, cada um no plugin dono do que o alimenta', () => {
    const { host } = loadedHost();
    const occupied = host.contributions.query(UI_SLOT_POINT).map((contribution) => ({
      pluginId: contribution.pluginId,
      surface: (contribution.metadata as { surface?: string }).surface,
      key: (contribution.metadata as { key?: string }).key,
    }));
    // O assistente é o segundo, e pelo mesmo critério: é capacidade do núcleo (coleção reservada,
    // ferramentas do agente), e só aparece onde uma extensão instalada põe a function dele no ar.
    expect(occupied).toHaveLength(2);
    expect(occupied).toEqual(expect.arrayContaining([
      { pluginId: 'core.automation', surface: WORKSPACE_SLOT_SURFACES.topBarRight, key: 'notifications' },
      { pluginId: 'core.assistant', surface: WORKSPACE_SLOT_SURFACES.dockRight, key: 'assistant' },
    ]));
  });

  it('são um nome só, declarado num lugar só', () => {
    const names = Object.values(WORKSPACE_SLOT_SURFACES);
    expect(new Set(names).size).toBe(names.length);
  });
});
