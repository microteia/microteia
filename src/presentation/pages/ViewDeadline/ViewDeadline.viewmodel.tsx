import { useCallback, useMemo } from 'react';
import { useTheme } from 'styled-components';
import { useDeadlineStore } from '../../../stores/useDeadlineStore';
import { useDeadlineLookup } from '../../../stores/useDeadlineLookup';
import { useCaseStore } from '../../../stores/useCaseStore';
import { useAuth } from '../../../stores/useAuth';
import { useTenant } from '../../../stores/useTenant';
import { useEntityFormFields } from '../../shared/useEntityFormFields';
import type { CustomFieldValue, Deadline, DeadlinePriority, DeadlineStatus, FieldDefinition } from '../../../domain/entities';
import type { LookupOptionSet } from '../../components/ui/CustomFieldsSection/CustomFieldsSection.viewmodel';
import type { EntityDetailExtraTab, EntityDetailTab } from '../../components/layout/EntityDetailView';
import { useEntityDetail, type EntityValidationResult } from '../../shared/entityScreen/useEntityDetail';
import type { ScreenActions } from '../../shared/entityScreen/useScreenActions';
import type {
  NotesPort,
  DocumentsPort,
  EntityNotesController,
  EntityDocumentsController,
} from '../../shared/entityScreen/types';
import {
  buildInitialFormValues,
  collectRequiredErrors,
  formValuesToStoredValues,
  validateRequiredFields,
} from '../../../domain/services/customFieldValues';
import { describeRuleIssues } from '../../../domain/schema/fieldRules';
import { validateRecordRules } from '../../../data/utils/recordRulesGate';
import { toDateInputValue } from '../../../utils/formatters';

type Values = Record<string, CustomFieldValue>;

const NEW_DEADLINE_DEFAULTS = { type: 'Outro', priority: 'Média' };

const parseDeadlineTab = (tabKey: string) => {
  const isNew = tabKey === 'new-deadline';
  return { isNew, recordId: isNew ? null : tabKey.replace('view-deadline:', ''), cloneSourceId: null };
};

const deadlineToValues = (
  deadline: Deadline | null,
  addedFields: FieldDefinition[],
): Values => ({
  type: deadline ? deadline.type ?? '' : NEW_DEADLINE_DEFAULTS.type,
  priority: deadline ? deadline.priority ?? '' : NEW_DEADLINE_DEFAULTS.priority,
  caseId: deadline?.caseId ?? '',
  dueDate: deadline?.dueDate ? toDateInputValue(deadline.dueDate) : '',
  completedAt: deadline?.completedAt ? toDateInputValue(deadline.completedAt) : '',
  responsibleLawyerId: deadline?.responsibleLawyerId ?? '',
  description: deadline?.description ?? '',
  ...buildInitialFormValues(addedFields, deadline ?? null),
});

const str = (values: Values, key: string): string => {
  const v = (values as Record<string, unknown>)[key];
  return typeof v === 'string' ? v : '';
};

const deriveStatus = (values: Values): DeadlineStatus => {
  if (str(values, 'completedAt')) return 'Concluído';
  if (str(values, 'dueDate') && new Date(`${str(values, 'dueDate')}T23:59:00`) < new Date()) return 'Vencido';
  return 'Pendente';
};

const valuesToDeadlinePayload = (values: Values, addedFields: FieldDefinition[], userId: string) => {
  const dueDate = new Date(`${str(values, 'dueDate')}T23:59:00`);
  const completedAt = str(values, 'completedAt') ? new Date(`${str(values, 'completedAt')}T12:00:00`) : null;
  const status: DeadlineStatus = completedAt ? 'Concluído' : (dueDate < new Date() ? 'Vencido' : 'Pendente');

  return {
    type: str(values, 'type'),
    caseId: str(values, 'caseId'),
    dueDate,
    priority: str(values, 'priority') as DeadlinePriority,
    status,
    responsibleLawyerId: str(values, 'responsibleLawyerId') || null,
    description: str(values, 'description') || null,
    completedAt,
    completedBy: completedAt ? (userId || null) : null,
    notes: null,
    ...formValuesToStoredValues(addedFields, values),
  };
};

const NO_NOTES_PORT: NotesPort = {
  get: () => Promise.resolve([]),
  add: () => Promise.reject(new Error('sem anotações')),
  remove: () => Promise.resolve(),
};

const NO_DOCS_PORT: DocumentsPort = {
  get: () => Promise.resolve([]),
  upload: () => Promise.reject(new Error('sem documentos')),
  add: () => Promise.reject(new Error('sem documentos')),
  remove: () => Promise.resolve(),
};

export interface ViewDeadlineViewModel {
  isNew: boolean;
  screenActions: ScreenActions;
  deadline: Deadline | null;
  isAdmin: boolean;
  fields: FieldDefinition[];
  addedFields: FieldDefinition[];
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
  derivedStatus: DeadlineStatus;
  caseDisplay: string;
  priorityColor: string;
  getDeadlineStatusColor: (status: DeadlineStatus) => string;
  notesController: EntityNotesController;
  docsController: EntityDocumentsController;
  childTabs: EntityDetailExtraTab[];
  activeTab: EntityDetailTab;
  setActiveTab: (tab: EntityDetailTab) => void;
}

export const useViewDeadlineViewModel = (tabKey: string): ViewDeadlineViewModel => {
  const { deadlines, createDeadline, updateDeadline } = useDeadlineStore();
  const { typeConfigs, addType, removeType } = useDeadlineLookup();
  const { cases } = useCaseStore();
  const { user, effectiveName } = useAuth();
  const { tenantRole } = useTenant();
  const theme = useTheme();

  const isAdmin = tenantRole === 'admin';
  const userId = user?.id ?? '';
  const { fields: formFields, addedFields, resolveOptionsScreenKey } = useEntityFormFields('deadlines');

  const findInStore = useCallback(
    (id: string) => deadlines.find((d) => d.id === id) ?? null,
    [deadlines],
  );

  const recordToValues = useCallback(
    (deadline: Deadline | null) => deadlineToValues(deadline, addedFields),
    [addedFields],
  );

  const resolveTitleFromValues = useCallback((values: Values) => str(values, 'type') || 'Prazo', []);

  const validate = useCallback((values: Values): EntityValidationResult | null => {
    const fieldErrors = collectRequiredErrors(formFields, values);
    const issues = validateRecordRules('deadlines', valuesToDeadlinePayload(values, addedFields, userId));
    issues.forEach((issue) => {
      const key = issue.path;
      if (!fieldErrors[key]) fieldErrors[key] = issue.error;
    });
    if (Object.keys(fieldErrors).length === 0) return null;
    const message =
      validateRequiredFields(formFields, values) ?? describeRuleIssues(issues);
    return { message, fieldErrors };
  }, [formFields, addedFields, userId]);

  const create = useCallback(async (values: Values) => {
    const created = await createDeadline({
      ...valuesToDeadlinePayload(values, addedFields, userId),
      createdBy: userId,
    });
    return { id: created.id, title: created.type || 'Prazo' };
  }, [createDeadline, addedFields, userId]);

  const update = useCallback(async (id: string, values: Values) => {
    await updateDeadline(id, {
      ...valuesToDeadlinePayload(values, addedFields, userId),
      updatedBy: userId,
      updatedByName: effectiveName,
      updatedByPhotoURL: user?.photoURL ?? '',
    });
  }, [updateDeadline, addedFields, userId, effectiveName, user]);

  const detail = useEntityDetail<Deadline>({
    tabKey,
    entityKey: 'deadlines',
    parse: parseDeadlineTab,
    findInStore,
    recordToValues,
    resolveTabTitle: (deadline, isNew) => (isNew ? null : (deadline?.type || 'Prazo')),
    resolveTitleFromValues,
    validate,
    create,
    update,
    messages: {
      created: 'Prazo cadastrado com sucesso!',
      updated: 'Prazo atualizado com sucesso!',
      error: 'Erro ao salvar prazo.',
    },
    deepLinkKey: (id) => `view-deadline:${id}`,
    cloneKey: (id) => `view-deadline:${id}`,
    afterCreate: 'close',
    notesPort: NO_NOTES_PORT,
    documentsPort: NO_DOCS_PORT,
    hasNotes: false,
    hasDocuments: false,
  });

  const lookupOptions = useMemo<Record<string, LookupOptionSet>>(() => ({
    deadlineTypes: {
      staticOptions: typeConfigs.filter((t) => t.isStatic).map((t) => ({ value: t.key, label: t.label })),
      dynamicOptions: typeConfigs.filter((t) => !t.isStatic).map((t) => ({ value: t.key, label: t.label })),
    },
  }), [typeConfigs]);

  const handleAddLookupOption = useCallback(async (collection: string, label: string): Promise<void> => {
    if (collection === 'deadlineTypes') await addType(label);
  }, [addType]);

  const handleDeleteLookupOption = useCallback(async (collection: string, optionKey: string): Promise<void> => {
    if (collection === 'deadlineTypes') await removeType(optionKey);
  }, [removeType]);

  const derivedStatus = useMemo(() => deriveStatus(detail.values), [detail.values]);

  const caseDisplay = useMemo(() => {
    const caseId = str(detail.values, 'caseId');
    if (!caseId) return '';
    const found = cases.find((c) => c.id === caseId);
    if (!found) return '—';
    return found.caseNumber ? `${found.caseNumber} — ${found.title}` : found.title;
  }, [detail.values, cases]);

  const priorityColor = useMemo(() => {
    const map: Record<DeadlinePriority, string> = {
      'Baixa': theme.colors.success,
      'Média': theme.colors.warning,
      'Alta': theme.colors.secondary,
      'Crítica': theme.colors.danger,
    };
    return map[str(detail.values, 'priority') as DeadlinePriority] ?? theme.colors.textSecondary;
  }, [detail.values, theme]);

  const getDeadlineStatusColor = useCallback((status: DeadlineStatus): string => {
    const map: Record<DeadlineStatus, string> = {
      'Pendente': theme.colors.deadlineStatusPending,
      'Concluído': theme.colors.deadlineStatusCompleted,
      'Vencido': theme.colors.deadlineStatusOverdue,
      'Cancelado': theme.colors.deadlineStatusCanceled,
    };
    return map[status] ?? theme.colors.deadlineStatusPending;
  }, [theme]);

  return {
    isNew: detail.isNew,
    screenActions: detail.screenActions,
    deadline: detail.record,
    isAdmin,
    fields: formFields,
    addedFields,
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
    derivedStatus,
    caseDisplay,
    priorityColor,
    getDeadlineStatusColor,
    notesController: detail.notesController,
    docsController: detail.docsController,
    childTabs: detail.childTabs,
    activeTab: detail.activeTab,
    setActiveTab: detail.setActiveTab,
  };
};
