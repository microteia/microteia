import { useState, useMemo } from 'react';
import { useExpressionFunctions } from '../../../../../../stores/useExpressionFunctions';
import type { FilterDef, FilterToken } from '../../../CompositeFilter';

export interface FunctionReferenceModalViewModel {
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
}

export const useFunctionReferenceModalViewModel = (): FunctionReferenceModalViewModel => {
  const { functions } = useExpressionFunctions();
  const [filterTokens, setFilterTokens] = useState<FilterToken[]>([]);

  const categoryOptions = useMemo(() => {
    const categories = Array.from(new Set(functions.map((fn) => fn.category)));
    return categories.map((cat) => ({ value: cat, label: cat }));
  }, [functions]);

  const filterDefs = useMemo<FilterDef[]>(() => [
    { key: 'search', label: 'Busca', type: 'text', placeholder: 'Nome da função...' },
    { key: 'category', label: 'Categoria', type: 'select', options: categoryOptions },
  ], [categoryOptions]);

  const tokenMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    filterTokens.forEach((t) => { map[t.key] = t.values; });
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
  };
};
