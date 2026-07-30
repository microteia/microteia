import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNotification } from '../../../stores/useNotification';
import { useLookups } from '../../../stores/useLookups';
import type { DynamicSelectOption } from '../../components/ui/DynamicSelect';
import type { EntityDocument, EntityDocumentsController, DocumentsPort } from './types';

interface UseEntityDocumentsParams {
  enabled: boolean;
  recordId: string | null;
  port: DocumentsPort;
}

export const useEntityDocuments = ({ enabled, recordId, port }: UseEntityDocumentsParams): EntityDocumentsController => {
  const { notify } = useNotification();
  const { getOptions, addOption, removeOption } = useLookups();
  const typeConfigs = getOptions('documentTypes');

  const [documents, setDocuments] = useState<EntityDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingType, setPendingType] = useState('');
  const [docToDelete, setDocToDelete] = useState<EntityDocument | null>(null);

  useEffect(() => {
    if (!enabled || !recordId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carregamento inicial de documentos
    setDocsLoading(true);
    port.get(recordId)
      .then(setDocuments)
      .finally(() => setDocsLoading(false));
  }, [enabled, recordId, port]);

  const handleSelectFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPendingFile(file);
      setPendingType('');
    }
    e.target.value = '';
  }, []);

  const handleCancelPendingUpload = useCallback(() => {
    setPendingFile(null);
    setPendingType('');
  }, []);

  const handleConfirmUpload = useCallback(async () => {
    if (!pendingFile || !recordId) return;
    setIsUploadingDoc(true);
    try {
      const { url, storagePath } = await port.upload(recordId, pendingFile);
      const addedDoc = await port.add(recordId, {
        name: pendingFile.name,
        type: pendingType.trim() || undefined,
        url,
        storagePath,
      });
      setDocuments((prev) => [addedDoc, ...prev]);
      setPendingFile(null);
      setPendingType('');
      notify('Documento enviado com sucesso.', 'success');
    } catch {
      notify('Erro ao enviar documento.', 'error');
    } finally {
      setIsUploadingDoc(false);
    }
  }, [pendingFile, pendingType, recordId, port, notify]);

  const requestDeleteDoc = useCallback((doc: EntityDocument) => setDocToDelete(doc), []);
  const cancelDeleteDoc = useCallback(() => setDocToDelete(null), []);
  const confirmDeleteDoc = useCallback(async () => {
    if (!docToDelete || !recordId) return;
    try {
      await port.remove(recordId, docToDelete);
      setDocuments((prev) => prev.filter((d) => d.id !== docToDelete.id));
      notify('Documento excluído.', 'success');
    } catch {
      notify('Erro ao excluir documento.', 'error');
    } finally {
      setDocToDelete(null);
    }
  }, [docToDelete, recordId, port, notify]);

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
    pendingFile,
    pendingType,
    setPendingType,
    handleSelectFile,
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
  };
};
