import { useMemo } from 'react';
import { usePersonStore } from '../../stores/usePersonStore';
import { useCaseStore } from '../../stores/useCaseStore';
import { useContractStore } from '../../stores/useContractStore';
import { useFinancialStore } from '../../stores/useFinancialStore';
import { useDeadlineStore } from '../../stores/useDeadlineStore';
import { useCustomRecords } from '../../stores/useCustomRecords';
import { useTenant } from '../../stores/useTenant';
import { formatCurrencyBRL } from '../../utils/formatters';

export interface ReferenceOption {
  value: string;
  label: string;
  meta?: string;
}

export const useReferenceOptions = (): Record<string, ReferenceOption[]> => {
  const { persons } = usePersonStore();
  const { cases } = useCaseStore();
  const { contracts } = useContractStore();
  const { financials } = useFinancialStore();
  const { deadlines } = useDeadlineStore();
  const { recordsByScreen } = useCustomRecords();
  const { members } = useTenant();

  return useMemo(() => {
    const map: Record<string, ReferenceOption[]> = {
      persons: persons
        .map((p) => ({ value: p.id, label: p.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
      members: members
        .map((m) => ({ value: m.userId, label: m.displayName }))
        .sort((a, b) => a.label.localeCompare(b.label)),
      cases: cases
        .map((c) => ({ value: c.id, label: c.title, meta: c.caseNumber }))
        .sort((a, b) => a.label.localeCompare(b.label)),
      contracts: contracts
        .map((c) => ({ value: c.id, label: c.title, meta: c.number }))
        .sort((a, b) => a.label.localeCompare(b.label)),
      financials: financials
        .map((f) => ({
          value: f.id,
          label: `${f.category} — ${formatCurrencyBRL(f.amount)}`,
          meta: (f.personId ? persons.find((p) => p.id === f.personId)?.name : undefined) ?? undefined,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
      deadlines: deadlines
        .map((d) => ({ value: d.id, label: `${d.type} — ${cases.find((c) => c.id === d.caseId)?.title ?? '—'}` }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    };
    Object.entries(recordsByScreen).forEach(([screenKey, records]) => {
      map[screenKey] = records
        .map((r) => ({ value: r.id, label: r.title }))
        .sort((a, b) => a.label.localeCompare(b.label));
    });
    return map;
  }, [persons, cases, contracts, financials, deadlines, recordsByScreen, members]);
};
