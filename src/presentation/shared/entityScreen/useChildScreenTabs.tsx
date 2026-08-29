import { useMemo } from 'react';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { useAuthorization } from '../../../stores/useAuthorization';
import { useLabel } from '../i18n/useT';
import { screenReadPermission } from '../../../domain/services/screenDataCollection';
import { ChildRecordList } from '../../components/layout/ChildRecordList';
import type { EntityDetailExtraTab } from '../../components/layout/EntityDetailView';

/**
 * Abas de registros filhos de um registro. Uma tela dinâmica com `parentEntity` apontando para
 * esta entidade vira uma aba com a listagem dela, restrita ao pai. Vale para telas fixas e
 * dinâmicas — o `entityKey` é a chave da entidade dona da aba ('cases', 'contracts', … ou o id
 * de uma tela dinâmica).
 *
 * Sem permissão de ler a coleção do filho, a aba não existe — a terceira porta do mesmo defeito, e a
 * mesma resposta que o menu e o ⌘K dão: uma aba que só pode mostrar vazio não é informação, é uma
 * pergunta sem resposta feita a quem não pode responder.
 */
export const useChildScreenTabs = (
  entityKey: string,
  recordId: string | null,
): EntityDetailExtraTab[] => {
  const { dynamicScreens } = useScreenDefinitions();
  const { can } = useAuthorization();
  const label = useLabel();

  const childScreens = useMemo(
    () => dynamicScreens.filter(
      (def) => def.parentEntity === entityKey
        && !!def.parentFieldKey
        && !def.hideFromParentTabs
        && can(screenReadPermission(def)),
    ),
    [dynamicScreens, entityKey, can],
  );

  return useMemo(() => {
    if (!recordId) return [];
    return childScreens.map((screen) => ({
      key: `child:${screen.id}`,
      label: label(screen.titlePlural),
      content: (
        <ChildRecordList
          screenKey={screen.id}
          parentEntity={entityKey}
          parentFieldKey={screen.parentFieldKey as string}
          parentId={recordId}
        />
      ),
    }));
  }, [childScreens, recordId, entityKey, label]);
};
