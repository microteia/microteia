import { useEffect, useMemo } from 'react';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useRecordListViewModel } from '../../shared/entityScreen/useRecordListViewModel';
import type { RecordListViewModel } from '../../shared/entityScreen/useRecordListViewModel';
import { parseDynamicTabKey } from '../../../shared/constants/dynamicScreenKeys';
import { useLabel } from '../../shared/i18n/useT';
import { useAggregateBackfillNotice } from '../../shared/entityScreen/useAggregateBackfillNotice';
import type { AggregateBackfillNoticeView } from '../../shared/entityScreen/useAggregateBackfillNotice';

export interface DynamicRecordListViewModel extends RecordListViewModel {
  /** O que o recálculo dos agregados desta tela tem a dizer — ou nada. */
  backfillNotice: AggregateBackfillNoticeView | null;
}

/** Listagem de uma tela customizada em janela própria: só resolve a aba e delega ao núcleo. */
export const useDynamicRecordListViewModel = (tabKey: string): DynamicRecordListViewModel => {
  const { setTabTitle } = useWorkspace();
  const label = useLabel();
  const screenKey = useMemo(() => parseDynamicTabKey(tabKey)?.screenKey ?? '', [tabKey]);

  const vm = useRecordListViewModel({ screenKey, savedFiltersKey: tabKey });
  const definition = vm.definition;
  const backfillNotice = useAggregateBackfillNotice(definition);

  useEffect(() => {
    if (definition) setTabTitle(tabKey, label(definition.titlePlural));
  }, [definition, tabKey, setTabTitle, label]);

  return { ...vm, backfillNotice };
};
