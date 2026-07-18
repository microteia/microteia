import { useMemo } from 'react';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { useCustomRecords } from '../../../stores/useCustomRecords';
import { useWorkspace } from '../../../stores/useWorkspace';
import { ChildRecordsPanel } from '../../components/layout/EntityDetailPanels';
import type { EntityDetailExtraTab } from '../../components/layout/EntityDetailView';
import {
  buildChildNewTabKey,
  buildViewTabKey,
} from '../../../shared/constants/dynamicScreenKeys';

/**
 * Abas de registros filhos de um registro. Uma tela dinâmica com `parentEntity` apontando para
 * esta entidade vira uma aba listando seus registros, filtrados pelo campo de vínculo.
 * Vale para telas fixas e dinâmicas — o `entityKey` é a chave da entidade dona da aba
 * ('cases', 'contracts', … ou o id de uma tela dinâmica).
 */
export const useChildScreenTabs = (
  entityKey: string,
  recordId: string | null,
): EntityDetailExtraTab[] => {
  const { dynamicScreens } = useScreenDefinitions();
  const { recordsByScreen } = useCustomRecords();
  const { openTab } = useWorkspace();

  const childScreens = useMemo(
    () => dynamicScreens.filter((def) => def.parentEntity === entityKey && !!def.parentFieldKey),
    [dynamicScreens, entityKey],
  );

  return useMemo(() => {
    if (!recordId) return [];
    return childScreens.map((screen) => {
      const parentFieldKey = screen.parentFieldKey as string;
      const records = (recordsByScreen[screen.id] ?? []).filter(
        (record) => record.values[parentFieldKey] === recordId,
      );
      return {
        key: `child:${screen.id}`,
        label: screen.titlePlural,
        content: (
          <ChildRecordsPanel
            screen={screen}
            records={records}
            onOpen={(record) => openTab(buildViewTabKey(screen.id, record.id))}
            onNew={() => openTab(buildChildNewTabKey(screen.id, entityKey, recordId))}
          />
        ),
      };
    });
  }, [childScreens, recordsByScreen, recordId, entityKey, openTab]);
};
