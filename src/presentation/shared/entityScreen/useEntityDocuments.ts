import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { storeEvents, StoreEvents } from '../../../infrastructure/events/StoreEventEmitter';
import { useNotification } from '../../../stores/useNotification';
import { useLookups } from '../../../stores/useLookups';
import type { DynamicSelectOption } from '../../components/ui/DynamicSelect';
import type {
  EntityDocument,
  EntityDocumentsController,
  DocumentsPort,
  PendingDocumentUpload,
} from './types';

import { useLabel, useT } from '../i18n/useT';
import { LocalizedError } from '../../../domain/errors/LocalizedError';

interface UseEntityDocumentsParams {
  enabled: boolean;
  recordId: string | null;
  port: DocumentsPort;
  /** A tela expõe documentos no portal e quem vê pode editar o registro. */
  canShareInPortal?: boolean;
}

export const useEntityDocuments = ({
  enabled,
  recordId,
  port,
  canShareInPortal = false,
}: UseEntityDocumentsParams): EntityDocumentsController => {
  const { notify } = useNotification();
  const t = useT('core.ui');
  const label = useLabel();
  const { getOptions, addOption, removeOption } = useLookups();
  const typeConfigs = getOptions('documentTypes');

  const [documents, setDocuments] = useState<EntityDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [pendingUploads, setPendingUploads] = useState<PendingDocumentUpload[]>([]);
  const [docToDelete, setDocToDelete] = useState<EntityDocument | null>(null);
  const [revision, setRevision] = useState(0);

  // Um anexo pode nascer FORA da aba — o documento gerado no servidor a partir de um modelo. Quem o
  // gera avisa, e a aba aberta relê a lista em vez de esperar a próxima abertura do registro.
  useEffect(() => storeEvents.on(StoreEvents.RECORD_DOCUMENTS_UPDATED, () => setRevision((current) => current + 1)), []);

  useEffect(() => {
    if (!enabled || !recordId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carregamento inicial de documentos
    setDocsLoading(true);
    port.get(recordId)
      .then(setDocuments)
      .finally(() => setDocsLoading(false));
  }, [enabled, recordId, port, revision]);

  const handleSelectFiles = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(e.target.files ?? []);
    if (chosen.length > 0) {
      const queued: PendingDocumentUpload[] = chosen.map((file) => ({
        id: crypto.randomUUID(),
        file,
        type: '',
        status: 'pending',
      }));
      setPendingUploads((prev) => [...prev, ...queued]);
    }
    e.target.value = '';
  }, []);

  const setPendingUploadType = useCallback((id: string, type: string) => {
    setPendingUploads((prev) => prev.map((item) => (item.id === id ? { ...item, type } : item)));
  }, []);

  const removePendingUpload = useCallback((id: string) => {
    setPendingUploads((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleCancelPendingUpload = useCallback(() => {
    setPendingUploads([]);
  }, []);

  /**
   * Envia a fila inteira, um arquivo por vez.
   *
   * Sequencial e não em paralelo por duas razões: o progresso fica legível (a linha em envio é
   * exatamente uma), e um lote grande não abre dezenas de conexões ao Storage de uma vez. O que
   * falhou PERMANECE na fila, com o tipo que o usuário já informou — a alternativa seria pedir de
   * volta a escolha do arquivo e a digitação do tipo por causa de uma queda de rede.
   */
  const handleConfirmUpload = useCallback(async () => {
    if (pendingUploads.length === 0 || !recordId) return;
    setIsUploadingDoc(true);
    const uploaded: EntityDocument[] = [];
    const failed: PendingDocumentUpload[] = [];
    let explained: LocalizedError | null = null;
    for (const pending of pendingUploads) {
      setPendingUploads((prev) => prev.map((item) => (
        item.id === pending.id ? { ...item, status: 'uploading' } : item
      )));
      try {
        const { url, storagePath } = await port.upload(recordId, pending.file);
        uploaded.push(await port.add(recordId, {
          name: pending.file.name,
          type: pending.type.trim() || undefined,
          url,
          storagePath,
        }));
      } catch (err) {
        console.error('[useEntityDocuments upload]', err);
        if (err instanceof LocalizedError) explained ??= err;
        failed.push({ ...pending, status: 'failed' });
      }
    }
    if (uploaded.length > 0) setDocuments((prev) => [...[...uploaded].reverse(), ...prev]);
    setPendingUploads(failed);
    setIsUploadingDoc(false);
    if (failed.length === 0) {
      notify(
        uploaded.length === 1 ? t('documents.uploaded') : t('documents.uploaded.many', { count: uploaded.length }),
        'success',
      );
    } else if (explained) {
      notify(label(explained.message, explained.messageParams), 'error');
    } else if (uploaded.length === 0) {
      notify(
        failed.length === 1 ? t('documents.upload-failed') : t('documents.upload-failed.many', { count: failed.length }),
        'error',
      );
    } else {
      notify(t('documents.upload-failed.partial', { failed: failed.length, total: uploaded.length + failed.length }), 'error');
    }
  }, [pendingUploads, recordId, port, notify, t, label]);

  const requestDeleteDoc = useCallback((doc: EntityDocument) => setDocToDelete(doc), []);
  const cancelDeleteDoc = useCallback(() => setDocToDelete(null), []);
  const confirmDeleteDoc = useCallback(async () => {
    if (!docToDelete || !recordId) return;
    try {
      await port.remove(recordId, docToDelete);
      setDocuments((prev) => prev.filter((d) => d.id !== docToDelete.id));
      notify(t('document.deleted'), 'success');
    } catch {
      notify(t('documents.delete-failed'), 'error');
    } finally {
      setDocToDelete(null);
    }
  }, [docToDelete, recordId, port, notify, t]);

  const togglePortalShared = useCallback(async (doc: EntityDocument) => {
    if (!recordId || !port.setPortalShared) return;
    const shared = !doc.portalShared;
    try {
      await port.setPortalShared(recordId, doc, shared);
      setDocuments((prev) => prev.map((d) => (d.id === doc.id ? { ...d, portalShared: shared } : d)));
      notify(shared ? t('documents.portal.shared') : t('documents.portal.unshared'), 'success');
    } catch {
      notify(t('documents.portal.failed'), 'error');
    }
  }, [recordId, port, notify, t]);

  const documentTypeOptions = useMemo<DynamicSelectOption[]>(
    () => typeConfigs.filter((c) => c.isStatic !== false).map((c) => ({ value: c.key, label: c.label })),
    [typeConfigs],
  );
  const documentTypeDynamicOptions = useMemo<DynamicSelectOption[]>(
    () => typeConfigs.filter((c) => c.isStatic === false).map((c) => ({ value: c.key, label: c.label })),
    [typeConfigs],
  );
  const handleAddDocumentType = useCallback(async (name: string) => { await addOption('documentTypes', name); }, [addOption]);
  const handleDeleteDocumentType = useCallback(async (key: string) => { await removeOption('documentTypes', key); }, [removeOption]);

  return {
    documents,
    docsLoading,
    isUploadingDoc,
    pendingUploads,
    setPendingUploadType,
    removePendingUpload,
    handleSelectFiles,
    handleCancelPendingUpload,
    handleConfirmUpload,
    docToDelete,
    requestDeleteDoc,
    confirmDeleteDoc,
    cancelDeleteDoc,
    documentTypeOptions,
    documentTypeDynamicOptions,
    handleAddDocumentType,
    handleDeleteDocumentType,
    canShareInPortal: canShareInPortal && !!port.setPortalShared,
    togglePortalShared,
  };
};
