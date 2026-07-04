import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { useCustomRecords } from '../../../stores/useCustomRecords';
import { useDocumentTypeLookup } from '../../../stores/useDocumentTypeLookup';
import { useTenant } from '../../../stores/useTenant';
import { useAuth } from '../../../stores/useAuth';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useNotification } from '../../../stores/useNotification';
import { useDI } from '../../../infrastructure/di/useDI';
import { makeGetCustomRecordByIdUseCase } from '../../../domain/usecases/customrecords/GetCustomRecordByIdUseCase';
import { makeGetCustomRecordNotesUseCase } from '../../../domain/usecases/customrecordnotes/GetCustomRecordNotesUseCase';
import { makeAddCustomRecordNoteUseCase } from '../../../domain/usecases/customrecordnotes/AddCustomRecordNoteUseCase';
import { makeDeleteCustomRecordNoteUseCase } from '../../../domain/usecases/customrecordnotes/DeleteCustomRecordNoteUseCase';
import { makeGetCustomRecordDocumentsUseCase } from '../../../domain/usecases/customrecorddocuments/GetCustomRecordDocumentsUseCase';
import { makeUploadCustomRecordDocumentUseCase } from '../../../domain/usecases/customrecorddocuments/UploadCustomRecordDocumentUseCase';
import { makeAddCustomRecordDocumentUseCase } from '../../../domain/usecases/customrecorddocuments/AddCustomRecordDocumentUseCase';
import { makeDeleteCustomRecordDocumentUseCase } from '../../../domain/usecases/customrecorddocuments/DeleteCustomRecordDocumentUseCase';
import {
  buildCloneTabKey,
  buildViewTabKey,
  parseDynamicTabKey,
} from '../../../shared/constants/dynamicScreenKeys';
import {
  buildInitialFormValues,
  formValuesToStoredValues,
  resolveRecordTitle,
  sortFieldsByOrder,
  validateRequiredFields,
} from '../../../domain/services/customFieldValues';
import type { DynamicSelectOption } from '../../components/ui/DynamicSelect';
import type {
  CustomFieldValue,
  CustomRecord,
  CustomRecordDocument,
  CustomRecordNote,
  DeletionActor,
  FieldDefinition,
  ScreenDefinition,
} from '../../../domain/entities';

export type ViewDynamicRecordTab = 'data' | 'notes' | 'documents';

export interface ViewDynamicRecordViewModel {
  definition: ScreenDefinition | null;
  isAvailable: boolean;
  isLoadingDefinition: boolean;
  isNew: boolean;
  isAdmin: boolean;
  screenKey: string;
  activeTab: ViewDynamicRecordTab;
  setActiveTab: (tab: ViewDynamicRecordTab) => void;
  sortedFields: FieldDefinition[];
  formValues: Record<string, CustomFieldValue>;
  setFieldValue: (fieldKey: string, value: CustomFieldValue) => void;
  isSaving: boolean;
  handleSave: () => Promise<void>;
  handleClone: () => void;
  recordToDelete: CustomRecord | null;
  requestDelete: () => void;
  cancelDelete: () => void;
  confirmDelete: () => Promise<void>;
  isDeleting: boolean;
  recordNotFound: boolean;
  notes: CustomRecordNote[];
  notesLoading: boolean;
  newNoteTitle: string;
  setNewNoteTitle: (v: string) => void;
  newNoteText: string;
  setNewNoteText: (v: string) => void;
  isAddingNote: boolean;
  isNoteEditorOpen: boolean;
  openNoteEditor: () => void;
  closeNoteEditor: () => void;
  expandedNoteIds: Set<string>;
  toggleNoteExpanded: (id: string) => void;
  handleAddNote: () => Promise<void>;
  noteToDelete: CustomRecordNote | null;
  requestDeleteNote: (note: CustomRecordNote) => void;
  confirmDeleteNote: () => Promise<void>;
  cancelDeleteNote: () => void;
  documents: CustomRecordDocument[];
  docsLoading: boolean;
  isUploadingDoc: boolean;
  pendingFile: File | null;
  pendingType: string;
  setPendingType: (v: string) => void;
  handleSelectFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleCancelPendingUpload: () => void;
  handleConfirmUpload: () => Promise<void>;
  docToDelete: CustomRecordDocument | null;
  requestDeleteDoc: (doc: CustomRecordDocument) => void;
  confirmDeleteDoc: () => Promise<void>;
  cancelDeleteDoc: () => void;
  documentTypeOptions: DynamicSelectOption[];
  documentTypeDynamicOptions: DynamicSelectOption[];
  handleAddDocumentType: (name: string) => Promise<void>;
  handleDeleteDocumentType: (key: string) => Promise<void>;
}

export const useViewDynamicRecordViewModel = (tabKey: string): ViewDynamicRecordViewModel => {
  const { getDefinition, isLoading: isLoadingDefinition } = useScreenDefinitions();
  const { recordsByScreen, createRecord, updateRecord, deleteRecord } = useCustomRecords();
  const { typeConfigs: documentTypeConfigs, addItem: addDocumentType, removeItem: removeDocumentType } = useDocumentTypeLookup();
  const { currentTenant, tenantRole } = useTenant();
  const { user, effectiveName } = useAuth();
  const { setTabTitle, closeTab, openTab, activePanelId } = useWorkspace();
  const { notify } = useNotification();
  const { customRecordRepository, customRecordNoteRepository, customRecordDocumentRepository } = useDI();

  const tabInfo = useMemo(() => parseDynamicTabKey(tabKey), [tabKey]);
  const screenKey = tabInfo?.screenKey ?? '';
  const isNew = tabInfo?.kind === 'new';
  const recordId = tabInfo?.kind === 'view' ? tabInfo.recordId ?? null : null;
  const cloneSourceId = tabInfo?.cloneSourceId ?? null;

  const definition = useMemo(() => getDefinition(screenKey) ?? null, [getDefinition, screenKey]);
  const isAvailable = !!definition && !definition.builtin;
  const isAdmin = tenantRole === 'admin';

  const getByIdUC = useMemo(() => makeGetCustomRecordByIdUseCase(customRecordRepository), [customRecordRepository]);

  const noteUC = useMemo(() => ({
    get: makeGetCustomRecordNotesUseCase(customRecordNoteRepository),
    add: makeAddCustomRecordNoteUseCase(customRecordNoteRepository),
    delete: makeDeleteCustomRecordNoteUseCase(customRecordNoteRepository),
  }), [customRecordNoteRepository]);

  const docUC = useMemo(() => ({
    get: makeGetCustomRecordDocumentsUseCase(customRecordDocumentRepository),
    upload: makeUploadCustomRecordDocumentUseCase(customRecordDocumentRepository),
    add: makeAddCustomRecordDocumentUseCase(customRecordDocumentRepository),
    delete: makeDeleteCustomRecordDocumentUseCase(customRecordDocumentRepository),
  }), [customRecordDocumentRepository]);

  const [fetchedRecord, setFetchedRecord] = useState<CustomRecord | null>(null);
  const [fetchAttempted, setFetchAttempted] = useState(false);

  const storeRecord = useMemo(() => {
    const targetId = recordId ?? cloneSourceId;
    if (!targetId) return null;
    return (recordsByScreen[screenKey] ?? []).find((r) => r.id === targetId) ?? null;
  }, [recordsByScreen, screenKey, recordId, cloneSourceId]);

  const sourceRecord = storeRecord ?? fetchedRecord;

  useEffect(() => {
    const targetId = recordId ?? cloneSourceId;
    if (!targetId || storeRecord || !currentTenant) return;
    let cancelled = false;
    getByIdUC.execute(currentTenant.id, targetId)
      .then((record) => {
        if (cancelled) return;
        setFetchedRecord(record);
        setFetchAttempted(true);
      })
      .catch(() => {
        if (!cancelled) setFetchAttempted(true);
      });
    return () => { cancelled = true; };
  }, [recordId, cloneSourceId, storeRecord, currentTenant, getByIdUC]);

  const sortedFields = useMemo(
    () => (definition ? sortFieldsByOrder(definition.fields) : []),
    [definition],
  );

  const [activeTab, setActiveTab] = useState<ViewDynamicRecordTab>('data');
  const [formValues, setFormValues] = useState<Record<string, CustomFieldValue>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<CustomRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [notes, setNotes] = useState<CustomRecordNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteText, setNewNoteText] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [isNoteEditorOpen, setIsNoteEditorOpen] = useState(false);
  const [expandedNoteIds, setExpandedNoteIds] = useState<Set<string>>(new Set());
  const [noteToDelete, setNoteToDelete] = useState<CustomRecordNote | null>(null);

  const [documents, setDocuments] = useState<CustomRecordDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingType, setPendingType] = useState('');
  const [docToDelete, setDocToDelete] = useState<CustomRecordDocument | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza formulário ao carregar definição/registro
    setFormValues(buildInitialFormValues(sortedFields, sourceRecord?.values ?? null));
  }, [sortedFields, sourceRecord]);

  useEffect(() => {
    if (!definition) return;
    if (isNew) {
      setTabTitle(tabKey, `Novo ${definition.titleSingular}`);
    } else if (sourceRecord) {
      setTabTitle(tabKey, sourceRecord.title);
    }
  }, [definition, isNew, sourceRecord, tabKey, setTabTitle]);

  useEffect(() => {
    if (!definition?.hasNotes || !recordId || !sourceRecord || !currentTenant) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carregamento inicial de anotações
    setNotesLoading(true);
    noteUC.get.execute(currentTenant.id, recordId)
      .then(setNotes)
      .finally(() => setNotesLoading(false));
  }, [definition, recordId, sourceRecord, currentTenant, noteUC]);

  useEffect(() => {
    if (!definition?.hasDocuments || !recordId || !sourceRecord || !currentTenant) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carregamento inicial de documentos
    setDocsLoading(true);
    docUC.get.execute(currentTenant.id, recordId)
      .then(setDocuments)
      .finally(() => setDocsLoading(false));
  }, [definition, recordId, sourceRecord, currentTenant, docUC]);

  const setFieldValue = useCallback((fieldKey: string, value: CustomFieldValue) => {
    setFormValues((prev) => ({ ...prev, [fieldKey]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!definition || !currentTenant) return;
    const validationError = validateRequiredFields(sortedFields, formValues);
    if (validationError) {
      notify(validationError, 'error');
      return;
    }
    setIsSaving(true);
    try {
      const values = formValuesToStoredValues(sortedFields, formValues);
      const title = resolveRecordTitle(values, definition.titleFieldKey);
      if (isNew) {
        const created = await createRecord({
          screenKey,
          title,
          values,
          createdBy: user?.id ?? '',
        });
        notify(`${definition.titleSingular} cadastrado com sucesso!`, 'success');
        const newTabKey = buildViewTabKey(screenKey, created.id);
        closeTab(tabKey, activePanelId ?? 'main');
        openTab(newTabKey);
        setTabTitle(newTabKey, created.title);
      } else if (recordId) {
        await updateRecord(recordId, screenKey, {
          title,
          values,
          updatedBy: user?.id ?? '',
          updatedByName: effectiveName,
          updatedByPhotoURL: user?.photoURL ?? '',
        });
        notify(`${definition.titleSingular} atualizado com sucesso!`, 'success');
        setTabTitle(tabKey, title);
      }
    } catch {
      notify('Erro ao salvar o registro.', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [definition, currentTenant, sortedFields, formValues, isNew, recordId, screenKey, createRecord, updateRecord, user, effectiveName, notify, tabKey, setTabTitle, closeTab, openTab, activePanelId]);

  const handleClone = useCallback(() => {
    if (!recordId) return;
    openTab(buildCloneTabKey(screenKey, recordId));
  }, [openTab, screenKey, recordId]);

  const requestDelete = useCallback(() => {
    if (sourceRecord && recordId) setRecordToDelete(sourceRecord);
  }, [sourceRecord, recordId]);

  const cancelDelete = useCallback(() => setRecordToDelete(null), []);

  const confirmDelete = useCallback(async () => {
    if (!recordToDelete) return;
    setIsDeleting(true);
    try {
      await deleteRecord(recordToDelete.id, screenKey);
      notify('Registro excluído com sucesso.', 'success');
      setRecordToDelete(null);
      closeTab(tabKey, activePanelId ?? 'main');
    } catch {
      notify('Erro ao excluir o registro.', 'error');
    } finally {
      setIsDeleting(false);
    }
  }, [recordToDelete, deleteRecord, screenKey, notify, closeTab, tabKey, activePanelId]);

  const openNoteEditor = useCallback(() => setIsNoteEditorOpen(true), []);
  const closeNoteEditor = useCallback(() => {
    setIsNoteEditorOpen(false);
    setNewNoteTitle('');
    setNewNoteText('');
  }, []);

  const toggleNoteExpanded = useCallback((id: string) => {
    setExpandedNoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleAddNote = useCallback(async () => {
    if (!newNoteTitle.trim() || !newNoteText.trim() || !recordId || !currentTenant || !user) return;
    setIsAddingNote(true);
    try {
      const note = await noteUC.add.execute(currentTenant.id, recordId, {
        screenKey,
        title: newNoteTitle.trim(),
        text: newNoteText.trim(),
        createdBy: user.id,
        createdByName: effectiveName,
        createdByPhotoUrl: user.photoURL ?? undefined,
      });
      setNotes((prev) => [note, ...prev]);
      setNewNoteTitle('');
      setNewNoteText('');
      setIsNoteEditorOpen(false);
      notify('Anotação adicionada.', 'success');
    } catch {
      notify('Erro ao adicionar anotação.', 'error');
    } finally {
      setIsAddingNote(false);
    }
  }, [newNoteTitle, newNoteText, recordId, screenKey, currentTenant, user, effectiveName, noteUC, notify]);

  const requestDeleteNote = useCallback((note: CustomRecordNote) => setNoteToDelete(note), []);
  const cancelDeleteNote = useCallback(() => setNoteToDelete(null), []);
  const confirmDeleteNote = useCallback(async () => {
    if (!noteToDelete || !recordId || !currentTenant) return;
    try {
      const actor: DeletionActor = { uid: user?.id ?? '', name: effectiveName, photoURL: user?.photoURL ?? '' };
      await noteUC.delete.execute(currentTenant.id, recordId, noteToDelete.id, actor);
      setNotes((prev) => prev.filter((n) => n.id !== noteToDelete.id));
      notify('Anotação excluída.', 'success');
    } catch {
      notify('Erro ao excluir anotação.', 'error');
    } finally {
      setNoteToDelete(null);
    }
  }, [noteToDelete, recordId, currentTenant, noteUC, notify, user, effectiveName]);

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
    if (!pendingFile || !recordId || !currentTenant || !user) return;
    setIsUploadingDoc(true);
    try {
      const raw = await docUC.upload.execute(currentTenant.id, recordId, pendingFile);
      const { url, storagePath } = JSON.parse(raw) as { url: string; storagePath: string };
      const addedDoc = await docUC.add.execute(currentTenant.id, recordId, {
        screenKey,
        name: pendingFile.name,
        type: pendingType.trim() || undefined,
        url,
        storagePath,
        createdBy: user.id,
        createdByName: effectiveName,
        createdByPhotoUrl: user.photoURL ?? undefined,
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
  }, [pendingFile, pendingType, recordId, screenKey, currentTenant, user, effectiveName, docUC, notify]);

  const requestDeleteDoc = useCallback((doc: CustomRecordDocument) => setDocToDelete(doc), []);
  const cancelDeleteDoc = useCallback(() => setDocToDelete(null), []);
  const confirmDeleteDoc = useCallback(async () => {
    if (!docToDelete || !recordId || !currentTenant) return;
    try {
      const actor: DeletionActor = { uid: user?.id ?? '', name: effectiveName, photoURL: user?.photoURL ?? '' };
      await docUC.delete.execute(currentTenant.id, recordId, docToDelete.id, docToDelete.storagePath, actor);
      setDocuments((prev) => prev.filter((d) => d.id !== docToDelete.id));
      notify('Documento excluído.', 'success');
    } catch {
      notify('Erro ao excluir documento.', 'error');
    } finally {
      setDocToDelete(null);
    }
  }, [docToDelete, recordId, currentTenant, docUC, notify, user, effectiveName]);

  const documentTypeOptions = useMemo<DynamicSelectOption[]>(
    () => documentTypeConfigs.filter((c) => c.isStatic !== false).map((c) => ({ value: c.key, label: c.label })),
    [documentTypeConfigs],
  );
  const documentTypeDynamicOptions = useMemo<DynamicSelectOption[]>(
    () => documentTypeConfigs.filter((c) => c.isStatic === false).map((c) => ({ value: c.key, label: c.label })),
    [documentTypeConfigs],
  );
  const handleAddDocumentType = useCallback(async (name: string) => { await addDocumentType(name); }, [addDocumentType]);
  const handleDeleteDocumentType = useCallback(async (key: string) => { await removeDocumentType(key); }, [removeDocumentType]);

  const recordNotFound = !isNew && !sourceRecord && fetchAttempted;

  return {
    definition,
    isAvailable,
    isLoadingDefinition,
    isNew,
    isAdmin,
    screenKey,
    activeTab,
    setActiveTab,
    sortedFields,
    formValues,
    setFieldValue,
    isSaving,
    handleSave,
    handleClone,
    recordToDelete,
    requestDelete,
    cancelDelete,
    confirmDelete,
    isDeleting,
    recordNotFound,
    notes,
    notesLoading,
    newNoteTitle,
    setNewNoteTitle,
    newNoteText,
    setNewNoteText,
    isAddingNote,
    isNoteEditorOpen,
    openNoteEditor,
    closeNoteEditor,
    expandedNoteIds,
    toggleNoteExpanded,
    handleAddNote,
    noteToDelete,
    requestDeleteNote,
    confirmDeleteNote,
    cancelDeleteNote,
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
