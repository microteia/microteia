import { useMemo } from 'react';
import { usePersonStore } from '../../stores/usePersonStore';
import { useContractStore } from '../../stores/useContractStore';
import { useFinancialStore } from '../../stores/useFinancialStore';
import { useDeadlineStore } from '../../stores/useDeadlineStore';
import { useRecords } from '../../stores/useRecords';
import { useScreenDefinitions } from '../../stores/useScreenDefinitions';
import { useTenant } from '../../stores/useTenant';
import { readRecordText, resolveRecordTitle } from '../../domain/services/customFieldValues';
import { formatCurrencyBRL } from '../../utils/formatters';

export interface ReferenceOption {
  value: string;
  label: string;
  meta?: string;
}

export const useReferenceOptions = (): Record<string, ReferenceOption[]> => {
  const { persons } = usePersonStore();
  const { contracts } = useContractStore();
  const { financials } = useFinancialStore();
  const { deadlines } = useDeadlineStore();
  const { recordsByCollection } = useRecords();
  const { getDefinition } = useScreenDefinitions();
  const { members } = useTenant();

  return useMemo(() => {
    const map: Record<string, ReferenceOption[]> = {
      persons: persons
        .map((p) => ({ value: p.id, label: p.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
      members: members
        .map((m) => ({ value: m.userId, label: m.displayName }))
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
        .map((d) => ({ value: d.id, label: d.type }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    };
    // Toda coleção descrita por uma tela do escritório entra pelo mesmo caminho: o rótulo sai do
    // campo-título e o complemento do campo-subtítulo, ambos declarados na tela.
    Object.entries(recordsByCollection).forEach(([collection, records]) => {
      const definition = getDefinition(collection);
      const titleFieldKey = definition?.titleFieldKey ?? '';
      const subtitleFieldKey = definition?.subtitleFieldKey ?? '';
      map[collection] = records
        .map((r) => ({
          value: r.id,
          label: resolveRecordTitle(r, titleFieldKey),
          meta: readRecordText(r, subtitleFieldKey) || undefined,
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
    });
    return map;
  }, [persons, contracts, financials, deadlines, recordsByCollection, getDefinition, members]);
};
