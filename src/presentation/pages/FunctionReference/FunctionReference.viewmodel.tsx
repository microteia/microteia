import { useState, useMemo } from 'react';
import { useExpressionFunctions } from '../../../stores/useExpressionFunctions';
import type { FilterDef, FilterToken } from '../../components/ui/CompositeFilter';

import { useT } from '../../shared/i18n/useT';
export interface FunctionReferenceViewModel {
  filterDefs: FilterDef[];
  filterTokens: FilterToken[];
  setFilterTokens: (tokens: FilterToken[]) => void;
  filteredFunctions: Array<{
    name: string;
    description: string;
    signature: string;
    example: string;
    category: string;
  }>;
  loading: boolean;
  error: string | null;
}

export const useFunctionReferenceViewModel = (): FunctionReferenceViewModel => {
  const t = useT('core.automation');
  const { functions, loading, error } = useExpressionFunctions();
  const [filterTokens, setFilterTokens] = useState<FilterToken[]>([]);

  const categoryOptions = useMemo(() => {
    const categories = Array.from(new Set(functions.map((fn) => fn.category)));
    return categories.map((cat) => ({ value: cat, label: cat }));
  }, [functions]);

  const filterDefs = useMemo<FilterDef[]>(() => [
    {
      key: 'search',
      label: t('core.ui/filter.search'),
      type: 'text',
      placeholder: t('functions.filter.search.placeholder'),
    },
    { key: 'category', label: t('core.ui/filter.category'), type: 'select', options: categoryOptions },
  ], [categoryOptions, t]);

  const tokenMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    filterTokens.forEach((token) => { map[token.key] = token.values; });
    return map;
  }, [filterTokens]);

  const filteredFunctions = useMemo(() => {
    const searchQ = (tokenMap['search']?.[0] ?? '').toLowerCase();
    const categoryFilter = tokenMap['category'] ?? [];

    return functions.filter((fn) => {
      if (searchQ && !fn.name.toLowerCase().includes(searchQ) && !fn.description.toLowerCase().includes(searchQ)) {
        return false;
      }
      if (categoryFilter.length > 0 && !categoryFilter.includes(fn.category)) {
        return false;
      }
      return true;
    });
  }, [functions, tokenMap]);

  return {
    filterDefs,
    filterTokens,
    setFilterTokens,
    filteredFunctions,
    loading,
    error,
  };
};
