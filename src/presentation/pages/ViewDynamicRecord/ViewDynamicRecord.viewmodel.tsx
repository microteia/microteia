import { useCallback, useEffect, useMemo, useState } from 'react';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { useCustomRecords } from '../../../stores/useCustomRecords';
import { useTenant } from '../../../stores/useTenant';
import { useAuth } from '../../../stores/useAuth';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useNotification } from '../../../stores/useNotification';
import { useDI } from '../../../infrastructure/di/useDI';
import { generateDeepLink } from '../../../infrastructure/deeplink/deepLinkUtils';
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
import { describeRuleIssues } from '../../../domain/schema/fieldRules';
import { validateRecordRules } from '../../../data/utils/recordRulesGate';
import { useEntityNotes } from '../../shared/entityScreen/useEntityNotes';
import { useEntityDocuments } from '../../shared/entityScreen/useEntityDocuments';
import type {
  EntityDocumentsController,
  EntityNotesController,
  DocumentsPort,
  NotesPort,
} from '../../shared/entityScreen/types';
import type { TagStoreAdapter } from '../../components/ui/TagManager';
import type {
  CustomFieldValue,
  CustomRecord,
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
  recordId: string | null;
  activeTab: ViewDynamicRecordTab;
  setActiveTab: (tab: ViewDynamicRecordTab) => void;
  sortedFields: FieldDefinition[];
  formValues: Record<string, CustomFieldValue>;
  setFieldValue: (fieldKey: string, value: CustomFieldValue) => void;
  isSaving: boolean;
  handleSave: () => Promise<void>;
  handleClone: () => void;
  copyLinkDone: boolean;
  handleCopyDeepLink: () => void;
  recordToDelete: CustomRecord | null;
  requestDelete: () => void;
  cancelDelete: () => void;
  confirmDelete: () => Promise<void>;
  isDeleting: boolean;
  recordNotFound: boolean;
  notesController: EntityNotesController;
  docsController: EntityDocumentsController;
  tagAdapter: TagStoreAdapter;
  isTagManagerOpen: boolean;
  openTagManager: () => void;
  closeTagManager: () => void;
}

export const useViewDynamicRecordViewModel = (tabKey: string): ViewDynamicRecordViewModel => {
  const { getDefinition, isLoading: isLoadingDefinition, tagsByScreen, createTag, updateTag, deleteTag } = useScreenDefinitions();
  const { recordsByScreen, createRecord, updateRecord, deleteRecord } = useCustomRecords();
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
  const [copyLinkDone, setCopyLinkDone] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<CustomRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);

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

  const notesPort = useMemo<NotesPort>(() => ({
    get: (rid) => (currentTenant ? noteUC.get.execute(currentTenant.id, rid) : Promise.resolve([])),
    add: (rid, input) => noteUC.add.execute(currentTenant?.id ?? '', rid, {
      screenKey,
      title: input.title,
      text: input.text,
      createdBy: user?.id ?? '',
      createdByName: effectiveName,
      createdByPhotoUrl: user?.photoURL ?? undefined,
    }),
    remove: (rid, noteId) => {
      const actor: DeletionActor = { uid: user?.id ?? '', name: effectiveName, photoURL: user?.photoURL ?? '' };
      return noteUC.delete.execute(currentTenant?.id ?? '', rid, noteId, actor);
    },
  }), [noteUC, currentTenant, user, effectiveName, screenKey]);

  const documentsPort = useMemo<DocumentsPort>(() => ({
    get: (rid) => (currentTenant ? docUC.get.execute(currentTenant.id, rid) : Promise.resolve([])),
    upload: async (rid, file) => {
      const raw = await docUC.upload.execute(currentTenant?.id ?? '', rid, file);
      return JSON.parse(raw) as { url: string; storagePath: string };
    },
    add: (rid, input) => docUC.add.execute(currentTenant?.id ?? '', rid, {
      screenKey,
      name: input.name,
      type: input.type,
      url: input.url,
      storagePath: input.storagePath,
      createdBy: user?.id ?? '',
      createdByName: effectiveName,
      createdByPhotoUrl: user?.photoURL ?? undefined,
    }),
    remove: (rid, doc) => {
      const actor: DeletionActor = { uid: user?.id ?? '', name: effectiveName, photoURL: user?.photoURL ?? '' };
      return docUC.delete.execute(currentTenant?.id ?? '', rid, doc.id, doc.storagePath, actor);
    },
  }), [docUC, currentTenant, user, effectiveName, screenKey]);

  const notesController = useEntityNotes({ enabled: !!definition?.hasNotes && !!sourceRecord, recordId, port: notesPort });
  const docsController = useEntityDocuments({ enabled: !!definition?.hasDocuments && !!sourceRecord, recordId, port: documentsPort });

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

      const ruleIssues = validateRecordRules(screenKey, { values });
      if (ruleIssues.length > 0) {
        notify(describeRuleIssues(ruleIssues), 'error');
        return;
      }

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

  const handleCopyDeepLink = useCallback(() => {
    if (!recordId) return;
    void navigator.clipboard.writeText(generateDeepLink(buildViewTabKey(screenKey, recordId)));
    setCopyLinkDone(true);
    setTimeout(() => setCopyLinkDone(false), 2000);
  }, [screenKey, recordId]);

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

  const screenTags = useMemo(() => tagsByScreen[screenKey] ?? [], [tagsByScreen, screenKey]);

  const tagAdapter: TagStoreAdapter = useMemo(() => ({
    tags: screenTags,
    getAppliedTags: (entityId: string) => { void entityId; return screenTags.filter((t) => sourceRecord?.tagIds?.includes(t.id)); },
    setTags: (entityId: string, tagIds: string[]) => updateRecord(entityId, screenKey, { tagIds }),
    createTag: (name: string, color: string) => createTag(screenKey, name, color),
    updateTag: (id: string, data: { name: string; color: string }) => updateTag(screenKey, id, data),
    deleteTag: (id: string) => deleteTag(screenKey, id),
  }), [screenTags, sourceRecord, updateRecord, screenKey, createTag, updateTag, deleteTag]);

  const openTagManager = useCallback(() => setIsTagManagerOpen(true), []);
  const closeTagManager = useCallback(() => setIsTagManagerOpen(false), []);

  const recordNotFound = !isNew && !sourceRecord && fetchAttempted;

  return {
    definition,
    isAvailable,
    isLoadingDefinition,
    isNew,
    isAdmin,
    screenKey,
    recordId,
    activeTab,
    setActiveTab,
    sortedFields,
    formValues,
    setFieldValue,
    isSaving,
    handleSave,
    handleClone,
    copyLinkDone,
    handleCopyDeepLink,
    recordToDelete,
    requestDelete,
    cancelDelete,
    confirmDelete,
    isDeleting,
    recordNotFound,
    notesController,
    docsController,
    tagAdapter,
    isTagManagerOpen,
    openTagManager,
    closeTagManager,
  };
};
