import { useCallback, useMemo } from 'react';
import { useTheme } from 'styled-components';
import { useCaseStore } from '../../../stores/useCaseStore';
import { useCaseTagStore } from '../../../stores/useCaseTagStore';
import { useCaseLookup, type CaseLookupKind } from '../../../stores/useCaseLookup';
import { useAuth } from '../../../stores/useAuth';
import { useTenant } from '../../../stores/useTenant';
import { useEntityFormFields } from '../../shared/useEntityFormFields';
import { useDI } from '../../../infrastructure/di/useDI';
import { resolveColor } from '../../../shared/styles/colorUtils';
import { toDateInputValue } from '../../../utils/formatters';
import type {
  Case, CaseArea, CaseInstance, CasePhase, CaseStatus,
  CustomFieldValue, FieldDefinition,
} from '../../../domain/entities';
import type { LookupOptionSet } from '../../components/ui/CustomFieldsSection/CustomFieldsSection.viewmodel';
import type { TagStoreAdapter } from '../../components/ui/TagManager/TagManager.viewmodel';
import type { EntityDetailExtraTab, EntityDetailTab } from '../../components/layout/EntityDetailView';
import { useEntityDetail, type EntityValidationResult } from '../../shared/entityScreen/useEntityDetail';
import type { ScreenActions } from '../../shared/entityScreen/useScreenActions';
import { useNotesPort } from '../../shared/entityScreen/useNotesPort';
import { useDocumentsPort } from '../../shared/entityScreen/useDocumentsPort';
import type { EntityNotesController, EntityDocumentsController } from '../../shared/entityScreen/types';
import {
  buildInitialFormValues,
  collectRequiredErrors,
  formValuesToStoredValues,
  validateRequiredFields,
} from '../../../domain/services/customFieldValues';
import { describeRuleIssues } from '../../../domain/schema/fieldRules';
import { validateRecordRules, ruleIssueFieldKey } from '../../../data/utils/recordRulesGate';

export type ViewCaseTab = 'data' | 'notes' | 'documents';

type Values = Record<string, CustomFieldValue>;

const CLONE_PREFIX = 'new-case:clone:';

const NEW_CASE_DEFAULTS = {
  area: 'Cível',
  instance: '1º Grau',
  phase: 'Fase Inicial',
  status: 'Em Andamento',
};

const LOOKUP_COLLECTION_TO_KIND: Record<string, CaseLookupKind> = {
  caseAreas: 'areas',
  casePhases: 'phases',
  caseStatuses: 'statuses',
  caseInstances: 'instances',
  caseActionTypes: 'actionTypes',
  caseCourts: 'courts',
  caseDistricts: 'districts',
  caseJudges: 'judges',
};

const parseCaseTab = (tabKey: string) => {
  const cloneSourceId = tabKey.startsWith(CLONE_PREFIX) ? tabKey.slice(CLONE_PREFIX.length) : null;
  const isNew = tabKey === 'new-case' || cloneSourceId !== null;
  return { isNew, recordId: isNew ? null : tabKey.replace('view-case:', ''), cloneSourceId };
};

const caseToValues = (
  c: Case | null,
  customFields: FieldDefinition[],
  clone: boolean,
): Values => ({
  caseNumber: clone ? '' : (c?.caseNumber ?? ''),
  title: c?.title ?? '',
  activePoleIds: c?.activePoleIds ?? [],
  passivePoleIds: c?.passivePoleIds ?? [],
  area: c ? c.area ?? '' : NEW_CASE_DEFAULTS.area,
  type: c?.type ?? [],
  court: c?.court ?? '',
  courtDistrict: c?.courtDistrict ?? '',
  judge: c?.judge ?? '',
  instance: c ? c.instance ?? '' : NEW_CASE_DEFAULTS.instance,
  phase: c ? c.phase ?? '' : NEW_CASE_DEFAULTS.phase,
  status: c ? c.status ?? '' : NEW_CASE_DEFAULTS.status,
  responsibleLawyerId: c?.responsibleLawyerId ?? '',
  contractId: c?.contractId ?? '',
  filedAt: toDateInputValue(c?.filedAt),
  causeValue: c?.causeValue ?? null,
  notes: c?.notes ?? '',
  ...buildInitialFormValues(customFields, c?.customValues ?? null),
} as unknown as Values);

const str = (values: Values, key: string): string => {
  const v = (values as Record<string, unknown>)[key];
  return typeof v === 'string' ? v : '';
};

const strArray = (values: Values, key: string): string[] => {
  const v = (values as Record<string, unknown>)[key];
  return Array.isArray(v) ? (v as string[]) : [];
};

const num = (values: Values, key: string): number | null => {
  const v = (values as Record<string, unknown>)[key];
  return typeof v === 'number' ? v : null;
};

/** `opposingParties` e `tagIds` não são campos do formulário — vêm do registro existente. */
const valuesToCasePayload = (
  values: Values,
  customFields: FieldDefinition[],
  existing: Case | null,
) => {
  const types = strArray(values, 'type');
  return {
    caseNumber: str(values, 'caseNumber').trim(),
    title: str(values, 'title').trim(),
    area: str(values, 'area') as CaseArea,
    type: types.length > 0 ? types : undefined,
    court: str(values, 'court') || null,
    courtDistrict: str(values, 'courtDistrict') || null,
    judge: str(values, 'judge') || null,
    instance: str(values, 'instance') as CaseInstance,
    phase: str(values, 'phase') as CasePhase,
    status: str(values, 'status') as CaseStatus,
    responsibleLawyerId: str(values, 'responsibleLawyerId') || null,
    contractId: str(values, 'contractId') || null,
    activePoleIds: strArray(values, 'activePoleIds'),
    passivePoleIds: strArray(values, 'passivePoleIds'),
    opposingParties: existing?.opposingParties ?? [],
    filedAt: str(values, 'filedAt') ? new Date(str(values, 'filedAt')) : null,
    causeValue: num(values, 'causeValue'),
    notes: str(values, 'notes') || null,
    tagIds: existing?.tagIds ?? [],
    customValues: formValuesToStoredValues(customFields, values),
  };
};

export interface ViewCaseViewModel {
  isNew: boolean;
  screenActions: ScreenActions;
  case_: Case | null;
  isAdmin: boolean;
  fields: FieldDefinition[];
  customFields: FieldDefinition[];
  resolveOptionsScreenKey: (field: FieldDefinition) => string;
  values: Values;
  setFieldValue: (fieldKey: string, value: CustomFieldValue) => void;
  mergeValues: (patch: Record<string, unknown>) => void;
  fieldErrors: Record<string, string>;
  lookupOptions: Record<string, LookupOptionSet>;
  handleAddLookupOption: (collection: string, label: string) => Promise<void>;
  handleDeleteLookupOption: (collection: string, optionKey: string) => Promise<void>;
  isSaving: boolean;
  handleSave: () => Promise<void>;

  tagAdapter: TagStoreAdapter;
  isTagManagerOpen: boolean;
  openTagManager: () => void;
  closeTagManager: () => void;

  notesController: EntityNotesController;
  docsController: EntityDocumentsController;
  childTabs: EntityDetailExtraTab[];

  activeTab: EntityDetailTab;
  setActiveTab: (tab: EntityDetailTab) => void;
  copyLinkDone: boolean;
  handleCopyDeepLink: () => void;
  handleClone: () => void;
  handleDeleteCase: () => void;
  caseToDelete: Case | null;
  confirmDeleteCase: () => Promise<void>;
  cancelDeleteCase: () => void;
}

export const useViewCaseViewModel = (tabKey: string): ViewCaseViewModel => {
  const { cases, createCase, updateCase, deleteCase } = useCaseStore();
  const { tags, getTagsForCase, setTagsForCase, createTag, updateTag, deleteTag } = useCaseTagStore();
  const {
    areaConfigs, phaseConfigs, statusConfigs, instanceConfigs,
    actionTypeConfigs, courtConfigs, districtConfigs, judgeConfigs,
    addItem, removeItem,
  } = useCaseLookup();
  const { user, effectiveName } = useAuth();
  const { tenantRole } = useTenant();
  const { caseNoteRepository, caseDocumentRepository } = useDI();
  const theme = useTheme();

  const isAdmin = tenantRole === 'admin';
  const userId = user?.id ?? '';
  const { fields: formFields, customFields, resolveOptionsScreenKey } = useEntityFormFields('cases');

  const findInStore = useCallback((id: string) => cases.find((c) => c.id === id) ?? null, [cases]);

  const recordToValues = useCallback(
    (c: Case | null, opts: { clone: boolean }) => caseToValues(c, customFields, opts.clone),
    [customFields],
  );

  const resolveTitleFromValues = useCallback(
    (values: Values) => str(values, 'caseNumber') || str(values, 'title') || 'Processo',
    [],
  );

  const validate = useCallback((values: Values): EntityValidationResult | null => {
    const fieldErrors = collectRequiredErrors(formFields, values);
    const issues = validateRecordRules('cases', valuesToCasePayload(values, customFields, null));
    issues.forEach((issue) => {
      const key = ruleIssueFieldKey(issue.path);
      if (!fieldErrors[key]) fieldErrors[key] = issue.error;
    });
    if (Object.keys(fieldErrors).length === 0) return null;
    const message = validateRequiredFields(formFields, values) ?? describeRuleIssues(issues);
    return { message, fieldErrors };
  }, [formFields, customFields]);

  const create = useCallback(async (values: Values) => {
    const created = await createCase({
      ...valuesToCasePayload(values, customFields, null),
      createdBy: userId,
    });
    return { id: created.id, title: created.caseNumber ?? created.title };
  }, [createCase, customFields, userId]);

  const update = useCallback(async (id: string, values: Values) => {
    const existing = cases.find((c) => c.id === id) ?? null;
    await updateCase(id, {
      ...valuesToCasePayload(values, customFields, existing),
      updatedBy: userId,
      updatedByName: effectiveName,
      updatedByPhotoURL: user?.photoURL ?? '',
    });
  }, [updateCase, cases, customFields, userId, effectiveName, user]);

  const notesPort = useNotesPort(caseNoteRepository);
  const documentsPort = useDocumentsPort(caseDocumentRepository);

  const detail = useEntityDetail<Case>({
    tabKey,
    entityKey: 'cases',
    parse: parseCaseTab,
    findInStore,
    recordToValues,
    resolveTabTitle: (c) => c?.caseNumber ?? c?.title ?? null,
    resolveTitleFromValues,
    validate,
    create,
    update,
    messages: {
      created: 'Processo cadastrado com sucesso!',
      updated: 'Processo atualizado com sucesso!',
      error: 'Erro ao salvar processo.',
    },
    deepLinkKey: (id) => `view-case:${id}`,
    cloneKey: (id) => `${CLONE_PREFIX}${id}`,
    remove: (id) => deleteCase(id),
    removedMessage: 'Processo excluído.',
    removeErrorMessage: 'Erro ao excluir processo.',
    notesPort,
    documentsPort,
    hasNotes: true,
    hasDocuments: true,
  });

  const case_ = detail.record;

  const lookupOptions = useMemo<Record<string, LookupOptionSet>>(() => {
    const plain = (configs: typeof areaConfigs) => ({
      staticOptions: configs.filter((c) => c.isStatic !== false).map((c) => ({ value: c.key, label: c.label })),
      dynamicOptions: configs.filter((c) => c.isStatic === false).map((c) => ({ value: c.key, label: c.label })),
    });
    const colored = (configs: typeof statusConfigs) => ({
      staticOptions: configs.filter((c) => c.isStatic !== false).map((c) => ({ value: c.key, label: c.label, color: resolveColor(c.color, theme) })),
      dynamicOptions: configs.filter((c) => c.isStatic === false).map((c) => ({ value: c.key, label: c.label, color: resolveColor(c.color, theme) })),
    });
    return {
      caseAreas: plain(areaConfigs),
      casePhases: plain(phaseConfigs),
      caseStatuses: colored(statusConfigs),
      caseInstances: plain(instanceConfigs),
      caseActionTypes: plain(actionTypeConfigs),
      caseCourts: plain(courtConfigs),
      caseDistricts: plain(districtConfigs),
      caseJudges: plain(judgeConfigs),
    };
  }, [areaConfigs, phaseConfigs, statusConfigs, instanceConfigs, actionTypeConfigs, courtConfigs, districtConfigs, judgeConfigs, theme]);

  const handleAddLookupOption = useCallback(async (collection: string, label: string): Promise<void> => {
    const kind = LOOKUP_COLLECTION_TO_KIND[collection];
    if (kind) await addItem(kind, label);
  }, [addItem]);

  const handleDeleteLookupOption = useCallback(async (collection: string, optionKey: string): Promise<void> => {
    const kind = LOOKUP_COLLECTION_TO_KIND[collection];
    if (kind) await removeItem(kind, optionKey);
  }, [removeItem]);

  const tagAdapter: TagStoreAdapter = useMemo(() => ({
    tags,
    getAppliedTags: (entityId: string) => getTagsForCase(entityId, case_?.tagIds ?? []),
    setTags: (entityId: string, tagIds: string[]) => setTagsForCase(entityId, tagIds),
    createTag: (name: string, color: string) => createTag(name, color),
    updateTag: (id: string, data: { name: string; color: string }) => updateTag(id, data),
    deleteTag: (id: string) => deleteTag(id),
  }), [tags, case_, getTagsForCase, setTagsForCase, createTag, updateTag, deleteTag]);

  return {
    isNew: detail.isNew,
    screenActions: detail.screenActions,
    case_,
    isAdmin,
    fields: formFields,
    customFields,
    resolveOptionsScreenKey,
    values: detail.values,
    setFieldValue: detail.setFieldValue,
    mergeValues: detail.mergeValues,
    fieldErrors: detail.fieldErrors,
    lookupOptions,
    handleAddLookupOption,
    handleDeleteLookupOption,
    isSaving: detail.isSaving,
    handleSave: detail.handleSave,
    tagAdapter,
    isTagManagerOpen: detail.isTagManagerOpen,
    openTagManager: detail.openTagManager,
    closeTagManager: detail.closeTagManager,
    notesController: detail.notesController,
    docsController: detail.docsController,
    childTabs: detail.childTabs,
    activeTab: detail.activeTab,
    setActiveTab: detail.setActiveTab,
    copyLinkDone: detail.copyLinkDone,
    handleCopyDeepLink: detail.handleCopyDeepLink,
    handleClone: detail.handleClone,
    handleDeleteCase: detail.requestDelete,
    caseToDelete: detail.isDeleteOpen ? case_ : null,
    confirmDeleteCase: detail.confirmDelete,
    cancelDeleteCase: detail.cancelDelete,
  };
};
