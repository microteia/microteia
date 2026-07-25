import { useMemo } from 'react';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { useRecordListViewModel, type RecordListViewModel } from '../entityScreen/useRecordListViewModel';
import { buildListTabKey } from '../../../shared/constants/dynamicScreenKeys';

/**
 * Versão para EXTENSÕES do view model padrão de listagem: resolve a tela dinâmica pelo `sourceId`
 * universal e devolve o mesmo `RecordListViewModel` das telas nativas — registros, filtros derivados
 * dos campos, e as AÇÕES do card vindas da configuração (Form Design): `listActions` + ações
 * customizadas (`cardActionIds`), com os modais de etiquetas/exclusão já embutidos.
 *
 * É a peça que mantém a "extensão padrão" aberta: a view de código escolhe ONDE encaixar cada porta
 * (usar `RecordListSurface` pronto, ou pôr `getCardActions(record)` num dropdown próprio), enquanto
 * O QUE aparece continua governado pela configuração da tela — não por algo fixo no código.
 */
export const useEntityList = (sourceId: string): RecordListViewModel => {
  const { dynamicScreens } = useScreenDefinitions();
  const screenKey = useMemo(
    () => dynamicScreens.find((definition) => (definition.sourceId ?? definition.id) === sourceId)?.id ?? '',
    [dynamicScreens, sourceId],
  );
  return useRecordListViewModel({ screenKey, savedFiltersKey: buildListTabKey(screenKey) });
};
