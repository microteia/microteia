import { useCallback } from 'react';
import { useScreenDefinitions } from '../../stores/useScreenDefinitions';
import { useWorkspace } from '../../stores/useWorkspace';
import { screenDataCollection } from '../../domain/services/screenDataCollection';
import { buildEntityViewTabKey, buildViewTabKey } from '../../shared/constants/dynamicScreenKeys';

/**
 * Abre o detalhe de um registro por COLEÇÃO, sem saber que tela o apresenta.
 *
 * Uma tela que exibe o registro de outra entidade (o processo de um prazo, o contrato de um
 * lançamento) não pode conhecer a chave de aba de quem apresenta aquela entidade — ela pode ser uma
 * tela fixa hoje e uma extensão amanhã. A resolução é pela tela que DESCREVE a coleção; na falta
 * dela, pela chave fixa de sempre.
 *
 * Sem nenhuma tela para a coleção (extensão desinstalada), nada abre — em vez de uma aba morta.
 */
export const useOpenRecord = (): ((collection: string, recordId: string) => void) => {
  const { dynamicScreens } = useScreenDefinitions();
  const { openTab } = useWorkspace();

  return useCallback(
    (collection, recordId) => {
      if (!recordId) return;
      const screen = dynamicScreens.find((definition) => screenDataCollection(definition) === collection);
      if (screen) {
        openTab(buildViewTabKey(screen.id, recordId));
        return;
      }
      const builtin = buildEntityViewTabKey(collection, recordId);
      if (builtin.startsWith('view-')) openTab(builtin);
    },
    [dynamicScreens, openTab],
  );
};
