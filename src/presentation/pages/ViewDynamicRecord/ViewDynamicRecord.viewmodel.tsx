import { useCallback, useMemo } from 'react';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { useRecords } from '../../../stores/useRecords';
import { useTenant } from '../../../stores/useTenant';
import { useAuth } from '../../../stores/useAuth';
import { useDI } from '../../../infrastructure/di/useDI';
import { makeGetRecordByIdUseCase } from '../../../domain/usecases/records/GetRecordByIdUseCase';
import {
  buildCloneTabKey,
  buildEntityViewTabKey,
  buildViewTabKey,
  parseDynamicTabKey,
} from '../../../shared/constants/dynamicScreenKeys';
import {
  buildInitialFormValues,
  collectRequiredErrors,
  formValuesToStoredValues,
  readRecordText,
  resolveRecordTitle,
  sortFieldsByOrder,
  validateRequiredFields,
} from '../../../domain/services/customFieldValues';
import { describeRuleIssues } from '../../../domain/schema/fieldRules';
import { validateRecordRules } from '../../../data/utils/recordRulesGate';
import { useEntityDetail, type EntityValidationResult } from '../../shared/entityScreen/useEntityDetail';
import type { ScreenActions } from '../../shared/entityScreen/useScreenActions';
import { useRecordDocumentsPort, useRecordNotesPort } from '../../shared/entityScreen/useRecordPorts';
import type {
  EntityDocumentsController,
  EntityNotesController,
} from '../../shared/entityScreen/types';
import type { TagStoreAdapter } from '../../components/ui/TagManager';
import type { EntityDetailExtraTab, EntityDetailTab } from '../../components/layout/EntityDetailView';
import { useTagAdapter } from '../../shared/entityScreen/useTagAdapter';
import { isBoundScreen, screenDataCollection } from '../../../domain/services/screenDataCollection';
import { useEntityFormFields } from '../../shared/useEntityFormFields';
import type {
  CustomFieldValue,
  EntityRecord,
  FieldDefinition,
  ScreenDefinition,
} from '../../../domain/entities';

export type ViewDynamicRecordTab = 'data' | 'notes' | 'documents';

export interface ViewDynamicRecordViewModel {
  definition: ScreenDefinition | null;
  isAvailable: boolean;
  isLoadingDefinition: boolean;
  isNew: boolean;
  screenActions: ScreenActions;
  isAdmin: boolean;
  screenKey: string;
  recordId: string | null;
  activeTab: EntityDetailTab;
  setActiveTab: (tab: EntityDetailTab) => void;
  sortedFields: FieldDefinition[];
  formValues: Record<string, CustomFieldValue>;
  setFieldValue: (fieldKey: string, value: CustomFieldValue) => void;
  mergeValues: (patch: Record<string, unknown>) => void;
  fieldErrors: Record<string, string>;
  isSaving: boolean;
  handleSave: () => Promise<void>;
  handleClone: () => void;
  copyLinkDone: boolean;
  handleCopyDeepLink: () => void;
  recordToDelete: EntityRecord | null;
  requestDelete: () => void;
  cancelDelete: () => void;
  confirmDelete: () => Promise<void>;
  isDeleting: boolean;
  recordNotFound: boolean;
  /** Título do REGISTRO (campo-título). Vazio → o cabeçalho cai no nome da tela. */
  recordTitle: string;
  /** Subtítulo do registro (`subtitleFieldKey`), abaixo do título. Vazio → sem subtítulo. */
  recordSubtitle: string;
  notesController: EntityNotesController;
  docsController: EntityDocumentsController;
  childTabs: EntityDetailExtraTab[];
  tagAdapter: TagStoreAdapter;
  isTagManagerOpen: boolean;
  openTagManager: () => void;
  closeTagManager: () => void;
}

type Values = Record<string, CustomFieldValue>;

export const useViewDynamicRecordViewModel = (tabKey: string): ViewDynamicRecordViewModel => {
  const { getDefinition, isLoading: isLoadingDefinition } = useScreenDefinitions();
  const { recordsByCollection, createRecord, updateRecord, deleteRecord } = useRecords();
  const { currentTenant, tenantRole } = useTenant();
  const { user, effectiveName } = useAuth();
  const { recordRepository } = useDI();

  const screenKey = useMemo(() => parseDynamicTabKey(tabKey)?.screenKey ?? '', [tabKey]);
  const recordId = useMemo(() => {
    const t = parseDynamicTabKey(tabKey);
    return t?.kind === 'view' ? (t.recordId ?? null) : null;
  }, [tabKey]);
  const definition = useMemo(() => getDefinition(screenKey) ?? null, [getDefinition, screenKey]);

  // Ao criar um filho a partir da aba do pai, a chave carrega quem é o pai.
  const parentContext = useMemo(() => {
    const info = parseDynamicTabKey(tabKey);
    return info?.parentEntity && info.parentId
      ? { entity: info.parentEntity, id: info.parentId }
      : null;
  }, [tabKey]);
  const isAvailable = !!definition && definition.origin !== 'builtin';
  const isAdmin = tenantRole === 'admin';

  // Tela que é VISÃO sobre outra coleção lê e grava lá, e herda os campos da entidade alvo.
  const collection = definition ? screenDataCollection(definition) : screenKey;
  const isBound = !!definition && isBoundScreen(definition);
  const boundFields = useEntityFormFields(isBound ? collection : '');

  const sortedFields = useMemo(
    () => (isBound ? boundFields.fields : definition ? sortFieldsByOrder(definition.fields) : []),
    [isBound, boundFields.fields, definition],
  );
  const titleFieldKey = definition?.titleFieldKey ?? '';
  const subtitleFieldKey = definition?.subtitleFieldKey ?? '';

  const getByIdUC = useMemo(() => makeGetRecordByIdUseCase(recordRepository), [recordRepository]);

  const parse = useCallback((tk: string) => {
    const t = parseDynamicTabKey(tk);
    return {
      isNew: t?.kind === 'new',
      recordId: t?.kind === 'view' ? (t.recordId ?? null) : null,
      cloneSourceId: t?.cloneSourceId ?? null,
    };
  }, []);

  const findInStore = useCallback(
    (id: string) => (recordsByCollection[collection] ?? []).find((r) => r.id === id) ?? null,
    [recordsByCollection, collection],
  );

  const getById = useCallback(
    (id: string) => (currentTenant ? getByIdUC.execute(currentTenant.id, collection, id) : Promise.resolve(null)),
    [getByIdUC, currentTenant, collection],
  );

  const recordToValues = useCallback(
    (record: EntityRecord | null) => {
      const values = buildInitialFormValues(sortedFields, record);
      // Registro filho novo já nasce vinculado ao pai que abriu a aba.
      if (parentContext && definition?.parentFieldKey) {
        values[definition.parentFieldKey] = parentContext.id;
      }
      return values;
    },
    [sortedFields, parentContext, definition],
  );

  // Rótulo da aba: o subtítulo declarado quando existe (curto e único, como o número do processo),
  // senão o título. Mesma escolha das telas fixas.
  const resolveTabTitle = useCallback(
    (record: EntityRecord | null, isNew: boolean) => {
      if (!definition) return null;
      if (isNew) return `Novo ${definition.titleSingular}`;
      if (!record) return null;
      return readRecordText(record, subtitleFieldKey) || resolveRecordTitle(record, titleFieldKey);
    },
    [definition, subtitleFieldKey, titleFieldKey],
  );

  const resolveTitleFromValues = useCallback(
    (values: Values) => resolveRecordTitle(formValuesToStoredValues(sortedFields, values), titleFieldKey),
    [sortedFields, titleFieldKey],
  );

  const validate = useCallback(
    (values: Values): EntityValidationResult | null => {
      const fieldErrors = collectRequiredErrors(sortedFields, values);
      const issues = validateRecordRules(collection, formValuesToStoredValues(sortedFields, values));
      issues.forEach((issue) => {
        if (!fieldErrors[issue.path]) fieldErrors[issue.path] = issue.error;
      });
      if (Object.keys(fieldErrors).length === 0) return null;
      const message = validateRequiredFields(sortedFields, values) ?? describeRuleIssues(issues);
      return { message, fieldErrors };
    },
    [sortedFields, collection],
  );

  const create = useCallback(
    async (values: Values) => {
      const stored = formValuesToStoredValues(sortedFields, values);
      const created = await createRecord(collection, { ...stored, createdBy: user?.id ?? '' });
      return { id: created.id, title: resolveRecordTitle(created, titleFieldKey) };
    },
    [sortedFields, titleFieldKey, createRecord, collection, user],
  );

  const update = useCallback(
    async (id: string, values: Values) => {
      await updateRecord(collection, id, {
        ...formValuesToStoredValues(sortedFields, values),
        updatedBy: user?.id ?? '',
        updatedByName: effectiveName,
        updatedByPhotoURL: user?.photoURL ?? '',
      });
    },
    [sortedFields, updateRecord, collection, user, effectiveName],
  );

  const deepLinkKey = useCallback((id: string) => buildViewTabKey(screenKey, id), [screenKey]);
  const cloneKey = useCallback((id: string) => buildCloneTabKey(screenKey, id), [screenKey]);
  const remove = useCallback((id: string) => deleteRecord(collection, id), [deleteRecord, collection]);

  // Registro filho volta para o pai ao salvar. Na criação o pai vem da chave da aba; na edição,
  // do valor já gravado no campo de vínculo.
  const returnTabKey = useMemo(() => {
    if (parentContext) return buildEntityViewTabKey(parentContext.entity, parentContext.id);
    if (!definition?.parentEntity || !definition.parentFieldKey || !recordId) return undefined;
    const existing = (recordsByCollection[collection] ?? []).find((r) => r.id === recordId);
    const parentId = existing?.[definition.parentFieldKey];
    return typeof parentId === 'string' && parentId
      ? buildEntityViewTabKey(definition.parentEntity, parentId)
      : undefined;
  }, [parentContext, definition, recordId, recordsByCollection, collection]);

  // O campo de vínculo não vai ao formulário (já vem preenchido), mas segue em `sortedFields`
  // para ser gravado normalmente.
  const formFields = useMemo(
    () => (definition?.parentFieldKey
      ? sortedFields.filter((f) => f.key !== definition.parentFieldKey)
      : sortedFields),
    [sortedFields, definition],
  );

  const notesPort = useRecordNotesPort(collection);
  const documentsPort = useRecordDocumentsPort(collection);

  const messages = useMemo(() => ({
    created: `${definition?.titleSingular ?? 'Registro'} cadastrado com sucesso!`,
    updated: `${definition?.titleSingular ?? 'Registro'} atualizado com sucesso!`,
    error: 'Erro ao salvar o registro.',
  }), [definition]);

  const detail = useEntityDetail<EntityRecord>({
    tabKey,
    entityKey: collection,
    configScreenKey: screenKey,
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
    returnTabKey,
  });

    const sourceRecord = detail.record;

  // Cabeçalho: título e subtítulo do REGISTRO, como nas telas fixas.
  const recordTitle = sourceRecord ? readRecordText(sourceRecord, titleFieldKey) : '';
  const recordSubtitle = sourceRecord ? readRecordText(sourceRecord, subtitleFieldKey) : '';

  const tagIdsOf = useCallback(() => sourceRecord?.tagIds ?? [], [sourceRecord]);
  const setRecordTags = useCallback(
    (entityId: string, tagIds: string[]) => updateRecord(collection, entityId, { tagIds }),
    [updateRecord, collection],
  );
  const tagAdapter = useTagAdapter(collection, tagIdsOf, setRecordTags, definition?.tagCollection);

  return {
    definition,
    isAvailable,
    isLoadingDefinition,
    isNew: detail.isNew,
    screenActions: detail.screenActions,
    isAdmin,
    screenKey,
    recordId,
    activeTab: detail.activeTab,
    setActiveTab: detail.setActiveTab,
    sortedFields: formFields,
    formValues: detail.values,
    setFieldValue: detail.setFieldValue,
    mergeValues: detail.mergeValues,
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
    recordTitle,
    recordSubtitle,
    notesController: detail.notesController,
    docsController: detail.docsController,
    childTabs: detail.childTabs,
    tagAdapter,
    isTagManagerOpen: detail.isTagManagerOpen,
    openTagManager: detail.openTagManager,
    closeTagManager: detail.closeTagManager,
  };
};
