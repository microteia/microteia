import { useMemo } from 'react';
import { useRecordListViewModel } from '../../../shared/entityScreen/useRecordListViewModel';
import type { RecordListViewModel } from '../../../shared/entityScreen/useRecordListViewModel';
import { buildListTabKey } from '../../../../shared/constants/dynamicScreenKeys';

export interface ChildRecordListParams {
  screenKey: string;
  parentEntity: string;
  parentFieldKey: string;
  parentId: string;
}

/**
 * Listagem de registros filhos dentro da aba do pai. Os filtros salvos são por tela filha
 * (não por registro pai), então a preferência do usuário vale ao abrir qualquer pai.
 */
export const useChildRecordListViewModel = (params: ChildRecordListParams): RecordListViewModel => {
  const { screenKey, parentEntity, parentFieldKey, parentId } = params;

  const parent = useMemo(
    () => ({ entityKey: parentEntity, fieldKeys: [parentFieldKey], recordId: parentId }),
    [parentEntity, parentFieldKey, parentId],
  );

  return useRecordListViewModel({
    screenKey,
    savedFiltersKey: buildListTabKey(screenKey),
    parent,
    // A aba de filhos é a listagem com o vínculo como filtro fixo: cresce com a rolagem e leva ao
    // servidor o filtro que a pessoa escolhe, como a listagem principal.
    paginate: true,
  });
};
