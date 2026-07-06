import { useState, useMemo } from 'react';
import { EXPRESSION_FUNCTIONS } from '../../components/ui/ExpressionEditor/ExpressionEditor.viewmodel';
import type { ExpressionFunction } from '../../components/ui/ExpressionEditor/ExpressionEditor.viewmodel';
import type { FilterDef, FilterToken } from '../../components/ui/CompositeFilter';

export interface FunctionWithCategory extends ExpressionFunction {
  category: string;
}

const FUNCTIONS_WITH_CATEGORIES: FunctionWithCategory[] = [
  { ...EXPRESSION_FUNCTIONS[0], category: 'Data' },
  { ...EXPRESSION_FUNCTIONS[1], category: 'Data' },
  { ...EXPRESSION_FUNCTIONS[2], category: 'Condicional' },
  { ...EXPRESSION_FUNCTIONS[3], category: 'Texto' },
  { ...EXPRESSION_FUNCTIONS[4], category: 'Texto' },
  { ...EXPRESSION_FUNCTIONS[5], category: 'Texto' },
  { ...EXPRESSION_FUNCTIONS[6], category: 'Texto' },
  { name: '+', label: '+', signature: 'a + b', description: 'Soma números ou adiciona dias a uma data', example: 'today() + 5', category: 'Operador' },
  { name: '-', label: '-', signature: 'a - b', description: 'Subtrai números ou remove dias de uma data', example: 'today() - 3', category: 'Operador' },
];

export interface FunctionReferenceViewModel {
  filterDefs: FilterDef[];
  filterTokens: FilterToken[];
  setFilterTokens: (tokens: FilterToken[]) => void;
  filteredFunctions: FunctionWithCategory[];
}

export const useFunctionReferenceViewModel = (): FunctionReferenceViewModel => {
  const [filterTokens, setFilterTokens] = useState<FilterToken[]>([]);

  const categoryOptions = useMemo(() => {
    const categories = Array.from(new Set(FUNCTIONS_WITH_CATEGORIES.map((fn) => fn.category)));
    return categories.map((cat) => ({ value: cat, label: cat }));
  }, []);

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

    return FUNCTIONS_WITH_CATEGORIES.filter((fn) => {
      if (searchQ && !fn.name.toLowerCase().includes(searchQ) && !fn.description.toLowerCase().includes(searchQ)) {
        return false;
      }
      if (categoryFilter.length > 0 && !categoryFilter.includes(fn.category)) {
        return false;
      }
      return true;
    });
  }, [tokenMap]);

  return {
    filterDefs,
    filterTokens,
    setFilterTokens,
    filteredFunctions,
  };
};
