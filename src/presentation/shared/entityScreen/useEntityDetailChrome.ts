import { useCallback, useState } from 'react';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useNotification } from '../../../stores/useNotification';
import { generateDeepLink } from '../../../infrastructure/deeplink/deepLinkUtils';
import { recordLinkTabKey } from '../../../domain/schema/recordLink';
import type { EntityDetailTab } from '../../components/layout/EntityDetailView';
import { LocalizedError } from '../../../domain/errors/LocalizedError';
import { useLabel } from '../i18n/useT';

interface UseEntityDetailChromeParams {
  recordId: string | null;
  /** A coleção do registro: com ela, o link copiado é o universal (`record:`), e não a aba da tela. */
  linkCollection?: string;
  deepLinkKey: (recordId: string) => string;
  cloneKey: (recordId: string) => string;
  remove: (recordId: string) => Promise<void>;
  onRemoved: () => void;
  removedMessage: string;
  removeErrorMessage: string;
}

export interface EntityDetailChrome {
  activeTab: EntityDetailTab;
  setActiveTab: (tab: EntityDetailTab) => void;
  copyLinkDone: boolean;
  handleCopyDeepLink: () => void;
  handleClone: () => void;
  isTagManagerOpen: boolean;
  openTagManager: () => void;
  closeTagManager: () => void;
  isDeleteOpen: boolean;
  isDeleting: boolean;
  requestDelete: () => void;
  cancelDelete: () => void;
  confirmDelete: () => Promise<void>;
}

/**
 * Lógica de "chrome" comum às telas de detalhe: estado de aba, copiar deeplink, clonar,
 * gerenciador de etiquetas e confirmação de exclusão. Os caminhos de tab e a ação de exclusão
 * são parametrizados por entidade.
 */
export const useEntityDetailChrome = (params: UseEntityDetailChromeParams): EntityDetailChrome => {
  const { recordId, linkCollection, deepLinkKey, cloneKey, remove, onRemoved, removedMessage, removeErrorMessage } = params;
  const { openTab } = useWorkspace();
  const { notify } = useNotification();
  const label = useLabel();

  const [activeTab, setActiveTab] = useState<EntityDetailTab>('data');
  const [copyLinkDone, setCopyLinkDone] = useState(false);
  const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCopyDeepLink = useCallback(() => {
    if (!recordId) return;
    const tabKey = linkCollection ? recordLinkTabKey({ collection: linkCollection, recordId }) : deepLinkKey(recordId);
    void navigator.clipboard.writeText(generateDeepLink(tabKey));
    setCopyLinkDone(true);
    setTimeout(() => setCopyLinkDone(false), 2000);
  }, [recordId, linkCollection, deepLinkKey]);

  const handleClone = useCallback(() => {
    if (!recordId) return;
    openTab(cloneKey(recordId));
  }, [recordId, cloneKey, openTab]);

  const openTagManager = useCallback(() => setIsTagManagerOpen(true), []);
  const closeTagManager = useCallback(() => setIsTagManagerOpen(false), []);

  const requestDelete = useCallback(() => {
    if (recordId) setIsDeleteOpen(true);
  }, [recordId]);
  const cancelDelete = useCallback(() => setIsDeleteOpen(false), []);

  const confirmDelete = useCallback(async () => {
    if (!recordId) return;
    setIsDeleting(true);
    try {
      await remove(recordId);
      notify(removedMessage, 'success');
      setIsDeleteOpen(false);
      onRemoved();
    } catch (err) {
      notify(err instanceof LocalizedError ? label(err.message, err.messageParams) : removeErrorMessage, 'error');
    } finally {
      setIsDeleting(false);
    }
  }, [recordId, remove, onRemoved, removedMessage, removeErrorMessage, notify, label]);

  return {
    activeTab,
    setActiveTab,
    copyLinkDone,
    handleCopyDeepLink,
    handleClone,
    isTagManagerOpen,
    openTagManager,
    closeTagManager,
    isDeleteOpen,
    isDeleting,
    requestDelete,
    cancelDelete,
    confirmDelete,
  };
};
