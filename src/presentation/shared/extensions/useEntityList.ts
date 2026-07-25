import { useCallback, useMemo } from 'react';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useNotification } from '../../../stores/useNotification';
import { useRecordListViewModel, type RecordListViewModel, type RecordCardAction } from '../entityScreen/useRecordListViewModel';
import { buildListTabKey } from '../../../shared/constants/dynamicScreenKeys';
import { generateDeepLink } from '../../../infrastructure/deeplink/deepLinkUtils';
import type { CustomRecord } from '../../../domain/entities';

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
  const { openTab } = useWorkspace();
  const { notify } = useNotification();

  const screenKey = useMemo(
    () => dynamicScreens.find((definition) => (definition.sourceId ?? definition.id) === sourceId)?.id ?? '',
    [dynamicScreens, sourceId],
  );

  const vm = useRecordListViewModel({ screenKey, savedFiltersKey: buildListTabKey(screenKey) });

  const getCardActions = useCallback(
    (record: CustomRecord): RecordCardAction[] => {
      const base = vm.getCardActions(record);
      if (!editKeyPrefix) return base;
      return base.map((action) => {
        if (action.key === 'clone') {
          return { ...action, onClick: () => openTab(`${editKeyPrefix}clone:${record.id}`) };
        }
        if (action.key === 'copyLink') {
          return {
            ...action,
            onClick: () => {
              void navigator.clipboard.writeText(generateDeepLink(`${editKeyPrefix}${record.id}`));
              notify('Link copiado para a área de transferência.', 'success');
            },
          };
        }
        return action;
      });
    },
    [vm, editKeyPrefix, openTab, notify],
  );

  return editKeyPrefix ? { ...vm, getCardActions } : vm;
};
