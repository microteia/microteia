import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useRecordListViewModel } from '../../shared/entityScreen/useRecordListViewModel';
import type { RecordListViewModel } from '../../shared/entityScreen/useRecordListViewModel';
import { parseDynamicTabKey } from '../../../shared/constants/dynamicScreenKeys';
import { useLabel } from '../../shared/i18n/useT';
import { useAggregateBackfillNotice } from '../../shared/entityScreen/useAggregateBackfillNotice';
import { useRecordKeyAdoptionNotice } from '../../shared/entityScreen/useRecordKeyAdoptionNotice';
import { useMemberVisibilityNotice } from '../../shared/entityScreen/useMemberVisibilityNotice';
import { useAuthorization } from '../../../stores/useAuthorization';
import { PERMISSION_RECORD_IMPORT_RUN } from '../../../domain/schema/access';

export interface DynamicRecordListNotice {
  message: string;
  variant: 'info' | 'warning';
}

export interface DynamicRecordListViewModel extends RecordListViewModel {
  /** O que o recálculo dos agregados e a adoção das chaves desta tela têm a dizer — ou nada. */
  notices: DynamicRecordListNotice[];
  /**
   * A importação por arquivo: de quem tem `record-import.run` e pode criar OU alterar nesta tela. Cada
   * linha ainda cobra a permissão do que ela fizer — aqui é só não oferecer o que viria todo recusado.
   */
  canImport: boolean;
  importOpen: boolean;
  openImport: () => void;
  closeImport: () => void;
  screenTitle: string;
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

  const { can } = useAuthorization();
  const [importOpen, setImportOpen] = useState(false);
  const openImport = useCallback(() => setImportOpen(true), []);
  const closeImport = useCallback(() => setImportOpen(false), []);

  return {
    ...vm,
    notices,
    canImport: can(PERMISSION_RECORD_IMPORT_RUN) && (vm.canCreate || vm.canUpdate),
    importOpen,
    openImport,
    closeImport,
    screenTitle: definition ? label(definition.titlePlural) : '',
  };
};
