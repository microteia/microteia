import { useCallback, useMemo } from 'react';
import { useCustomFieldListing } from '../../hooks/useCustomFieldListing';
import { filterValueOf } from './reportFilterFields';
import type { ReportPathOption } from './useReportPathOptions';

/**
 * O que se LÊ de um valor de filtro gravado.
 *
 * O spec guarda a chave crua — `pending`, o id do registro apontado —, e mostrá-la é o que fazia o
 * filtro fixo aparecer na autoria como `is 9Kq2...`. Quem sabe traduzir é a mesma listagem que
 * escreve o cartão do registro: reusá-la é o que faz o relatório e a listagem dizerem a MESMA
 * palavra sobre o mesmo dado.
 */
export const useReportValueLabel = (
  options: ReportPathOption[],
): ((path: string, text: string) => string) => {
  const fields = useMemo(() => options.map((option) => option.field), [options]);
  const listing = useCustomFieldListing(fields);

  return useCallback((path, text) => {
    const field = options.find((option) => option.value === path)?.field;
    if (!field || text === '') return text;

    const shown = listing.displayValue({ [field.key]: filterValueOf(field, text) }, field);
    return shown.trim() === '' ? text : shown;
  }, [options, listing]);
};
