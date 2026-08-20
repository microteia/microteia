import { useCallback } from 'react';
import { format } from 'date-fns';
import { fileNameFromUrl, readValueByPath } from '../../domain/services/customFieldValues';
import { useReferenceOptions } from '../hooks/useReferenceOptions';
import { formatCurrencyBRL } from '../../utils/formatters';
import type { DerivedListRow } from './deriveEntitySchema';

/** Formata o valor conforme o controle declarado no registry (moeda, data, lista…). */
export const formatListValue = (raw: unknown, type: DerivedListRow['type']): string => {
  if (raw === null || raw === undefined || raw === '') return '';
  if (type === 'currency') return typeof raw === 'number' ? formatCurrencyBRL(raw) : '';
  // Uma linha de card com a URL crua seriam duzentos caracteres de bucket e token; o nome é o que
  // alguém lê.
  if (type === 'file') return fileNameFromUrl(String(raw));
  if (raw instanceof Date) return format(raw, 'dd/MM/yyyy');
  if (Array.isArray(raw)) return raw.map((item) => String(item)).join(' · ');
  return String(raw);
};

/**
 * Resolve o valor de uma linha do card a partir do registro. Relações guardam o ID, então são
 * traduzidas para o rótulo pelo mesmo `useReferenceOptions` que alimenta os campos `reference`
 * do formulário — mantendo card e formulário coerentes com a mesma fonte.
 */
export const useListRowResolver = (): ((record: Record<string, unknown>, row: DerivedListRow) => string) => {
  const referenceOptions = useReferenceOptions();

  return useCallback((record, row) => {
    // A chave da linha é um caminho: um campo dentro de um objeto declarado (`address.city`) chega
    // aqui pontilhado, como `deriveListRows` o monta.
    const raw = readValueByPath(record, row.key);
    if (row.type === 'reference' && row.refEntity) {
      const options = referenceOptions[row.refEntity] ?? [];
      const labelOf = (id: unknown) => options.find((option) => option.value === id)?.label ?? '';
      if (Array.isArray(raw)) return raw.map(labelOf).filter(Boolean).join(' · ');
      return labelOf(raw);
    }
    return formatListValue(raw, row.type);
  }, [referenceOptions]);
};
