import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from 'styled-components';
import { useContractStore } from '../../../stores/useContractStore';
import { useContractTagStore } from '../../../stores/useContractTagStore';
import { useContractLookup } from '../../../stores/useContractLookup';
import { useCaseStore } from '../../../stores/useCaseStore';
import { useCaseLookup } from '../../../stores/useCaseLookup';
import { useAuth } from '../../../stores/useAuth';
import { useTenant } from '../../../stores/useTenant';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useNotification } from '../../../stores/useNotification';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { useDI } from '../../../infrastructure/di/useDI';
import { resolveColor, getConfigColor } from '../../../shared/styles/colorUtils';
import { toDateInputValue } from '../../../utils/formatters';
import type {
  Case, Contract, ContractLookupKind, CustomFieldValue, FieldDefinition,
} from '../../../domain/entities';
import type { LookupOptionSet } from '../../components/ui/CustomFieldsSection/CustomFieldsSection.viewmodel';
import type { TagStoreAdapter } from '../../components/ui/TagManager/TagManager.viewmodel';
import type { EntityDetailExtraTab, EntityDetailTab } from '../../components/layout/EntityDetailView';
import type { SearchSelectOption } from '../../components/ui/SearchSelect';
import { useEntityDetail, type EntityValidationResult } from '../../shared/entityScreen/useEntityDetail';
import { useNotesPort } from '../../shared/entityScreen/useNotesPort';
import { useDocumentsPort } from '../../shared/entityScreen/useDocumentsPort';
import type { EntityNotesController, EntityDocumentsController } from '../../shared/entityScreen/types';
import { CONTRACT_FORM_FIELDS } from './contractSchema';
import {
  buildInitialFormValues,
  collectRequiredErrors,
  formValuesToStoredValues,
  validateRequiredFields,
} from '../../../domain/services/customFieldValues';
import { describeRuleIssues } from '../../../domain/schema/fieldRules';
import { validateRecordRules, ruleIssueFieldKey } from '../../../data/utils/recordRulesGate';

export type ViewContractTab = 'data' | 'notes' | 'documents' | 'cases';

/** Chave da aba própria do Contrato (processos vinculados). */
export const CONTRACT_CASES_TAB = 'cases';

type Values = Record<string, CustomFieldValue>;

const CLONE_PREFIX = 'new-contract:clone:';
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const generateContractNumber = (existing: Set<string>): string => {
  let candidate: string;
  do {
    const l1 = LETTERS[Math.floor(Math.random() * LETTERS.length)];
    const l2 = LETTERS[Math.floor(Math.random() * LETTERS.length)];
    const digits = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    candidate = `${l1}${l2}${digits}`;
  } while (existing.has(candidate));
  return candidate;
};

const LOOKUP_COLLECTION_TO_KIND: Record<string, ContractLookupKind> = {
  contractTypes: 'types',
  contractCategories: 'categories',
  contractStatuses: 'statuses',
  contractObjects: 'objects',
  contractAdjustmentIndexes: 'adjustmentIndexes',
  contractAdjustmentPeriodicities: 'adjustmentPeriodicities',
  contractCurrencies: 'currencies',
  contractPaymentMethods: 'paymentMethods',
  contractBanks: 'banks',
  contractCostCenters: 'costCenters',
};

const parseContractTab = (tabKey: string) => {
  const cloneSourceId = tabKey.startsWith(CLONE_PREFIX) ? tabKey.slice(CLONE_PREFIX.length) : null;
  const isNew = tabKey === 'new-contract' || cloneSourceId !== null;
  return { isNew, recordId: isNew ? null : tabKey.replace('view-contract:', ''), cloneSourceId };
};

const contractToValues = (c: Contract | null, customFields: FieldDefinition[], clone: boolean): Values => ({
  number: clone ? '' : (c?.number ?? ''),
  title: c?.title ?? '',
  type: c?.type ?? '',
  category: c?.category ?? '',
  status: c?.status ?? '',
  object: c?.object ?? '',
  contractorIds: c?.contractorIds ?? [],
  contracteeIds: c?.contracteeIds ?? [],
  witnessIds: c?.witnessIds ?? [],
  contractorLawyerIds: c?.contractorLawyerIds ?? [],
  contracteeLawyerIds: c?.contracteeLawyerIds ?? [],
  clientId: c?.clientId ?? '',
  responsibleId: c?.responsibleId ?? '',
  draftedAt: toDateInputValue(c?.draftedAt),
  signedAt: toDateInputValue(c?.signedAt),
  effectiveStart: toDateInputValue(c?.effectiveStart),
  effectiveEnd: toDateInputValue(c?.effectiveEnd),
  autoRenewal: c?.autoRenewal ?? false,
  renewalDate: toDateInputValue(c?.renewalDate),
  terminationDate: toDateInputValue(c?.terminationDate),
  initialValue: c?.initialValue ?? null,
  monthlyValue: c?.monthlyValue ?? null,
  totalValue: c?.totalValue ?? null,
  adjustmentIndex: c?.adjustmentIndex ?? '',
  adjustmentPeriodicity: c?.adjustmentPeriodicity ?? '',
  currency: c?.currency ?? '',
  paymentMethod: c?.paymentMethod ?? '',
  dueDay: c?.dueDay != null ? String(c.dueDay) : '',
  installments: c?.installments != null ? String(c.installments) : '',
  bank: c?.bank ?? '',
  bankAccount: c?.bankAccount ?? '',
  pixKey: c?.pixKey ?? '',
  costCenter: c?.costCenter ?? '',
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

const dateOrNull = (values: Values, key: string): Date | null =>
  str(values, key) ? new Date(str(values, key)) : null;

const intOrNull = (values: Values, key: string): number | null =>
  str(values, key) ? Number(str(values, key)) : null;

const valuesToContractPayload = (values: Values, customFields: FieldDefinition[]) => ({
  number: str(values, 'number').trim(),
  title: str(values, 'title').trim(),
  type: str(values, 'type'),
  category: str(values, 'category'),
  status: str(values, 'status'),
  object: str(values, 'object') || null,
  contractorIds: strArray(values, 'contractorIds'),
  contracteeIds: strArray(values, 'contracteeIds'),
  witnessIds: strArray(values, 'witnessIds'),
  contractorLawyerIds: strArray(values, 'contractorLawyerIds'),
  contracteeLawyerIds: strArray(values, 'contracteeLawyerIds'),
  clientId: str(values, 'clientId') || null,
  responsibleId: str(values, 'responsibleId') || null,
  draftedAt: dateOrNull(values, 'draftedAt'),
  signedAt: dateOrNull(values, 'signedAt'),
  effectiveStart: dateOrNull(values, 'effectiveStart'),
  effectiveEnd: dateOrNull(values, 'effectiveEnd'),
  autoRenewal: (values as Record<string, unknown>).autoRenewal === true,
  renewalDate: dateOrNull(values, 'renewalDate'),
  terminationDate: dateOrNull(values, 'terminationDate'),
  initialValue: num(values, 'initialValue'),
  monthlyValue: num(values, 'monthlyValue'),
  totalValue: num(values, 'totalValue'),
  adjustmentIndex: str(values, 'adjustmentIndex') || null,
  adjustmentPeriodicity: str(values, 'adjustmentPeriodicity') || null,
  currency: str(values, 'currency') || null,
  paymentMethod: str(values, 'paymentMethod') || null,
  dueDay: intOrNull(values, 'dueDay'),
  installments: intOrNull(values, 'installments'),
  bank: str(values, 'bank') || null,
  bankAccount: str(values, 'bankAccount') || null,
  pixKey: str(values, 'pixKey') || null,
  costCenter: str(values, 'costCenter') || null,
  customValues: formValuesToStoredValues(customFields, values),
});

export interface ViewContractViewModel {
  isNew: boolean;
  contract: Contract | null;
  isAdmin: boolean;
  fields: FieldDefinition[];
  customFields: FieldDefinition[];
  values: Values;
  setFieldValue: (fieldKey: string, value: CustomFieldValue) => void;
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
  handleDeleteContract: () => void;
  contractToDelete: Contract | null;
  confirmDeleteContract: () => Promise<void>;
  cancelDeleteContract: () => void;

  // Aba própria do Contrato: processos vinculados.
  linkedCases: Case[];
  unlinkedCaseOptions: SearchSelectOption[];
  caseToAdd: string;
  setCaseToAdd: (v: string) => void;
  handleLinkCase: (caseId: string) => Promise<void>;
  handleUnlinkCase: (c: Case) => Promise<void>;
  handleOpenCase: (c: Case) => void;
  getCaseStatusColor: (status: string) => string;
}

export const useViewContractViewModel = (tabKey: string): ViewContractViewModel => {
  const { contracts, createContract, updateContract, deleteContract } = useContractStore();
  const { tags, getTagsForContract, setTagsForContract, createTag, updateTag, deleteTag } = useContractTagStore();
  const {
    typeConfigs, categoryConfigs, statusConfigs, objectConfigs,
    adjustmentIndexConfigs, adjustmentPeriodicityConfigs, currencyConfigs, paymentMethodConfigs,
    bankConfigs, costCenterConfigs, addItem, removeItem,
  } = useContractLookup();
  const { cases, updateCase } = useCaseStore();
  const { statusConfigs: caseStatusConfigs } = useCaseLookup();
  const { user, effectiveName } = useAuth();
  const { tenantRole } = useTenant();
  const { openTab } = useWorkspace();
  const { notify } = useNotification();
  const { getCustomFieldsFor } = useScreenDefinitions();
  const { contractNoteRepository, contractDocumentRepository } = useDI();
  const theme = useTheme();

  const isAdmin = tenantRole === 'admin';
  const userId = user?.id ?? '';
  const customFields = useMemo(() => getCustomFieldsFor('contracts'), [getCustomFieldsFor]);
  const allFields = useMemo(() => [...CONTRACT_FORM_FIELDS, ...customFields], [customFields]);

  const [caseToAdd, setCaseToAdd] = useState('');

  const findInStore = useCallback((id: string) => contracts.find((c) => c.id === id) ?? null, [contracts]);

  const recordToValues = useCallback(
    (c: Contract | null, opts: { clone: boolean }) => contractToValues(c, customFields, opts.clone),
    [customFields],
  );

  const resolveTitleFromValues = useCallback(
    (values: Values) => str(values, 'number') || str(values, 'title') || 'Contrato',
    [],
  );

  const validate = useCallback((values: Values): EntityValidationResult | null => {
    const fieldErrors = collectRequiredErrors(allFields, values);
    const issues = validateRecordRules('contracts', valuesToContractPayload(values, customFields));
    issues.forEach((issue) => {
      const key = ruleIssueFieldKey(issue.path);
      if (!fieldErrors[key]) fieldErrors[key] = issue.error;
    });
    if (Object.keys(fieldErrors).length === 0) return null;
    const message = validateRequiredFields(allFields, values) ?? describeRuleIssues(issues);
    return { message, fieldErrors };
  }, [allFields, customFields]);

  const create = useCallback(async (values: Values) => {
    const created = await createContract({
      ...valuesToContractPayload(values, customFields),
      createdBy: userId,
      tagIds: [],
    });
    return { id: created.id, title: created.number || created.title };
  }, [createContract, customFields, userId]);

  const update = useCallback(async (id: string, values: Values) => {
    await updateContract(id, {
      ...valuesToContractPayload(values, customFields),
      updatedBy: userId,
      updatedByName: effectiveName,
      updatedByPhotoURL: user?.photoURL ?? '',
    });
  }, [updateContract, customFields, userId, effectiveName, user]);

  const notesPort = useNotesPort(contractNoteRepository);
  const documentsPort = useDocumentsPort(contractDocumentRepository);

  const detail = useEntityDetail<Contract>({
    tabKey,
    entityKey: 'contracts',
    parse: parseContractTab,
    findInStore,
    recordToValues,
    resolveTabTitle: (c) => c?.number ?? c?.title ?? null,
    resolveTitleFromValues,
    validate,
    create,
    update,
    messages: {
      created: 'Contrato cadastrado com sucesso!',
      updated: 'Contrato atualizado com sucesso!',
      error: 'Erro ao salvar contrato.',
    },
    deepLinkKey: (id) => `view-contract:${id}`,
    cloneKey: (id) => `${CLONE_PREFIX}${id}`,
    remove: (id) => deleteContract(id),
    removedMessage: 'Contrato excluído.',
    removeErrorMessage: 'Erro ao excluir contrato.',
    notesPort,
    documentsPort,
    hasNotes: true,
    hasDocuments: true,
  });

  const contract = detail.record;
  const { setFieldValue } = detail;

  // Sugere um número livre ao criar/clonar. Fica em efeito porque sorteia (impuro no render).
  const needsNumber = detail.isNew && !str(detail.values, 'number');
  useEffect(() => {
    if (!needsNumber) return;
    setFieldValue('number', generateContractNumber(new Set(contracts.map((c) => c.number))));
  }, [needsNumber, contracts, setFieldValue]);

  const lookupOptions = useMemo<Record<string, LookupOptionSet>>(() => {
    const plain = (configs: typeof typeConfigs) => ({
      staticOptions: configs.filter((c) => c.isStatic !== false).map((c) => ({ value: c.key, label: c.label })),
      dynamicOptions: configs.filter((c) => c.isStatic === false).map((c) => ({ value: c.key, label: c.label })),
    });
    return {
      contractTypes: plain(typeConfigs),
      contractCategories: plain(categoryConfigs),
      contractStatuses: {
        staticOptions: statusConfigs.filter((c) => c.isStatic !== false).map((c) => ({ value: c.key, label: c.label, color: resolveColor(c.color, theme) })),
        dynamicOptions: statusConfigs.filter((c) => c.isStatic === false).map((c) => ({ value: c.key, label: c.label, color: resolveColor(c.color, theme) })),
      },
      contractObjects: plain(objectConfigs),
      contractAdjustmentIndexes: plain(adjustmentIndexConfigs),
      contractAdjustmentPeriodicities: plain(adjustmentPeriodicityConfigs),
      contractCurrencies: plain(currencyConfigs),
      contractPaymentMethods: plain(paymentMethodConfigs),
      contractBanks: plain(bankConfigs),
      contractCostCenters: plain(costCenterConfigs),
    };
  }, [typeConfigs, categoryConfigs, statusConfigs, objectConfigs, adjustmentIndexConfigs,
      adjustmentPeriodicityConfigs, currencyConfigs, paymentMethodConfigs, bankConfigs, costCenterConfigs, theme]);

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
    getAppliedTags: (entityId: string) => getTagsForContract(entityId, contract?.tagIds ?? []),
    setTags: (entityId: string, tagIds: string[]) => setTagsForContract(entityId, tagIds),
    createTag: (name: string, color: string) => createTag(name, color),
    updateTag: (id: string, data: { name: string; color: string }) => updateTag(id, data),
    deleteTag: (id: string) => deleteTag(id),
  }), [tags, contract, getTagsForContract, setTagsForContract, createTag, updateTag, deleteTag]);

  const linkedCases = useMemo(
    () => (contract ? cases.filter((c) => c.contractId === contract.id) : []),
    [cases, contract],
  );

  const unlinkedCaseOptions = useMemo<SearchSelectOption[]>(
    () => cases.filter((c) => !c.contractId).map((c) => ({ value: c.id, label: `${c.caseNumber} — ${c.title}` })),
    [cases],
  );

  const handleLinkCase = useCallback(async (caseId: string) => {
    if (!contract) return;
    try {
      await updateCase(caseId, { contractId: contract.id });
      notify('Processo vinculado ao contrato.', 'success');
    } catch {
      notify('Erro ao vincular processo.', 'error');
    } finally {
      setCaseToAdd('');
    }
  }, [contract, updateCase, notify]);

  const handleUnlinkCase = useCallback(async (c: Case) => {
    try {
      await updateCase(c.id, { contractId: null });
      notify('Processo desvinculado do contrato.', 'success');
    } catch {
      notify('Erro ao desvincular processo.', 'error');
    }
  }, [updateCase, notify]);

  const handleOpenCase = useCallback((c: Case) => openTab(`view-case:${c.id}`), [openTab]);

  const getCaseStatusColor = useCallback(
    (status: string): string => getConfigColor(caseStatusConfigs, status, theme),
    [caseStatusConfigs, theme],
  );

  return {
    isNew: detail.isNew,
    contract,
    isAdmin,
    fields: CONTRACT_FORM_FIELDS,
    customFields,
    values: detail.values,
    setFieldValue,
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
    handleDeleteContract: detail.requestDelete,
    contractToDelete: detail.isDeleteOpen ? contract : null,
    confirmDeleteContract: detail.confirmDelete,
    cancelDeleteContract: detail.cancelDelete,
    linkedCases,
    unlinkedCaseOptions,
    caseToAdd,
    setCaseToAdd,
    handleLinkCase,
    handleUnlinkCase,
    handleOpenCase,
    getCaseStatusColor,
  };
};
