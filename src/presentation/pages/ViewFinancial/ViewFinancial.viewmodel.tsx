import { useCallback } from 'react';
import { useFinancialStore } from '../../../stores/useFinancialStore';
import { useAuth } from '../../../stores/useAuth';
import { useTenant } from '../../../stores/useTenant';
import { useEntityFormFields } from '../../shared/useEntityFormFields';
import { useDI } from '../../../infrastructure/di/useDI';
import { toDateInputValue as toDateInput } from '../../../utils/formatters';
import type { Financial, FinancialType, PaymentMethod, CustomFieldValue, FieldDefinition } from '../../../domain/entities';
import type { TagStoreAdapter } from '../../components/ui/TagManager/TagManager.viewmodel';
import { useEntityDetail, type EntityValidationResult } from '../../shared/entityScreen/useEntityDetail';
import type { ScreenActions } from '../../shared/entityScreen/useScreenActions';
import { useDocumentsPort } from '../../shared/entityScreen/useDocumentsPort';
import type { NotesPort, EntityNotesController, EntityDocumentsController } from '../../shared/entityScreen/types';
import type { EntityDetailExtraTab, EntityDetailTab } from '../../components/layout/EntityDetailView';
import {
  buildInitialFormValues,
  collectRequiredErrors,
  formValuesToStoredValues,
  validateRequiredFields,
} from '../../../domain/services/customFieldValues';
import { describeRuleIssues } from '../../../domain/schema/fieldRules';
import { validateRecordRules } from '../../../data/utils/recordRulesGate';
import { useTagAdapter } from '../../shared/entityScreen/useTagAdapter';

export type ViewFinancialTab = 'data' | 'documents';

type Values = Record<string, CustomFieldValue>;

const CLONE_PREFIX = 'new-financial:clone:';
const NEW_FINANCIAL_DEFAULTS = { type: 'Receita', status: 'Aberto' };

const parseFinancialTab = (tabKey: string) => {
  const cloneSourceId = tabKey.startsWith(CLONE_PREFIX) ? tabKey.slice(CLONE_PREFIX.length) : null;
  const isNew = tabKey === 'new-financial' || cloneSourceId !== null;
  return { isNew, recordId: isNew ? null : tabKey.replace('view-financial:', ''), cloneSourceId };
};

const financialToValues = (
  financial: Financial | null,
  addedFields: FieldDefinition[],
  clone: boolean,
): Values => ({
  type: financial ? financial.type ?? '' : NEW_FINANCIAL_DEFAULTS.type,
  category: financial?.category ?? '',
  amount: financial?.amount ?? null,
  status: clone ? NEW_FINANCIAL_DEFAULTS.status : (financial ? financial.status ?? '' : NEW_FINANCIAL_DEFAULTS.status),
  dueDate: toDateInput(financial?.dueDate),
  paymentDate: clone ? '' : toDateInput(financial?.paymentDate),
  cancelDate: clone ? '' : toDateInput(financial?.cancelDate),
  paymentMethod: financial?.paymentMethod ?? '',
  costCenter: financial?.costCenter ?? '',
  invoiceNumber: clone ? '' : (financial?.invoiceNumber ?? ''),
  caseId: financial?.caseId ?? '',
  personId: financial?.personId ?? '',
  contractId: financial?.contractId ?? '',
  notes: financial?.notes ?? '',
  ...buildInitialFormValues(addedFields, financial ?? null),
});

const str = (values: Values, key: string): string => {
  const v = (values as Record<string, unknown>)[key];
  return typeof v === 'string' ? v : '';
};

const num = (values: Values, key: string): number | null => {
  const v = (values as Record<string, unknown>)[key];
  return typeof v === 'number' ? v : null;
};

const valuesToFinancialPayload = (values: Values, addedFields: FieldDefinition[]) => ({
  type: str(values, 'type') as FinancialType,
  category: str(values, 'category'),
  costCenter: str(values, 'costCenter') || null,
  amount: num(values, 'amount') ?? 0,
  dueDate: new Date(`${str(values, 'dueDate')}T12:00:00`),
  paymentDate: str(values, 'paymentDate') ? new Date(`${str(values, 'paymentDate')}T12:00:00`) : null,
  cancelDate: str(values, 'cancelDate') ? new Date(`${str(values, 'cancelDate')}T12:00:00`) : null,
  status: str(values, 'status'),
  paymentMethod: (str(values, 'paymentMethod') as PaymentMethod) || null,
  caseId: str(values, 'caseId') || null,
  personId: str(values, 'personId') || null,
  contractId: str(values, 'contractId') || null,
  invoiceNumber: str(values, 'invoiceNumber') || null,
  notes: str(values, 'notes') || null,
  ...formValuesToStoredValues(addedFields, values),
});

const NO_NOTES_PORT: NotesPort = {
  get: () => Promise.resolve([]),
  add: () => Promise.reject(new Error('sem anotações')),
  remove: () => Promise.resolve(),
};

export interface ViewFinancialViewModel {
  isNew: boolean;
  screenActions: ScreenActions;
  financial: Financial | null;
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
  handleDeleteFinancial: () => void;
  financialToDelete: Financial | null;
  confirmDeleteFinancial: () => Promise<void>;
  cancelDeleteFinancial: () => void;
}

export const useViewFinancialViewModel = (tabKey: string): ViewFinancialViewModel => {
  const { financials, createFinancial, updateFinancial, deleteFinancial } = useFinancialStore();
  const { user, effectiveName } = useAuth();
  const { tenantRole } = useTenant();
  const { financialDocumentRepository } = useDI();

  const isAdmin = tenantRole === 'admin';
  const userId = user?.id ?? '';
  const { fields: formFields, addedFields } = useEntityFormFields('financials');

  const findInStore = useCallback(
    (id: string) => financials.find((f) => f.id === id) ?? null,
    [financials],
  );

  const recordToValues = useCallback(
    (financial: Financial | null, opts: { clone: boolean }) =>
      financialToValues(financial, addedFields, opts.clone),
    [addedFields],
  );

  const resolveTitleFromValues = useCallback((values: Values) => str(values, 'category') || 'Lançamento', []);


  const validate = useCallback((values: Values): EntityValidationResult | null => {
    const fieldErrors = collectRequiredErrors(formFields, values);
    const amount = num(values, 'amount');
    if (amount !== null && amount <= 0) fieldErrors.amount = 'Informe um valor maior que zero.';
    const issues = validateRecordRules('financials', valuesToFinancialPayload(values, addedFields));
    issues.forEach((issue) => {
      const key = issue.path;
      if (!fieldErrors[key]) fieldErrors[key] = issue.error;
    });
    if (Object.keys(fieldErrors).length === 0) return null;
    const message =
      validateRequiredFields(formFields, values) ?? fieldErrors.amount ?? describeRuleIssues(issues);
    return { message, fieldErrors };
  }, [formFields, addedFields]);

  const create = useCallback(async (values: Values) => {
    const created = await createFinancial({
      ...valuesToFinancialPayload(values, addedFields),
      createdBy: userId,
      tagIds: [],
    });
    return { id: created.id, title: created.category };
  }, [createFinancial, addedFields, userId]);

  const update = useCallback(async (id: string, values: Values) => {
    await updateFinancial(id, {
      ...valuesToFinancialPayload(values, addedFields),
      updatedBy: userId,
      updatedByName: effectiveName,
      updatedByPhotoURL: user?.photoURL ?? '',
    });
  }, [updateFinancial, addedFields, userId, effectiveName, user]);

  const documentsPort = useDocumentsPort(financialDocumentRepository);

  const detail = useEntityDetail<Financial>({
    tabKey,
    entityKey: 'financials',
    parse: parseFinancialTab,
    findInStore,
    recordToValues,
    resolveTabTitle: (financial) => financial?.category ?? null,
    resolveTitleFromValues,
    validate,
    create,
    update,
    messages: {
      created: 'Lançamento criado com sucesso!',
      updated: 'Lançamento atualizado com sucesso!',
      error: 'Erro ao salvar lançamento.',
    },
    deepLinkKey: (id) => `view-financial:${id}`,
    cloneKey: (id) => `${CLONE_PREFIX}${id}`,
    remove: (id) => deleteFinancial(id),
    removedMessage: 'Lançamento excluído.',
    removeErrorMessage: 'Erro ao excluir lançamento.',
    notesPort: NO_NOTES_PORT,
    documentsPort,
    hasNotes: false,
    hasDocuments: true,
  });

  const financial = detail.record;

  const tagIdsOf = useCallback(() => financial?.tagIds ?? [], [financial]);
  const setRecordTags = useCallback((entityId: string, tagIds: string[]) => updateFinancial(entityId, { tagIds }), [updateFinancial]);
  const tagAdapter = useTagAdapter('financials', tagIdsOf, setRecordTags);

  return {
    isNew: detail.isNew,
    screenActions: detail.screenActions,
    financial,
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
    handleDeleteFinancial: detail.requestDelete,
    financialToDelete: detail.isDeleteOpen ? financial : null,
    confirmDeleteFinancial: detail.confirmDelete,
    cancelDeleteFinancial: detail.cancelDelete,
  };
};
