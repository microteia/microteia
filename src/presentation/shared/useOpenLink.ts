import { useCallback } from 'react';
import { useWorkspace } from '../../stores/useWorkspace';
import { useOpenRecord } from './useOpenRecord';
import { parseRecordLinkTabKey } from '../../domain/schema/recordLink';

/**
 * Abre um LINK do app: uma aba qualquer, ou `record:<coleção>:<id>` — que não é aba, é o registro,
 * aberto pela tela que descreve a coleção na hora do clique (`useOpenRecord`). É a mesma porta do
 * sino, da página de notificações e do deeplink que chega do push e do e-mail.
 */
export const useOpenLink = (): ((tabKey: string) => void) => {
  const { openTab } = useWorkspace();
  const openRecord = useOpenRecord();
  return useCallback((tabKey: string) => {
    const target = parseRecordLinkTabKey(tabKey);
    if (target) openRecord(target.collection, target.recordId);
    else if (tabKey) openTab(tabKey);
  }, [openTab, openRecord]);
};
