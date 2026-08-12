import { useMemo } from 'react';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { ChildRecordList } from '../../components/layout/ChildRecordList';
import type { EntityDetailExtraTab } from '../../components/layout/EntityDetailView';

/**
 * Abas de registros filhos de um registro. Uma tela dinâmica com `parentEntity` apontando para
 * esta entidade vira uma aba com a listagem dela, restrita ao pai. Vale para telas fixas e
 * dinâmicas — o `entityKey` é a chave da entidade dona da aba ('cases', 'contracts', … ou o id
 * de uma tela dinâmica).
 */
export const useChildScreenTabs = (
  entityKey: string,
  recordId: string | null,
): EntityDetailExtraTab[] => {
  const { dynamicScreens } = useScreenDefinitions();

  const childScreens = useMemo(
    () => dynamicScreens.filter(
      (def) => def.parentEntity === entityKey && !!def.parentFieldKey && !def.hideFromParentTabs,
    ),
    [dynamicScreens, entityKey],
  );

  return useMemo(() => {
    if (!recordId) return [];
    return childScreens.map((screen) => ({
      key: `child:${screen.id}`,
      label: screen.titlePlural,
      content: (
        <ChildRecordList
          screenKey={screen.id}
          parentEntity={entityKey}
          parentFieldKey={screen.parentFieldKey as string}
          parentId={recordId}
        />
      ),
    }));
  }, [childScreens, recordId, entityKey]);
};
