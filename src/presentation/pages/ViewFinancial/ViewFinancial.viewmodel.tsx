import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTheme } from 'styled-components';
import { useFinancialStore } from '../../../stores/useFinancialStore';
import { useFinancialLookup } from '../../../stores/useFinancialLookup';
import { useContractLookup } from '../../../stores/useContractLookup';
import { useCaseStore } from '../../../stores/useCaseStore';
import { usePersonStore } from '../../../stores/usePersonStore';
import { useContractStore } from '../../../stores/useContractStore';
import { useAuth } from '../../../stores/useAuth';
import { useTenant } from '../../../stores/useTenant';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useNotification } from '../../../stores/useNotification';
import { generateDeepLink } from '../../../infrastructure/deeplink/deepLinkUtils';
import { resolveColor, getConfigColor } from '../../../shared/styles/colorUtils';
import { toDateInputValue as toDateInput } from '../../../utils/formatters';
import type { DynamicSelectOption } from '../../components/ui/DynamicSelect';
import type { SearchSelectOption } from '../../components/ui/SearchSelect';
import type { Financial, FinancialType, PaymentMethod } from '../../../domain/entities';

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
  formData: FinancialFormData;
  setFormData: (data: Partial<FinancialFormData>) => void;
  isSaving: boolean;
  handleSave: () => Promise<void>;

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
  statusColor: string;
  handleDeleteFinancial: () => void;
  financialToDelete: Financial | null;
  confirmDeleteFinancial: () => Promise<void>;
  cancelDeleteFinancial: () => void;
}

export const useViewFinancialViewModel = (tabKey: string): ViewFinancialViewModel => {
  const isNew = tabKey === 'new-financial';
  const financialId = isNew ? '' : tabKey.replace('view-financial:', '');

  const { financials, createFinancial, updateFinancial, deleteFinancial } = useFinancialStore();
  const { categoryConfigs, statusConfigs, addItem, removeItem } = useFinancialLookup();
  const { costCenterConfigs, addItem: addContractLookupItem, removeItem: removeContractLookupItem } = useContractLookup();
  const { cases } = useCaseStore();
  const { persons } = usePersonStore();
  const { contracts } = useContractStore();
  const { user } = useAuth();
  const { tenantRole } = useTenant();
  const { setTabTitle, closeTab, openTab, activePanelId } = useWorkspace();
  const { notify } = useNotification();
  const theme = useTheme();

  const financial = useMemo(
    () => (isNew ? null : (financials.find((f) => f.id === financialId) ?? null)),
    [financials, financialId, isNew],
  );

  const isAdmin = tenantRole === 'admin';

  const [formData, setFormDataState] = useState<FinancialFormData>(() => buildFormData(financial));
  const [isSaving, setIsSaving] = useState(false);
  const [copyLinkDone, setCopyLinkDone] = useState(false);
  const [financialToDelete, setFinancialToDelete] = useState<Financial | null>(null);

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

  const handleAddCategory = useCallback(async (name: string) => { await addItem('categories', name); }, [addItem]);
  const handleDeleteCategory = useCallback(async (key: string) => { await removeItem('categories', key); }, [removeItem]);
  const handleAddStatus = useCallback(async (name: string) => { await addItem('statuses', name); }, [addItem]);
  const handleDeleteStatus = useCallback(async (key: string) => { await removeItem('statuses', key); }, [removeItem]);
  const handleAddCostCenter = useCallback(async (name: string) => { await addContractLookupItem('costCenters', name); }, [addContractLookupItem]);
  const handleDeleteCostCenter = useCallback(async (key: string) => { await removeContractLookupItem('costCenters', key); }, [removeContractLookupItem]);

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
        const created = await createFinancial({ ...payload, createdBy: user?.id ?? '' });
        notify('Lançamento criado com sucesso!', 'success');
        const newTabKey = `view-financial:${created.id}`;
        closeTab(tabKey, activePanelId ?? 'main');
        openTab(newTabKey);
        setTabTitle(newTabKey, created.category);
      } else if (financial) {
        await updateFinancial(financial.id, payload);
        notify('Lançamento atualizado com sucesso!', 'success');
      }
    } catch (err) {
      console.error('[ViewFinancial handleSave]', err);
      notify('Erro ao salvar lançamento.', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [formData, isNew, financial, cases, persons, contracts, createFinancial, updateFinancial, notify, user, tabKey, setTabTitle, closeTab, openTab, activePanelId]);

  const handleCopyDeepLink = useCallback(() => {
    if (!financial) return;
    void navigator.clipboard.writeText(generateDeepLink(`view-financial:${financial.id}`));
    setCopyLinkDone(true);
    setTimeout(() => setCopyLinkDone(false), 2000);
  }, [financial]);

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
    formData,
    setFormData,
    isSaving,
    handleSave,
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
    isAdmin,
    copyLinkDone,
    handleCopyDeepLink,
    statusColor,
    handleDeleteFinancial,
    financialToDelete,
    confirmDeleteFinancial,
    cancelDeleteFinancial,
  };
};
