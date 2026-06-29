import { useState, useMemo, useCallback } from 'react';
import { useTheme } from 'styled-components';
import { useFinancialStore } from '../../../stores/useFinancialStore';
import { useCaseStore } from '../../../stores/useCaseStore';
import { usePersonStore } from '../../../stores/usePersonStore';
import { useAuth } from '../../../stores/useAuth';
import { useNotification } from '../../../stores/useNotification';
import type {
  Financial,
  FinancialType,
  FinancialStatus,
  FinancialCategory,
  PaymentMethod,
} from '../../../domain/entities';
import type { FilterDef, FilterToken } from '../../components/ui/CompositeFilter';

export interface FinancialFormData {
  type: FinancialType;
  category: FinancialCategory;
  description: string;
  amount: string;
  dueDate: string;
  paymentDate: string;
  status: FinancialStatus;
  paymentMethod: PaymentMethod | '';
  caseId: string;
  personId: string;
  invoiceNumber: string;
  notes: string;
}

const EMPTY_FORM: FinancialFormData = {
  type: 'Receita',
  category: 'Honorários',
  description: '',
  amount: '',
  dueDate: '',
  paymentDate: '',
  status: 'Pendente',
  paymentMethod: '',
  caseId: '',
  personId: '',
  invoiceNumber: '',
  notes: '',
};

export interface FinancialSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

export interface FinancialsViewModel {
  financials: Financial[];
  filteredFinancials: Financial[];
  isLoading: boolean;
  summary: FinancialSummary;
  filterTokens: FilterToken[];
  filterDefs: FilterDef[];
  savedFiltersScreenKey: string;
  isModalOpen: boolean;
  editingFinancial: Financial | null;
  formData: FinancialFormData;
  isSaving: boolean;
  financialToDelete: Financial | null;
  caseOptions: { value: string; label: string }[];
  personOptions: { value: string; label: string }[];
  setFilterTokens: (tokens: FilterToken[]) => void;
  openCreateModal: (type?: FinancialType) => void;
  openEditModal: (f: Financial) => void;
  closeModal: () => void;
  setFormData: (data: Partial<FinancialFormData>) => void;
  handleSave: () => Promise<void>;
  handleDelete: (f: Financial) => void;
  confirmDelete: () => Promise<void>;
  cancelDelete: () => void;
  handleMarkPaid: (f: Financial) => Promise<void>;
  formatAmount: (amount: number) => string;
  isOverdue: (f: Financial) => boolean;
  getStatusColor: (status: string) => string;
  getTypeColor: (type: string) => string;
}

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const useFinancialsViewModel = (): FinancialsViewModel => {
  const { financials, isLoading, createFinancial, updateFinancial, markPaid, deleteFinancial } = useFinancialStore();
  const { cases } = useCaseStore();
  const { persons } = usePersonStore();
  const { user } = useAuth();
  const { notify } = useNotification();
  const theme = useTheme();

  const [filterTokens, setFilterTokens] = useState<FilterToken[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFinancial, setEditingFinancial] = useState<Financial | null>(null);
  const [formData, setFormDataState] = useState<FinancialFormData>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [financialToDelete, setFinancialToDelete] = useState<Financial | null>(null);

  const caseOptions = useMemo(() =>
    cases.map((c) => ({ value: c.id, label: `${c.caseNumber} — ${c.title}` })),
    [cases],
  );

  const personOptions = useMemo(() =>
    persons.map((c) => ({ value: c.id, label: c.name })),
    [persons],
  );

  const getStatusColor = useCallback((status: string): string => {
    const map: Record<FinancialStatus, string> = {
      'Pendente':  theme.colors.warning,
      'Pago':      theme.colors.success,
      'Vencido':   theme.colors.danger,
      'Cancelado': theme.colors.textSecondary,
    };
    return map[status as FinancialStatus] ?? theme.colors.textSecondary;
  }, [theme]);

  const getTypeColor = useCallback((type: string): string => {
    return type === 'Receita' ? theme.colors.success : theme.colors.danger;
  }, [theme]);

  const filterDefs = useMemo<FilterDef[]>(() => [
    { key: 'search', label: 'Busca', type: 'text', placeholder: 'Descrição, pessoa ou processo...' },
    { key: 'type', label: 'Tipo', type: 'select', options: (['Receita','Despesa'] as FinancialType[]).map((t) => ({ value: t, label: t })) },
    { key: 'status', label: 'Status', type: 'select', options: (['Pendente','Pago','Vencido','Cancelado'] as FinancialStatus[]).map((s) => ({ value: s, label: s })) },
    { key: 'case', label: 'Processo', type: 'select', options: caseOptions },
  ], [caseOptions]);

  const tokenMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    filterTokens.forEach((t) => { map[t.key] = t.values; });
    return map;
  }, [filterTokens]);

  const setFormData = useCallback((data: Partial<FinancialFormData>) => {
    setFormDataState((prev) => ({ ...prev, ...data }));
  }, []);

  const isOverdue = useCallback((f: Financial) => {
    if (f.status !== 'Pendente') return false;
    return f.dueDate.getTime() < Date.now();
  }, []);

  const formatAmount = useCallback((amount: number) => fmt.format(amount), []);

  const filteredFinancials = useMemo(() => {
    const searchQ = (tokenMap['search']?.[0] ?? '').toLowerCase();
    const typeFilter = tokenMap['type'] ?? [];
    const statusFilter = tokenMap['status'] ?? [];
    const caseFilter = tokenMap['case'] ?? [];

    return [...financials]
      .sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime())
      .filter((f) => {
        if (searchQ && !f.description.toLowerCase().includes(searchQ) &&
          !(f.personName?.toLowerCase().includes(searchQ)) &&
          !(f.caseNumber?.toLowerCase().includes(searchQ))) return false;
        if (typeFilter.length > 0 && !typeFilter.includes(f.type)) return false;
        if (statusFilter.length > 0 && !statusFilter.includes(f.status)) return false;
        if (caseFilter.length > 0 && !caseFilter.includes(f.caseId ?? '')) return false;
        return true;
      });
  }, [financials, tokenMap]);

  const summary = useMemo<FinancialSummary>(() => {
    const totalIncome = filteredFinancials.filter((f) => f.type === 'Receita' && f.status === 'Pago').reduce((s, f) => s + f.amount, 0);
    const totalExpense = filteredFinancials.filter((f) => f.type === 'Despesa' && f.status === 'Pago').reduce((s, f) => s + f.amount, 0);
    return { totalIncome, totalExpense, balance: totalIncome - totalExpense };
  }, [filteredFinancials]);

  const openCreateModal = useCallback((type: FinancialType = 'Receita') => {
    setEditingFinancial(null);
    setFormDataState({ ...EMPTY_FORM, type });
    setIsModalOpen(true);
  }, []);

  const openEditModal = useCallback((f: Financial) => {
    setEditingFinancial(f);
    setFormDataState({
      type: f.type,
      category: f.category,
      description: f.description,
      amount: f.amount.toString(),
      dueDate: f.dueDate.toISOString().slice(0, 10),
      paymentDate: f.paymentDate ? f.paymentDate.toISOString().slice(0, 10) : '',
      status: f.status,
      paymentMethod: f.paymentMethod ?? '',
      caseId: f.caseId ?? '',
      personId: f.personId ?? '',
      invoiceNumber: f.invoiceNumber ?? '',
      notes: f.notes ?? '',
    });
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingFinancial(null);
    setFormDataState(EMPTY_FORM);
  }, []);

  const handleSave = useCallback(async () => {
    if (!formData.description.trim()) { notify('Descrição é obrigatória.', 'error'); return; }
    if (!formData.amount || parseFloat(formData.amount) <= 0) { notify('Informe um valor válido.', 'error'); return; }
    if (!formData.dueDate) { notify('Informe a data de vencimento.', 'error'); return; }

    const selectedCase = cases.find((c) => c.id === formData.caseId);
    const selectedPerson = persons.find((c) => c.id === formData.personId);

    setIsSaving(true);
    try {
      const payload = {
        type: formData.type,
        category: formData.category,
        description: formData.description.trim(),
        amount: parseFloat(formData.amount),
        dueDate: new Date(`${formData.dueDate}T12:00:00`),
        paymentDate: formData.paymentDate ? new Date(`${formData.paymentDate}T12:00:00`) : null,
        status: formData.status,
        paymentMethod: (formData.paymentMethod as PaymentMethod) || null,
        caseId: formData.caseId || null,
        caseNumber: selectedCase?.caseNumber ?? null,
        personId: formData.personId || null,
        personName: selectedPerson?.name ?? null,
        invoiceNumber: formData.invoiceNumber || null,
        notes: formData.notes || null,
      };

      if (editingFinancial) {
        await updateFinancial(editingFinancial.id, payload);
        notify('Lançamento atualizado com sucesso!', 'success');
      } else {
        await createFinancial({ ...payload, createdBy: user?.id ?? '' });
        notify('Lançamento criado com sucesso!', 'success');
      }
      closeModal();
    } catch {
      notify('Erro ao salvar lançamento.', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [formData, editingFinancial, cases, persons, createFinancial, updateFinancial, closeModal, notify, user]);

  const handleDelete = useCallback((f: Financial) => { setFinancialToDelete(f); }, []);

  const confirmDelete = useCallback(async () => {
    if (!financialToDelete) return;
    try {
      await deleteFinancial(financialToDelete.id);
      notify('Lançamento excluído.', 'success');
    } catch {
      notify('Erro ao excluir lançamento.', 'error');
    } finally {
      setFinancialToDelete(null);
    }
  }, [financialToDelete, deleteFinancial, notify]);

  const cancelDelete = useCallback(() => setFinancialToDelete(null), []);

  const handleMarkPaid = useCallback(async (f: Financial) => {
    try {
      await markPaid(f.id, new Date());
      notify('Pagamento registrado!', 'success');
    } catch {
      notify('Erro ao registrar pagamento.', 'error');
    }
  }, [markPaid, notify]);

  return {
    financials,
    filteredFinancials,
    isLoading,
    summary,
    filterTokens,
    filterDefs,
    savedFiltersScreenKey: 'financials',
    isModalOpen,
    editingFinancial,
    formData,
    isSaving,
    financialToDelete,
    caseOptions,
    personOptions,
    setFilterTokens,
    openCreateModal,
    openEditModal,
    closeModal,
    setFormData,
    handleSave,
    handleDelete,
    confirmDelete,
    cancelDelete,
    handleMarkPaid,
    formatAmount,
    isOverdue,
    getStatusColor,
    getTypeColor,
  };
};
