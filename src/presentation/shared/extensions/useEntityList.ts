import { useMemo } from 'react';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { useRecordListViewModel, type RecordListViewModel } from '../entityScreen/useRecordListViewModel';
import { buildListTabKey } from '../../../shared/constants/dynamicScreenKeys';
import type { FilterToken } from '../../components/ui/CompositeFilter';
import type { EntityRecord } from '../../../domain/entities';

export interface EntityListOptions {
  /**
   * Prefixo da tela de edição PRÓPRIA da extensão. Quando presente, as ações "duplicar" e "copiar
   * link" do card passam a abrir/gerar para essa tela, em vez do detalhe dinâmico nativo — mantendo o
   * card coerente com a lista e o editor da extensão.
   */
  editKeyPrefix?: string;
  /**
   * Filtros com que a listagem ABRE. Existe para a tela cuja visão útil não é "tudo": o Financeiro
   * abre no mês corrente, senão a primeira coisa que o usuário vê é o histórico inteiro do
   * escritório. É ponto de partida — o usuário troca à vontade, e a troca não volta atrás.
   */
  defaultFilterTokens?: FilterToken[];
  /**
   * Ordem em que a listagem apresenta os registros. Sem ela vale a ordem da coleção — o mais recente
   * primeiro —, que é a certa para um cadastro e a errada para uma agenda: uma lista de prazos se lê
   * do vencimento mais próximo ao mais distante, e o mais recente cadastrado não é o mais urgente.
   *
   * Declare o comparador FORA do componente: uma função nova a cada render refaz a ordenação a cada
   * render, sem que nada tenha mudado.
   */
  sortRecords?: (a: EntityRecord, b: EntityRecord) => number;
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
  const { editKeyPrefix, defaultFilterTokens, sortRecords } = options;
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
    defaultFilterTokens,
    sortRecords,
  });
};
