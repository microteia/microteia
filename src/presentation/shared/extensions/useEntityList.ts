import { useMemo } from 'react';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { useRecordListViewModel, type RecordListViewModel } from '../entityScreen/useRecordListViewModel';
import { buildListTabKey } from '../../../shared/constants/dynamicScreenKeys';

export interface EntityListOptions {
  /**
   * Prefixo da tela de edição PRÓPRIA da extensão. Quando presente, as ações "duplicar" e "copiar
   * link" do card passam a abrir/gerar para essa tela, em vez do detalhe dinâmico nativo — mantendo o
   * card coerente com a lista e o editor da extensão.
   */
  editKeyPrefix?: string;
}

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
export const useEntityList = (sourceId: string, options: EntityListOptions = {}): RecordListViewModel => {
  const { editKeyPrefix } = options;
  const { dynamicScreens } = useScreenDefinitions();

  const screenKey = useMemo(
    () => dynamicScreens.find((definition) => (definition.sourceId ?? definition.id) === sourceId)?.id ?? '',
    [dynamicScreens, sourceId],
  );

  /**
   * O endereço do registro NESTA extensão. Antes as ações de duplicar e copiar link eram
   * reescritas aqui uma a uma, pela chave — a ponte precisava conhecer o nome de cada ação do
   * kernel. Agora quem endereça é a listagem, e as ações só perguntam ao host.
   */
  const recordTabKeys = useMemo(
    () => (editKeyPrefix
      ? (recordId: string) => ({
          view: `${editKeyPrefix}${recordId}`,
          clone: `${editKeyPrefix}clone:${recordId}`,
        })
      : undefined),
    [editKeyPrefix],
  );

  return useRecordListViewModel({
    screenKey,
    savedFiltersKey: buildListTabKey(screenKey),
    recordTabKeys,
  });
};
