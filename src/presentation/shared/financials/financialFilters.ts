import type { DefaultTheme } from 'styled-components';
import { getConfigColor } from '../../../shared/styles/colorUtils';
import type { Financial, FinancialLookupConfig } from '../../../domain/entities';
import type { FilterDef, FilterOption, FilterToken } from '../../components/ui/CompositeFilter';

export interface FinancialFilterOptions {
  caseOptions: FilterOption[];
  personOptions: FilterOption[];
  contractOptions: FilterOption[];
  tagOptions: FilterOption[];
  statusConfigs: FinancialLookupConfig[];
  theme: DefaultTheme;
}

export const toISODate = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const buildDefaultMonthTokens = (): FilterToken[] => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return [
    { key: 'dueDateFrom', values: [toISODate(start)] },
    { key: 'dueDateTo', values: [toISODate(end)] },
  ];
};

export const buildFinancialFilterDefs = ({
  caseOptions,
  personOptions,
  contractOptions,
  tagOptions,
  statusConfigs,
  theme,
}: FinancialFilterOptions): FilterDef[] => [
  { key: 'search', label: 'Busca', type: 'text', placeholder: 'Categoria, pessoa, processo ou contrato...' },
  { key: 'type', label: 'Tipo', type: 'select', options: (['Receita', 'Despesa'] as const).map((t) => ({ value: t, label: t })) },
  {
    key: 'status', label: 'Status', type: 'select',
    options: statusConfigs.map((s) => ({ value: s.key, label: s.label, color: getConfigColor(statusConfigs, s.key, theme) })),
  },
  { key: 'case', label: 'Processo', type: 'select', options: caseOptions },
  { key: 'person', label: 'Pessoa', type: 'select', options: personOptions },
  { key: 'contract', label: 'Contrato', type: 'select', options: contractOptions },
  ...(tagOptions.length > 0 ? [{ key: 'tag', label: 'Etiqueta', type: 'select' as const, options: tagOptions }] : []),
  { key: 'dueDateFrom', label: 'Vencimento (de)', type: 'date' },
  { key: 'dueDateTo', label: 'Vencimento (até)', type: 'date' },
  { key: 'paymentDateFrom', label: 'Pagamento (de)', type: 'date' },
  { key: 'paymentDateTo', label: 'Pagamento (até)', type: 'date' },
  { key: 'periodFrom', label: 'Período (de)', type: 'date' },
  { key: 'periodTo', label: 'Período (até)', type: 'date' },
];

export const buildTokenMap = (tokens: FilterToken[]): Record<string, string[]> => {
  const map: Record<string, string[]> = {};
  tokens.forEach((t) => { map[t.key] = t.values; });
  return map;
};

export const filterFinancialsByTokens = (financials: Financial[], tokens: FilterToken[]): Financial[] => {
  const tokenMap = buildTokenMap(tokens);
  const searchQ = (tokenMap['search']?.[0] ?? '').toLowerCase();
  const typeFilter = tokenMap['type'] ?? [];
  const statusFilter = tokenMap['status'] ?? [];
  const caseFilter = tokenMap['case'] ?? [];
  const personFilter = tokenMap['person'] ?? [];
  const contractFilter = tokenMap['contract'] ?? [];
  const tagFilter = tokenMap['tag'] ?? [];
  const dueDateStart = tokenMap['dueDateFrom']?.[0];
  const dueDateEnd = tokenMap['dueDateTo']?.[0];
  const paymentDateStart = tokenMap['paymentDateFrom']?.[0];
  const paymentDateEnd = tokenMap['paymentDateTo']?.[0];
  const periodStart = tokenMap['periodFrom']?.[0];
  const periodEnd = tokenMap['periodTo']?.[0];

  const dueDateStartAt = dueDateStart ? new Date(`${dueDateStart}T00:00:00`) : null;
  const dueDateEndAt = dueDateEnd ? new Date(`${dueDateEnd}T23:59:59`) : null;
  const paymentDateStartAt = paymentDateStart ? new Date(`${paymentDateStart}T00:00:00`) : null;
  const paymentDateEndAt = paymentDateEnd ? new Date(`${paymentDateEnd}T23:59:59`) : null;
  const periodStartAt = periodStart ? new Date(`${periodStart}T00:00:00`) : null;
  const periodEndAt = periodEnd ? new Date(`${periodEnd}T23:59:59`) : null;

  return financials.filter((f) => {
    if (searchQ && !f.category.toLowerCase().includes(searchQ) &&
      !(f.personName?.toLowerCase().includes(searchQ)) &&
      !(f.caseNumber?.toLowerCase().includes(searchQ)) &&
      !(f.contractNumber?.toLowerCase().includes(searchQ))) return false;
    if (typeFilter.length > 0 && !typeFilter.includes(f.type)) return false;
    if (statusFilter.length > 0 && !statusFilter.includes(f.status)) return false;
    if (caseFilter.length > 0 && !caseFilter.includes(f.caseId ?? '')) return false;
    if (personFilter.length > 0 && !personFilter.includes(f.personId ?? '')) return false;
    if (contractFilter.length > 0 && !contractFilter.includes(f.contractId ?? '')) return false;
    if (tagFilter.length > 0 && !tagFilter.some((tid) => f.tagIds?.includes(tid))) return false;
    if (dueDateStartAt && f.dueDate.getTime() < dueDateStartAt.getTime()) return false;
    if (dueDateEndAt && f.dueDate.getTime() > dueDateEndAt.getTime()) return false;
    if (paymentDateStartAt && (!f.paymentDate || f.paymentDate.getTime() < paymentDateStartAt.getTime())) return false;
    if (paymentDateEndAt && (!f.paymentDate || f.paymentDate.getTime() > paymentDateEndAt.getTime())) return false;
    if (periodStartAt) {
      const dueOk = f.dueDate.getTime() >= periodStartAt.getTime();
      const paidOk = !!f.paymentDate && f.paymentDate.getTime() >= periodStartAt.getTime();
      if (!dueOk && !paidOk) return false;
    }
    if (periodEndAt) {
      const dueOk = f.dueDate.getTime() <= periodEndAt.getTime();
      const paidOk = !!f.paymentDate && f.paymentDate.getTime() <= periodEndAt.getTime();
      if (!dueOk && !paidOk) return false;
    }
    return true;
  });
};

export interface FinancialSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  pendingIncome: number;
  pendingExpense: number;
  projectedBalance: number;
}

export const computeFinancialSummary = (financials: Financial[]): FinancialSummary => {
  const totalIncome = financials.filter((f) => f.type === 'Receita' && f.status === 'Pago').reduce((s, f) => s + f.amount, 0);
  const totalExpense = financials.filter((f) => f.type === 'Despesa' && f.status === 'Pago').reduce((s, f) => s + f.amount, 0);
  const pendingIncome = financials.filter((f) => f.type === 'Receita' && f.status === 'Aberto').reduce((s, f) => s + f.amount, 0);
  const pendingExpense = financials.filter((f) => f.type === 'Despesa' && f.status === 'Aberto').reduce((s, f) => s + f.amount, 0);
  return {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    pendingIncome,
    pendingExpense,
    projectedBalance: pendingIncome - pendingExpense,
  };
};
