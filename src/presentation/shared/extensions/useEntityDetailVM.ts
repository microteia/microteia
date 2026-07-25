import { useCallback, useMemo } from 'react';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { useCustomRecords } from '../../../stores/useCustomRecords';
import { useTenant } from '../../../stores/useTenant';
import { useAuth } from '../../../stores/useAuth';
import { useDI } from '../../../infrastructure/di/useDI';
import { makeGetCustomRecordByIdUseCase } from '../../../domain/usecases/customrecords/GetCustomRecordByIdUseCase';
import {
  buildInitialFormValues,
  collectRequiredErrors,
  formValuesToStoredValues,
  resolveRecordTitle,
  sortFieldsByOrder,
  validateRequiredFields,
} from '../../../domain/services/customFieldValues';
import { describeRuleIssues } from '../../../domain/schema/fieldRules';
import { validateRecordRules, ruleIssueFieldKey } from '../../../data/utils/recordRulesGate';
import { useEntityDetail, type EntityValidationResult } from '../entityScreen/useEntityDetail';
import { useNotesPort } from '../entityScreen/useNotesPort';
import { useDocumentsPort } from '../entityScreen/useDocumentsPort';
import type { RecordDetailViewModel } from '../../components/layout/RecordDetailSurface';
import type { CustomFieldValue, CustomRecord } from '../../../domain/entities';
import type { TagStoreAdapter } from '../../components/ui/TagManager';

type Values = Record<string, CustomFieldValue>;

export interface EntityDetailVMOptions {
  /** Prefixo das abas da própria tela de edição da extensão (ex.: 'processo-clone-edit:'). */
  editKeyPrefix: string;
}

/**
 * View model de DETALHE (criar/editar) de uma entidade dinâmica, para uma tela de código de extensão.
 * Espelha o detalhe nativo (`useViewDynamicRecordViewModel`) — mesma superfície, ações, abas e regras —
 * mas resolve a tela pelo `sourceId` e aponta os links (copiar link, clonar, reabrir ao salvar) para a
 * PRÓPRIA tela de edição da extensão (`editKeyPrefix`), não para o detalhe nativo. Combinado com
 * `RecordDetailSurface`, dá ao editor da extensão a mesma fidelidade do sistema com uma linha.
 */
export const useEntityDetailVM = (
  sourceId: string,
  tabKey: string,
  { editKeyPrefix }: EntityDetailVMOptions,
): RecordDetailViewModel => {
  const { dynamicScreens, isLoading: isLoadingDefinition, tagsByScreen, createTag, updateTag, deleteTag } = useScreenDefinitions();
  const { recordsByScreen, createRecord, updateRecord, deleteRecord } = useCustomRecords();
  const { currentTenant, tenantRole } = useTenant();
  const { user, effectiveName } = useAuth();
  const { customRecordRepository, customRecordNoteRepository, customRecordDocumentRepository } = useDI();

  const definition = useMemo(
    () => dynamicScreens.find((d) => (d.sourceId ?? d.id) === sourceId) ?? null,
    [dynamicScreens, sourceId],
  );
  const screenKey = definition?.id ?? '';
  const isAvailable = !!definition && !definition.builtin;
  const isAdmin = tenantRole === 'admin';

  const sortedFields = useMemo(() => (definition ? sortFieldsByOrder(definition.fields) : []), [definition]);
  const titleFieldKey = definition?.titleFieldKey ?? '';

  const parseTab = useCallback((tk: string) => {
    const rest = tk.startsWith(editKeyPrefix) ? tk.slice(editKeyPrefix.length) : '';
    if (rest === '' || rest === 'new') return { isNew: true, recordId: null, cloneSourceId: null };
    if (rest.startsWith('clone:')) return { isNew: true, recordId: null, cloneSourceId: rest.slice('clone:'.length) };
    return { isNew: false, recordId: rest, cloneSourceId: null };
  }, [editKeyPrefix]);

  const recordId = useMemo(() => parseTab(tabKey).recordId, [parseTab, tabKey]);

  const getByIdUC = useMemo(() => makeGetCustomRecordByIdUseCase(customRecordRepository), [customRecordRepository]);

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
      issues.forEach((issue) => {
        const key = ruleIssueFieldKey(issue.path);
        if (!fieldErrors[key]) fieldErrors[key] = issue.error;
      });
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

  const deepLinkKey = useCallback((id: string) => `${editKeyPrefix}${id}`, [editKeyPrefix]);
  const cloneKey = useCallback((id: string) => `${editKeyPrefix}clone:${id}`, [editKeyPrefix]);
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
    entityKey: screenKey,
    parse: parseTab,
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
    recordNotFound: detail.recordNotFound,
    sortedFields,
    formValues: detail.values,
    setFieldValue: detail.setFieldValue,
    mergeValues: detail.mergeValues,
    fieldErrors: detail.fieldErrors,
    isSaving: detail.isSaving,
    handleSave: detail.handleSave,
    handleClone: detail.handleClone,
    copyLinkDone: detail.copyLinkDone,
    handleCopyDeepLink: detail.handleCopyDeepLink,
    screenActions: detail.screenActions,
    activeTab: detail.activeTab,
    setActiveTab: detail.setActiveTab,
    childTabs: detail.childTabs,
    notesController: detail.notesController,
    docsController: detail.docsController,
    tagAdapter,
    isTagManagerOpen: detail.isTagManagerOpen,
    openTagManager: detail.openTagManager,
    closeTagManager: detail.closeTagManager,
    recordToDelete: detail.isDeleteOpen ? detail.record : null,
    requestDelete: detail.requestDelete,
    cancelDelete: detail.cancelDelete,
    confirmDelete: detail.confirmDelete,
    isDeleting: detail.isDeleting,
  };
};
