import { useCallback } from 'react';
import { useCaseStore } from '../../../stores/useCaseStore';
import { useAuth } from '../../../stores/useAuth';
import { useTenant } from '../../../stores/useTenant';
import { useEntityFormFields } from '../../shared/useEntityFormFields';
import { useDI } from '../../../infrastructure/di/useDI';
import { toDateInputValue } from '../../../utils/formatters';
import type {
  Case, CaseArea, CaseInstance, CasePhase, CaseStatus,
  CustomFieldValue, FieldDefinition,
} from '../../../domain/entities';
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
import { validateRecordRules } from '../../../data/utils/recordRulesGate';
import { useTagAdapter } from '../../shared/entityScreen/useTagAdapter';

export type ViewCaseTab = 'data' | 'notes' | 'documents';

type Values = Record<string, CustomFieldValue>;

const CLONE_PREFIX = 'new-case:clone:';

const NEW_CASE_DEFAULTS = {
  area: 'Cível',
  instance: '1º Grau',
  phase: 'Fase Inicial',
  status: 'Em Andamento',
};

const parseCaseTab = (tabKey: string) => {
  const cloneSourceId = tabKey.startsWith(CLONE_PREFIX) ? tabKey.slice(CLONE_PREFIX.length) : null;
  const isNew = tabKey === 'new-case' || cloneSourceId !== null;
  return { isNew, recordId: isNew ? null : tabKey.replace('view-case:', ''), cloneSourceId };
};

const caseToValues = (
  c: Case | null,
  addedFields: FieldDefinition[],
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
  ...buildInitialFormValues(addedFields, c ?? null),
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
  addedFields: FieldDefinition[],
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
    ...formValuesToStoredValues(addedFields, values),
  };
};

export interface ViewCaseViewModel {
  isNew: boolean;
  screenActions: ScreenActions;
  case_: Case | null;
  isAdmin: boolean;
  fields: FieldDefinition[];
  addedFields: FieldDefinition[];
  values: Values;
  setFieldValue: (fieldKey: string, value: CustomFieldValue) => void;
  mergeValues: (patch: Record<string, unknown>) => void;
  fieldErrors: Record<string, string>;
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
  const { user, effectiveName } = useAuth();
  const { tenantRole } = useTenant();
  const { caseNoteRepository, caseDocumentRepository } = useDI();

  const isAdmin = tenantRole === 'admin';
  const userId = user?.id ?? '';
  const { fields: formFields, addedFields } = useEntityFormFields('cases');

  const findInStore = useCallback((id: string) => cases.find((c) => c.id === id) ?? null, [cases]);

  const recordToValues = useCallback(
    (c: Case | null, opts: { clone: boolean }) => caseToValues(c, addedFields, opts.clone),
    [addedFields],
  );

  const resolveTitleFromValues = useCallback(
    (values: Values) => str(values, 'caseNumber') || str(values, 'title') || 'Processo',
    [],
  );

  const validate = useCallback((values: Values): EntityValidationResult | null => {
    const fieldErrors = collectRequiredErrors(formFields, values);
    const issues = validateRecordRules('cases', valuesToCasePayload(values, addedFields, null));
    issues.forEach((issue) => {
      const key = issue.path;
      if (!fieldErrors[key]) fieldErrors[key] = issue.error;
    });
    if (Object.keys(fieldErrors).length === 0) return null;
    const message = validateRequiredFields(formFields, values) ?? describeRuleIssues(issues);
    return { message, fieldErrors };
  }, [formFields, addedFields]);

  const create = useCallback(async (values: Values) => {
    const created = await createCase({
      ...valuesToCasePayload(values, addedFields, null),
      createdBy: userId,
    });
    return { id: created.id, title: created.caseNumber ?? created.title };
  }, [createCase, addedFields, userId]);

  const update = useCallback(async (id: string, values: Values) => {
    const existing = cases.find((c) => c.id === id) ?? null;
    await updateCase(id, {
      ...valuesToCasePayload(values, addedFields, existing),
      updatedBy: userId,
      updatedByName: effectiveName,
      updatedByPhotoURL: user?.photoURL ?? '',
    });
  }, [updateCase, cases, addedFields, userId, effectiveName, user]);

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

  const tagIdsOf = useCallback(() => case_?.tagIds ?? [], [case_]);
  const setRecordTags = useCallback((entityId: string, tagIds: string[]) => updateCase(entityId, { tagIds }), [updateCase]);
  const tagAdapter = useTagAdapter('cases', tagIdsOf, setRecordTags);

  return {
    isNew: detail.isNew,
    screenActions: detail.screenActions,
    case_,
    isAdmin,
    fields: formFields,
    addedFields,
    values: detail.values,
    setFieldValue: detail.setFieldValue,
    mergeValues: detail.mergeValues,
    fieldErrors: detail.fieldErrors,
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
