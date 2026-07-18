import { useCallback, useMemo } from 'react';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { useCustomRecords } from '../../../stores/useCustomRecords';
import { useTenant } from '../../../stores/useTenant';
import { useAuth } from '../../../stores/useAuth';
import { useDI } from '../../../infrastructure/di/useDI';
import { makeGetCustomRecordByIdUseCase } from '../../../domain/usecases/customrecords/GetCustomRecordByIdUseCase';
import {
  buildCloneTabKey,
  buildViewTabKey,
  parseDynamicTabKey,
} from '../../../shared/constants/dynamicScreenKeys';
import {
  buildInitialFormValues,
  collectRequiredErrors,
  formValuesToStoredValues,
  resolveRecordTitle,
  sortFieldsByOrder,
  validateRequiredFields,
} from '../../../domain/services/customFieldValues';
import { describeRuleIssues } from '../../../domain/schema/fieldRules';
import { validateRecordRules } from '../../../data/utils/recordRulesGate';
import { useEntityDetail, type EntityValidationResult } from '../../shared/entityScreen/useEntityDetail';
import { useNotesPort } from '../../shared/entityScreen/useNotesPort';
import { useDocumentsPort } from '../../shared/entityScreen/useDocumentsPort';
import type {
  EntityDocumentsController,
  EntityNotesController,
} from '../../shared/entityScreen/types';
import type { TagStoreAdapter } from '../../components/ui/TagManager';
import type {
  CustomFieldValue,
  CustomRecord,
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
  fieldErrors: Record<string, string>;
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

type Values = Record<string, CustomFieldValue>;

export const useViewDynamicRecordViewModel = (tabKey: string): ViewDynamicRecordViewModel => {
  const { getDefinition, isLoading: isLoadingDefinition, tagsByScreen, createTag, updateTag, deleteTag } = useScreenDefinitions();
  const { recordsByScreen, createRecord, updateRecord, deleteRecord } = useCustomRecords();
  const { currentTenant, tenantRole } = useTenant();
  const { user, effectiveName } = useAuth();
  const { customRecordRepository, customRecordNoteRepository, customRecordDocumentRepository } = useDI();

  const screenKey = useMemo(() => parseDynamicTabKey(tabKey)?.screenKey ?? '', [tabKey]);
  const recordId = useMemo(() => {
    const t = parseDynamicTabKey(tabKey);
    return t?.kind === 'view' ? (t.recordId ?? null) : null;
  }, [tabKey]);
  const definition = useMemo(() => getDefinition(screenKey) ?? null, [getDefinition, screenKey]);
  const isAvailable = !!definition && !definition.builtin;
  const isAdmin = tenantRole === 'admin';

  const sortedFields = useMemo(() => (definition ? sortFieldsByOrder(definition.fields) : []), [definition]);
  const titleFieldKey = definition?.titleFieldKey ?? '';

  const getByIdUC = useMemo(() => makeGetCustomRecordByIdUseCase(customRecordRepository), [customRecordRepository]);

  const parse = useCallback((tk: string) => {
    const t = parseDynamicTabKey(tk);
    return {
      isNew: t?.kind === 'new',
      recordId: t?.kind === 'view' ? (t.recordId ?? null) : null,
      cloneSourceId: t?.cloneSourceId ?? null,
    };
  }, []);

  const findInStore = useCallback(
    (id: string) => (recordsByScreen[screenKey] ?? []).find((r) => r.id === id) ?? null,
    [recordsByScreen, screenKey],
  );

  const getById = useCallback(
    (id: string) => (currentTenant ? getByIdUC.execute(currentTenant.id, id) : Promise.resolve(null)),
    [getByIdUC, currentTenant],
  );

  const recordToValues = useCallback(
    (record: CustomRecord | null) => buildInitialFormValues(sortedFields, record?.values ?? null),
    [sortedFields],
  );

  const resolveTabTitle = useCallback(
    (record: CustomRecord | null, isNew: boolean) => {
      if (!definition) return null;
      return isNew ? `Novo ${definition.titleSingular}` : (record?.title ?? null);
    },
    [definition],
  );

  const resolveTitleFromValues = useCallback(
    (values: Values) => resolveRecordTitle(formValuesToStoredValues(sortedFields, values), titleFieldKey),
    [sortedFields, titleFieldKey],
  );

  const validate = useCallback(
    (values: Values): EntityValidationResult | null => {
      const fieldErrors = collectRequiredErrors(sortedFields, values);
      const issues = validateRecordRules(screenKey, { values: formValuesToStoredValues(sortedFields, values) });
      issues.forEach((issue) => { if (!fieldErrors[issue.path]) fieldErrors[issue.path] = issue.error; });
      if (Object.keys(fieldErrors).length === 0) return null;
      const message = validateRequiredFields(sortedFields, values) ?? describeRuleIssues(issues);
      return { message, fieldErrors };
    },
    [sortedFields, screenKey],
  );

  const create = useCallback(
    async (values: Values) => {
      const stored = formValuesToStoredValues(sortedFields, values);
      const title = resolveRecordTitle(stored, titleFieldKey);
      const created = await createRecord({ screenKey, title, values: stored, createdBy: user?.id ?? '' });
      return { id: created.id, title: created.title };
    },
    [sortedFields, titleFieldKey, createRecord, screenKey, user],
  );

  const update = useCallback(
    async (id: string, values: Values) => {
      const stored = formValuesToStoredValues(sortedFields, values);
      const title = resolveRecordTitle(stored, titleFieldKey);
      await updateRecord(id, screenKey, {
        title,
        values: stored,
        updatedBy: user?.id ?? '',
        updatedByName: effectiveName,
        updatedByPhotoURL: user?.photoURL ?? '',
      });
    },
    [sortedFields, titleFieldKey, updateRecord, screenKey, user, effectiveName],
  );

  const deepLinkKey = useCallback((id: string) => buildViewTabKey(screenKey, id), [screenKey]);
  const cloneKey = useCallback((id: string) => buildCloneTabKey(screenKey, id), [screenKey]);
  const remove = useCallback((id: string) => deleteRecord(id, screenKey), [deleteRecord, screenKey]);

  const noteDocExtra = useMemo(() => ({ screenKey }), [screenKey]);
  const notesPort = useNotesPort(customRecordNoteRepository, noteDocExtra);
  const documentsPort = useDocumentsPort(customRecordDocumentRepository, noteDocExtra);

  const messages = useMemo(() => ({
    created: `${definition?.titleSingular ?? 'Registro'} cadastrado com sucesso!`,
    updated: `${definition?.titleSingular ?? 'Registro'} atualizado com sucesso!`,
    error: 'Erro ao salvar o registro.',
  }), [definition]);

  const detail = useEntityDetail<CustomRecord>({
    tabKey,
    parse,
    findInStore,
    getById,
    recordToValues,
    resolveTabTitle,
    resolveTitleFromValues,
    validate,
    create,
    update,
    messages,
    deepLinkKey,
    cloneKey,
    remove,
    removedMessage: 'Registro excluído com sucesso.',
    removeErrorMessage: 'Erro ao excluir o registro.',
    notesPort,
    documentsPort,
    hasNotes: !!definition?.hasNotes,
    hasDocuments: !!definition?.hasDocuments,
  });

  const screenTags = useMemo(() => tagsByScreen[screenKey] ?? [], [tagsByScreen, screenKey]);
  const sourceRecord = detail.record;

  const tagAdapter: TagStoreAdapter = useMemo(() => ({
    tags: screenTags,
    getAppliedTags: (entityId: string) => { void entityId; return screenTags.filter((t) => sourceRecord?.tagIds?.includes(t.id)); },
    setTags: (entityId: string, tagIds: string[]) => updateRecord(entityId, screenKey, { tagIds }),
    createTag: (name: string, color: string) => createTag(screenKey, name, color),
    updateTag: (id: string, data: { name: string; color: string }) => updateTag(screenKey, id, data),
    deleteTag: (id: string) => deleteTag(screenKey, id),
  }), [screenTags, sourceRecord, updateRecord, screenKey, createTag, updateTag, deleteTag]);

  return {
    definition,
    isAvailable,
    isLoadingDefinition,
    isNew: detail.isNew,
    isAdmin,
    screenKey,
    recordId,
    activeTab: detail.activeTab,
    setActiveTab: detail.setActiveTab,
    sortedFields,
    formValues: detail.values,
    setFieldValue: detail.setFieldValue,
    fieldErrors: detail.fieldErrors,
    isSaving: detail.isSaving,
    handleSave: detail.handleSave,
    handleClone: detail.handleClone,
    copyLinkDone: detail.copyLinkDone,
    handleCopyDeepLink: detail.handleCopyDeepLink,
    recordToDelete: detail.isDeleteOpen ? detail.record : null,
    requestDelete: detail.requestDelete,
    cancelDelete: detail.cancelDelete,
    confirmDelete: detail.confirmDelete,
    isDeleting: detail.isDeleting,
    recordNotFound: detail.recordNotFound,
    notesController: detail.notesController,
    docsController: detail.docsController,
    tagAdapter,
    isTagManagerOpen: detail.isTagManagerOpen,
    openTagManager: detail.openTagManager,
    closeTagManager: detail.closeTagManager,
  };
};
