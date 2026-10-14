import { useCallback, useMemo } from 'react';
import type { ScreenDefinition } from '../../domain/entities';
import type { UiMenuAction, UiNavTarget, UiPageMetadata } from '../../domain/schema/ui/uiExtensionPoints';
import { screenReadPermission } from '../../domain/services/screenDataCollection';
import { buildListTabKey } from '../../shared/constants/dynamicScreenKeys';
import { useAuthorization } from '../../stores/useAuthorization';
import { useScreenDefinitions } from '../../stores/useScreenDefinitions';
import { usePageContributions } from './useUiContributions';

export interface ResolvedNavTarget {
  tabKey: string;
  /** A tela, quando o alvo é uma — é por ela que se pergunta se a pessoa pode ler a lista. */
  screen?: ScreenDefinition;
}

/** O alvo de uma ação `openTab` do `ui.menu`, na mesma forma do `ui.nav` — `tabKey` é a `key` dele. */
export const menuActionTarget = (action: Extract<UiMenuAction, { kind: 'openTab' }>): UiNavTarget => ({
  key: action.tabKey,
  screen: action.screen,
  screenSourceId: action.screenSourceId,
});

/**
 * A aba que um item de menu abre, ou `null` quando ele não leva a lugar nenhum NESTE escritório.
 *
 * `screenSourceId` é procurado entre as telas que o escritório tem de fato, e é isso que faz o item
 * sobreviver à desambiguação: a chave instalada pode ser `produtos_2`, o `sourceId` não muda. Uma
 * tela desligada ou ausente não abre nada — extensão desinstalada não vira aba morta.
 *
 * Quando a extensão traz a PRÓPRIA página com a chave da tela, é ela que abre, pela mesma razão de
 * `useOpenScreenList`: a genérica seria uma segunda aba da mesma tela, com outra cara.
 *
 * `screen` só chega aqui quando a carga não o traduziu (`withResolvedNavScreens`) — a tela não está
 * no pacote, e não há o que abrir.
 */
export const resolveNavTarget = (
  target: UiNavTarget,
  screens: ScreenDefinition[],
  pageKeys: ReadonlySet<string>,
): ResolvedNavTarget | null => {
  if (target.key) return { tabKey: target.key };
  if (!target.screenSourceId) return null;
  const screen = screens.find((definition) => (definition.sourceId ?? definition.id) === target.screenSourceId);
  if (!screen) return null;
  return { tabKey: pageKeys.has(screen.id) ? screen.id : buildListTabKey(screen.id), screen };
};

/**
 * O resolvedor que o shell usa, com a permissão já conferida: o alvo que é a lista de uma tela que
 * esta pessoa não pode LER também volta `null`, como o item automático da barra lateral.
 */
export const useNavTargetResolver = (): ((target: UiNavTarget) => string | null) => {
  const { dynamicScreens } = useScreenDefinitions();
  const pages = usePageContributions();
  const { can } = useAuthorization();

  const pageKeys = useMemo(
    () => new Set(pages.map((page) => (page.metadata as unknown as UiPageMetadata).key).filter(Boolean)),
    [pages],
  );

  return useCallback(
    (target) => {
      const resolved = resolveNavTarget(target, dynamicScreens, pageKeys);
      if (!resolved) return null;
      if (resolved.screen && !can(screenReadPermission(resolved.screen))) return null;
      return resolved.tabKey;
    },
    [dynamicScreens, pageKeys, can],
  );
};
