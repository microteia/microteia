import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTheme } from 'styled-components';
import { useFinancialStore } from '../../../stores/useFinancialStore';
import { useFinancialTagStore } from '../../../stores/useFinancialTagStore';
import { useFinancialLookup } from '../../../stores/useFinancialLookup';
import { useContractLookup } from '../../../stores/useContractLookup';
import { useCaseStore } from '../../../stores/useCaseStore';
import { usePersonStore } from '../../../stores/usePersonStore';
import { useContractStore } from '../../../stores/useContractStore';
import { useDocumentTypeLookup } from '../../../stores/useDocumentTypeLookup';
import { useAuth } from '../../../stores/useAuth';
import { useTenant } from '../../../stores/useTenant';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useNotification } from '../../../stores/useNotification';
import { useDI } from '../../../infrastructure/di/useDI';
import { generateDeepLink } from '../../../infrastructure/deeplink/deepLinkUtils';
import { resolveColor, getConfigColor } from '../../../shared/styles/colorUtils';
import { toDateInputValue as toDateInput } from '../../../utils/formatters';
import type { DynamicSelectOption } from '../../components/ui/DynamicSelect';
import type { SearchSelectOption } from '../../components/ui/SearchSelect';
import { makeGetFinancialDocumentsUseCase } from '../../../domain/usecases/financialdocuments/GetFinancialDocumentsUseCase';
import { makeUploadFinancialDocumentUseCase } from '../../../domain/usecases/financialdocuments/UploadFinancialDocumentUseCase';
import { makeAddFinancialDocumentUseCase } from '../../../domain/usecases/financialdocuments/AddFinancialDocumentUseCase';
import { makeDeleteFinancialDocumentUseCase } from '../../../domain/usecases/financialdocuments/DeleteFinancialDocumentUseCase';
import type { Financial, FinancialType, FinancialDocument, PaymentMethod, DeletionActor } from '../../../domain/entities';
import type { TagStoreAdapter } from '../../components/ui/TagManager/TagManager.viewmodel';

export type ViewFinancialTab = 'data' | 'documents';

export interface FinancialFormData {
  type: FinancialType;
  category: string;
  amount: number | null;
  dueDate: string;
  paymentDate: string;
  cancelDate: string;
  status: string;
  paymentMethod: PaymentMethod | '';
  caseId: string;
  personId: string;
  contractId: string;
  costCenter: string;
  invoiceNumber: string;
  notes: string;
}

const buildFormData = (financial: Financial | null): FinancialFormData => ({
  type: financial?.type ?? 'Receita',
  category: financial?.category ?? '',
  amount: financial?.amount ?? null,
  dueDate: toDateInput(financial?.dueDate),
  paymentDate: toDateInput(financial?.paymentDate),
  cancelDate: toDateInput(financial?.cancelDate),
  status: financial?.status ?? 'Aberto',
  paymentMethod: financial?.paymentMethod ?? '',
  caseId: financial?.caseId ?? '',
  personId: financial?.personId ?? '',
  contractId: financial?.contractId ?? '',
  costCenter: financial?.costCenter ?? '',
  invoiceNumber: financial?.invoiceNumber ?? '',
  notes: financial?.notes ?? '',
});

const PAYMENT_METHOD_OPTIONS: SearchSelectOption[] = (['PIX', 'Transferência', 'Dinheiro', 'Cartão', 'Cheque', 'Outro'] as PaymentMethod[])
  .map((m) => ({ value: m, label: m }));

export interface ViewFinancialViewModel {
  isNew: boolean;
  financial: Financial | null;
  activeTab: ViewFinancialTab;
  setActiveTab: (tab: ViewFinancialTab) => void;
  formData: FinancialFormData;
  setFormData: (data: Partial<FinancialFormData>) => void;
  isSaving: boolean;
  handleSave: () => Promise<void>;

  documents: FinancialDocument[];
  docsLoading: boolean;
  isUploadingDoc: boolean;
  pendingFile: File | null;
  pendingType: string;
  setPendingType: (v: string) => void;
  documentTypeOptions: DynamicSelectOption[];
  documentTypeDynamicOptions: DynamicSelectOption[];
  handleAddDocumentType: (name: string) => Promise<void>;
  handleDeleteDocumentType: (key: string) => Promise<void>;
  handleSelectFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleConfirmUpload: () => Promise<void>;
  handleCancelPendingUpload: () => void;
  docToDelete: FinancialDocument | null;
  requestDeleteDoc: (doc: FinancialDocument) => void;
  confirmDeleteDoc: () => Promise<void>;
  cancelDeleteDoc: () => void;

  tagAdapter: TagStoreAdapter;
  isTagManagerOpen: boolean;
  openTagManager: () => void;
  closeTagManager: () => void;

  caseOptions: SearchSelectOption[];
  personOptions: SearchSelectOption[];
  contractOptions: SearchSelectOption[];
  paymentMethodOptions: SearchSelectOption[];

  categoryOptions: DynamicSelectOption[];
  categoryDynamicOptions: DynamicSelectOption[];
  statusOptions: DynamicSelectOption[];
  statusDynamicOptions: DynamicSelectOption[];
  costCenterOptions: DynamicSelectOption[];

  handleAddCategory: (name: string) => Promise<void>;
  handleDeleteCategory: (key: string) => Promise<void>;
  handleAddStatus: (name: string) => Promise<void>;
  handleDeleteStatus: (key: string) => Promise<void>;
  handleAddCostCenter: (name: string) => Promise<void>;
  handleDeleteCostCenter: (key: string) => Promise<void>;

  isAdmin: boolean;
  copyLinkDone: boolean;
  handleCopyDeepLink: () => void;
  handleClone: () => void;
  statusColor: string;
  handleDeleteFinancial: () => void;
  financialToDelete: Financial | null;
  confirmDeleteFinancial: () => Promise<void>;
  cancelDeleteFinancial: () => void;
}

const CLONE_PREFIX = 'new-financial:clone:';

export const useViewFinancialViewModel = (tabKey: string): ViewFinancialViewModel => {
  const cloneSourceId = tabKey.startsWith(CLONE_PREFIX) ? tabKey.slice(CLONE_PREFIX.length) : null;
  const isNew = tabKey === 'new-financial' || cloneSourceId !== null;
  const financialId = isNew ? '' : tabKey.replace('view-financial:', '');

  const { financials, createFinancial, updateFinancial, deleteFinancial } = useFinancialStore();
  const { tags, getTagsForFinancial, setTagsForFinancial, createTag, updateTag, deleteTag } = useFinancialTagStore();
  const { categoryConfigs, statusConfigs, addItem, removeItem } = useFinancialLookup();
  const { costCenterConfigs, addItem: addContractLookupItem, removeItem: removeContractLookupItem } = useContractLookup();
  const { cases } = useCaseStore();
  const { persons } = usePersonStore();
  const { contracts } = useContractStore();
  const { typeConfigs: documentTypeConfigs, addItem: addDocumentType, removeItem: removeDocumentType } = useDocumentTypeLookup();
  const { user, effectiveName } = useAuth();
  const { tenantRole, currentTenant } = useTenant();
  const { setTabTitle, closeTab, openTab, activePanelId } = useWorkspace();
  const { notify } = useNotification();
  const theme = useTheme();
  const { financialDocumentRepository } = useDI();

  const financial = useMemo(
    () => (isNew ? null : (financials.find((f) => f.id === financialId) ?? null)),
    [financials, financialId, isNew],
  );

  const cloneSource = useMemo(
    () => (cloneSourceId ? (financials.find((f) => f.id === cloneSourceId) ?? null) : null),
    [financials, cloneSourceId],
  );

  const isAdmin = tenantRole === 'admin';

  const [activeTab, setActiveTab] = useState<ViewFinancialTab>('data');
  const [formData, setFormDataState] = useState<FinancialFormData>(() => {
    const base = buildFormData(cloneSource);
    return cloneSource ? { ...base, status: 'Aberto', paymentDate: '', cancelDate: '', invoiceNumber: '' } : base;
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);
  const [copyLinkDone, setCopyLinkDone] = useState(false);
  const [financialToDelete, setFinancialToDelete] = useState<Financial | null>(null);

  const [documents, setDocuments] = useState<FinancialDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [docToDelete, setDocToDelete] = useState<FinancialDocument | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingType, setPendingType] = useState('');

  const docUC = useMemo(() => ({
    get:    makeGetFinancialDocumentsUseCase(financialDocumentRepository),
    upload: makeUploadFinancialDocumentUseCase(financialDocumentRepository),
    add:    makeAddFinancialDocumentUseCase(financialDocumentRepository),
    delete: makeDeleteFinancialDocumentUseCase(financialDocumentRepository),
  }), [financialDocumentRepository]);

  useEffect(() => {
    if (!financial || !currentTenant) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carregamento inicial após navegação para aba
    setDocsLoading(true);
    docUC.get.execute(currentTenant.id, financial.id)
      .then(setDocuments)
      .finally(() => setDocsLoading(false));
  }, [financial, currentTenant, docUC]);

  useEffect(() => {
    if (financial) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza formulário ao carregar/atualizar dados do lançamento
      setFormDataState(buildFormData(financial));
      setTabTitle(tabKey, financial.category);
    }
  }, [financial, tabKey, setTabTitle]);

  const setFormData = useCallback((data: Partial<FinancialFormData>) => {
    setFormDataState((prev) => ({ ...prev, ...data }));
  }, []);

  const caseOptions = useMemo<SearchSelectOption[]>(
    () => cases.map((c) => ({ value: c.id, label: `${c.caseNumber} — ${c.title}` })),
    [cases],
  );

  const personOptions = useMemo<SearchSelectOption[]>(
    () => persons.map((p) => ({ value: p.id, label: p.name })).sort((a, b) => a.label.localeCompare(b.label)),
    [persons],
  );

  const contractOptions = useMemo<SearchSelectOption[]>(
    () => contracts.map((c) => ({ value: c.id, label: `${c.number} — ${c.title}` })),
    [contracts],
  );

  const categoryOptions = useMemo<DynamicSelectOption[]>(
    () => categoryConfigs.filter((c) => c.isStatic !== false).map((c) => ({ value: c.key, label: c.label })),
    [categoryConfigs],
  );
  const categoryDynamicOptions = useMemo<DynamicSelectOption[]>(
    () => categoryConfigs.filter((c) => c.isStatic === false).map((c) => ({ value: c.key, label: c.label })),
    [categoryConfigs],
  );

  const statusOptions = useMemo<DynamicSelectOption[]>(
    () => statusConfigs.filter((c) => c.isStatic !== false).map((c) => ({ value: c.key, label: c.label, color: resolveColor(c.color, theme) })),
    [statusConfigs, theme],
  );
  const statusDynamicOptions = useMemo<DynamicSelectOption[]>(
    () => statusConfigs.filter((c) => c.isStatic === false).map((c) => ({ value: c.key, label: c.label, color: resolveColor(c.color, theme) })),
    [statusConfigs, theme],
  );

  const costCenterOptions = useMemo<DynamicSelectOption[]>(
    () => costCenterConfigs.map((c) => ({ value: c.key, label: c.label })),
    [costCenterConfigs],
  );

  const documentTypeOptions = useMemo<DynamicSelectOption[]>(() =>
    documentTypeConfigs.filter((t) => t.isStatic !== false).map((t) => ({ value: t.key, label: t.label })),
    [documentTypeConfigs],
  );
  const documentTypeDynamicOptions = useMemo<DynamicSelectOption[]>(() =>
    documentTypeConfigs.filter((t) => t.isStatic === false).map((t) => ({ value: t.key, label: t.label })),
    [documentTypeConfigs],
  );

  const handleAddCategory = useCallback(async (name: string) => { await addItem('categories', name); }, [addItem]);
  const handleDeleteCategory = useCallback(async (key: string) => { await removeItem('categories', key); }, [removeItem]);
  const handleAddStatus = useCallback(async (name: string) => { await addItem('statuses', name); }, [addItem]);
  const handleDeleteStatus = useCallback(async (key: string) => { await removeItem('statuses', key); }, [removeItem]);
  const handleAddCostCenter = useCallback(async (name: string) => { await addContractLookupItem('costCenters', name); }, [addContractLookupItem]);
  const handleDeleteCostCenter = useCallback(async (key: string) => { await removeContractLookupItem('costCenters', key); }, [removeContractLookupItem]);

  const handleAddDocumentType = useCallback(async (name: string) => { await addDocumentType(name); }, [addDocumentType]);
  const handleDeleteDocumentType = useCallback(async (key: string) => { await removeDocumentType(key); }, [removeDocumentType]);

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
    if (!pendingFile || !financial || !currentTenant || !user) return;
    setIsUploadingDoc(true);
    try {
      const raw = await docUC.upload.execute(currentTenant.id, financial.id, pendingFile);
      const { url, storagePath } = JSON.parse(raw) as { url: string; storagePath: string };
      const addedDoc = await docUC.add.execute(currentTenant.id, financial.id, {
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
  }, [pendingFile, pendingType, financial, currentTenant, user, effectiveName, docUC, notify]);

  const requestDeleteDoc = useCallback((doc: FinancialDocument) => setDocToDelete(doc), []);
  const cancelDeleteDoc = useCallback(() => setDocToDelete(null), []);
  const confirmDeleteDoc = useCallback(async () => {
    if (!docToDelete || !financial || !currentTenant) return;
    try {
      const actor: DeletionActor = { uid: user?.id ?? '', name: effectiveName, photoURL: user?.photoURL ?? '' };
      await docUC.delete.execute(currentTenant.id, financial.id, docToDelete.id, docToDelete.storagePath, actor);
      setDocuments((prev) => prev.filter((d) => d.id !== docToDelete.id));
      notify('Documento excluído.', 'success');
    } catch {
      notify('Erro ao excluir documento.', 'error');
    } finally {
      setDocToDelete(null);
    }
  }, [docToDelete, financial, currentTenant, docUC, notify, user, effectiveName]);

  const handleSave = useCallback(async () => {
    if (!formData.amount || formData.amount <= 0) { notify('Informe um valor válido.', 'error'); return; }
    if (!formData.dueDate) { notify('Informe a data de vencimento.', 'error'); return; }
    if (!formData.category) { notify('Categoria é obrigatória.', 'error'); return; }
    if (!formData.status) { notify('Status é obrigatório.', 'error'); return; }

    const selectedCase = cases.find((c) => c.id === formData.caseId);
    const selectedPerson = persons.find((p) => p.id === formData.personId);
    const selectedContract = contracts.find((c) => c.id === formData.contractId);

    setIsSaving(true);
    try {
      const payload = {
        type: formData.type,
        category: formData.category,
        costCenter: formData.costCenter || null,
        amount: formData.amount,
        dueDate: new Date(`${formData.dueDate}T12:00:00`),
        paymentDate: formData.paymentDate ? new Date(`${formData.paymentDate}T12:00:00`) : null,
        cancelDate: formData.cancelDate ? new Date(`${formData.cancelDate}T12:00:00`) : null,
        status: formData.status,
        paymentMethod: (formData.paymentMethod as PaymentMethod) || null,
        caseId: formData.caseId || null,
        caseNumber: selectedCase?.caseNumber ?? null,
        personId: formData.personId || null,
        personName: selectedPerson?.name ?? null,
        contractId: formData.contractId || null,
        contractNumber: selectedContract?.number ?? null,
        invoiceNumber: formData.invoiceNumber || null,
        notes: formData.notes || null,
      };

      if (isNew) {
        const created = await createFinancial({ ...payload, createdBy: user?.id ?? '', tagIds: [] });
        notify('Lançamento criado com sucesso!', 'success');
        const newTabKey = `view-financial:${created.id}`;
        closeTab(tabKey, activePanelId ?? 'main');
        openTab(newTabKey);
        setTabTitle(newTabKey, created.category);
      } else if (financial) {
        await updateFinancial(financial.id, {
          ...payload,
          updatedBy: user?.id ?? '',
          updatedByName: effectiveName,
          updatedByPhotoURL: user?.photoURL ?? '',
        });
        notify('Lançamento atualizado com sucesso!', 'success');
      }
    } catch (err) {
      console.error('[ViewFinancial handleSave]', err);
      notify('Erro ao salvar lançamento.', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [formData, isNew, financial, cases, persons, contracts, createFinancial, updateFinancial, notify, user, effectiveName, tabKey, setTabTitle, closeTab, openTab, activePanelId]);

  const tagAdapter: TagStoreAdapter = useMemo(() => ({
    tags,
    getAppliedTags: (entityId: string) => getTagsForFinancial(entityId, financial?.tagIds ?? []),
    setTags: (entityId: string, tagIds: string[]) => setTagsForFinancial(entityId, tagIds),
    createTag: (name: string, color: string) => createTag(name, color),
    updateTag: (id: string, data: { name: string; color: string }) => updateTag(id, data),
    deleteTag: (id: string) => deleteTag(id),
  }), [tags, financial, getTagsForFinancial, setTagsForFinancial, createTag, updateTag, deleteTag]);

  const openTagManager = useCallback(() => setIsTagManagerOpen(true), []);
  const closeTagManager = useCallback(() => setIsTagManagerOpen(false), []);

  const handleCopyDeepLink = useCallback(() => {
    if (!financial) return;
    void navigator.clipboard.writeText(generateDeepLink(`view-financial:${financial.id}`));
    setCopyLinkDone(true);
    setTimeout(() => setCopyLinkDone(false), 2000);
  }, [financial]);

  const handleClone = useCallback(() => {
    if (!financial) return;
    openTab(`${CLONE_PREFIX}${financial.id}`);
  }, [financial, openTab]);

  const statusColor = useMemo(() => {
    if (!formData.status) return theme.colors.textSecondary;
    return getConfigColor(statusConfigs, formData.status, theme);
  }, [formData.status, statusConfigs, theme]);

  const handleDeleteFinancial = useCallback(() => {
    if (financial) setFinancialToDelete(financial);
  }, [financial]);

  const confirmDeleteFinancial = useCallback(async () => {
    if (!financialToDelete) return;
    try {
      await deleteFinancial(financialToDelete.id);
      notify('Lançamento excluído.', 'success');
      closeTab(tabKey, activePanelId);
    } catch {
      notify('Erro ao excluir lançamento.', 'error');
    } finally {
      setFinancialToDelete(null);
    }
  }, [financialToDelete, deleteFinancial, notify, closeTab, tabKey, activePanelId]);

  const cancelDeleteFinancial = useCallback(() => setFinancialToDelete(null), []);

  return {
    isNew,
    financial,
    activeTab,
    setActiveTab,
    formData,
    setFormData,
    isSaving,
    handleSave,
    tagAdapter,
    isTagManagerOpen,
    openTagManager,
    closeTagManager,
    caseOptions,
    personOptions,
    contractOptions,
    paymentMethodOptions: PAYMENT_METHOD_OPTIONS,
    categoryOptions,
    categoryDynamicOptions,
    statusOptions,
    statusDynamicOptions,
    costCenterOptions,
    handleAddCategory,
    handleDeleteCategory,
    handleAddStatus,
    handleDeleteStatus,
    handleAddCostCenter,
    handleDeleteCostCenter,
    documents,
    docsLoading,
    isUploadingDoc,
    pendingFile,
    pendingType,
    setPendingType,
    documentTypeOptions,
    documentTypeDynamicOptions,
    handleAddDocumentType,
    handleDeleteDocumentType,
    handleSelectFile,
    handleConfirmUpload,
    handleCancelPendingUpload,
    docToDelete,
    requestDeleteDoc,
    confirmDeleteDoc,
    cancelDeleteDoc,
    isAdmin,
    copyLinkDone,
    handleCopyDeepLink,
    handleClone,
    statusColor,
    handleDeleteFinancial,
    financialToDelete,
    confirmDeleteFinancial,
    cancelDeleteFinancial,
  };
};
