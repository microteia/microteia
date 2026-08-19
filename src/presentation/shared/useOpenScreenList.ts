import { useCallback } from 'react';
import { useScreenDefinitions } from '../../stores/useScreenDefinitions';
import { useWorkspace } from '../../stores/useWorkspace';
import { usePageContributions } from './useUiContributions';
import { screenDataCollection } from '../../domain/services/screenDataCollection';
import { buildListTabKey } from '../../shared/constants/dynamicScreenKeys';
import { setNavigationIntent } from '../../infrastructure/navigation/navigationIntent';
import type { UiPageMetadata } from '../../domain/schema/ui/uiExtensionPoints';
import type { FilterToken } from '../components/ui/CompositeFilter';

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
 *
 * Os `filterTokens` são o RECADO para a listagem: "abra mostrando só os vencidos", "só os deste
 * processo". Quem manda navegar sabe o que quer ver, mas não sabe (nem deve saber) que tela mostra
 * aquela coleção — por isso o recado é endereçado aqui, à tela resolvida, e não pela chave dela.
 */
export const useOpenScreenList = (): ((collection: string, filterTokens?: FilterToken[]) => void) => {
  const { dynamicScreens } = useScreenDefinitions();
  const pages = usePageContributions();
  const { openTab } = useWorkspace();

  return useCallback(
    (collection, filterTokens) => {
      const screen = dynamicScreens.find((definition) => screenDataCollection(definition) === collection);
      if (!screen) return;
      if (filterTokens) setNavigationIntent(screen.id, filterTokens);
      const ownPage = pages.some((page) => (page.metadata as unknown as UiPageMetadata).key === screen.id);
      openTab(ownPage ? screen.id : buildListTabKey(screen.id));
    },
    [dynamicScreens, pages, openTab],
  );
};
