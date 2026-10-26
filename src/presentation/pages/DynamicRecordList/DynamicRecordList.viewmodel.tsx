import { useEffect, useMemo } from 'react';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useRecordListViewModel } from '../../shared/entityScreen/useRecordListViewModel';
import type { RecordListViewModel } from '../../shared/entityScreen/useRecordListViewModel';
import { parseDynamicTabKey } from '../../../shared/constants/dynamicScreenKeys';
import { useLabel } from '../../shared/i18n/useT';
import { useAggregateBackfillNotice } from '../../shared/entityScreen/useAggregateBackfillNotice';
import { useRecordKeyAdoptionNotice } from '../../shared/entityScreen/useRecordKeyAdoptionNotice';
import { useMemberVisibilityNotice } from '../../shared/entityScreen/useMemberVisibilityNotice';

export interface DynamicRecordListNotice {
  message: string;
  variant: 'info' | 'warning';
}

export interface DynamicRecordListViewModel extends RecordListViewModel {
  /** O que o recálculo dos agregados e a adoção das chaves desta tela têm a dizer — ou nada. */
  notices: DynamicRecordListNotice[];
}

/** Listagem de uma tela customizada em janela própria: só resolve a aba e delega ao núcleo. */
export const useDynamicRecordListViewModel = (tabKey: string): DynamicRecordListViewModel => {
  const { setTabTitle } = useWorkspace();
  const label = useLabel();
  const screenKey = useMemo(() => parseDynamicTabKey(tabKey)?.screenKey ?? '', [tabKey]);

  const vm = useRecordListViewModel({ screenKey, savedFiltersKey: tabKey });
  const definition = vm.definition;
  const backfillNotice = useAggregateBackfillNotice(definition);
  const keyNotices = useRecordKeyAdoptionNotice(definition);
  const visibilityNotice = useMemberVisibilityNotice(definition);
  const notices = useMemo(
    () => [
      ...(visibilityNotice ? [visibilityNotice] : []),
      ...(backfillNotice ? [backfillNotice] : []),
      ...keyNotices,
    ],
    [visibilityNotice, backfillNotice, keyNotices],
  );

  useEffect(() => {
    if (definition) setTabTitle(tabKey, label(definition.titlePlural));
  }, [definition, tabKey, setTabTitle, label]);

  return { ...vm, notices };
};
