import { useCallback } from 'react';
import { useScreenDefinitions } from '../../stores/useScreenDefinitions';
import { useWorkspace } from '../../stores/useWorkspace';
import { usePageContributions } from './useUiContributions';
import { screenDataCollection } from '../../domain/services/screenDataCollection';
import { buildListTabKey } from '../../shared/constants/dynamicScreenKeys';
import type { UiPageMetadata } from './uiExtensionPoints';

/**
 * Abre a LISTAGEM de uma coleção, sem saber que tela a apresenta — o irmão de `useOpenRecord`, para
 * quem manda navegar de fora (o painel do escritório, um atalho, um card de resumo).
 *
 * A resolução tem duas etapas, e a ordem importa: a extensão que traz a própria listagem contribui
 * uma página com a MESMA chave da tela (`processos`, `financeiro`), e é ela que o menu abre; sem
 * página própria, a listagem é a genérica (`dyn:<chave>`). Apontar direto para a genérica abriria
 * uma segunda aba da mesma tela, com outra cara.
 *
 * Coleção que nenhuma tela descreve não abre nada — extensão desinstalada não vira aba morta.
 */
export const useOpenScreenList = (): ((collection: string) => void) => {
  const { dynamicScreens } = useScreenDefinitions();
  const pages = usePageContributions();
  const { openTab } = useWorkspace();

  return useCallback(
    (collection) => {
      const screen = dynamicScreens.find((definition) => screenDataCollection(definition) === collection);
      if (!screen) return;
      const ownPage = pages.some((page) => (page.metadata as unknown as UiPageMetadata).key === screen.id);
      openTab(ownPage ? screen.id : buildListTabKey(screen.id));
    },
    [dynamicScreens, pages, openTab],
  );
};
