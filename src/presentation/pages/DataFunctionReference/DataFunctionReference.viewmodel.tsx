import { useMemo, useState } from 'react';
import type { FilterDef, FilterToken } from '../../components/ui/CompositeFilter';

import { useT, useLabel } from '../../shared/i18n/useT';
export interface DataFunctionParam {
  name: string;
  description: string;
}

export interface DataFunctionDef {
  name: string;
  category: string;
  signature: string;
  description: string;
  params: DataFunctionParam[];
  returns: string;
  example: string;
}

export const DATA_FUNCTIONS: DataFunctionDef[] = [
  {
    name: 'query',
    category: '@core.automation/data-fn.category.query',
    signature: 'query(spec) → Promise<{ count, results, first }>',
    description:
      '@core.automation/data-fn.query.description',
    params: [
      { name: 'table', description: '@core.automation/data-fn.query.table' },
      { name: 'where', description: '@core.automation/data-fn.query.where' },
      { name: 'orderBy', description: '@core.automation/data-fn.query.order-by' },
      { name: 'limit', description: '@core.automation/data-fn.query.limit' },
      { name: 'projections', description: '@core.automation/data-fn.query.projections' },
    ],
    returns: '@core.automation/data-fn.query.returns',
    example: `const r = await query({\n  table: 'news',\n  where: [{ path: 'category', op: 'eq', value: input.category }],\n  projections: ['title', 'summary'],\n  limit: 20,\n});\nlog(r.count, r.first?.title);`,
  },
  {
    name: 'upsert',
    category: '@core.automation/data-fn.category.write',
    signature: 'upsert(spec) → Promise<{ id, created, record }>',
    description:
      '@core.automation/data-fn.upsert.description',
    params: [
      { name: 'table', description: '@core.automation/data-fn.upsert.table' },
      { name: 'id', description: '@core.automation/data-fn.upsert.id' },
      {
        name: 'data',
        description:
          '@core.automation/data-fn.upsert.data',
      },
      { name: 'matchPrimaryKey', description: '@core.automation/data-fn.upsert.match-primary-key' },
    ],
    returns: '@core.automation/data-fn.upsert.returns',
    example: `const r = await upsert({\n  table: 'news',\n  data: { title: input.title, summary: input.summary },\n});\nlog(r.created, r.id);`,
  },
  {
    name: 'remove',
    category: '@core.automation/data-fn.category.delete',
    signature: 'remove(spec) → Promise<{ id, removed }>',
    description:
      '@core.automation/data-fn.remove.description',
    params: [
      { name: 'table', description: '@core.automation/data-fn.remove.table' },
      { name: 'id', description: '@core.automation/data-fn.remove.id' },
    ],
    returns: '@core.automation/data-fn.remove.returns',
    example: `const found = await query({ table: 'news', where: [{ path: 'sourceURL', op: 'eq', value: input.sourceURL }], limit: 1 });\nif (found.first) {\n  await remove({ table: 'news', id: found.first.id });\n}`,
  },
];

export interface DataFunctionReferenceViewModel {
  filterDefs: FilterDef[];
  filterTokens: FilterToken[];
  setFilterTokens: (tokens: FilterToken[]) => void;
  filteredFunctions: DataFunctionDef[];
}

export const useDataFunctionReferenceViewModel = (): DataFunctionReferenceViewModel => {
  const t = useT('core.automation');
  const label = useLabel();
  const [filterTokens, setFilterTokens] = useState<FilterToken[]>([]);

  const categoryOptions = useMemo(
    () => Array.from(new Set(DATA_FUNCTIONS.map((fn) => fn.category)))
      .map((category) => ({ value: category, label: label(category) })),
    [label],
  );

  const filterDefs = useMemo<FilterDef[]>(
    () => [
      {
        key: 'search',
        label: t('core.ui/filter.search'),
        type: 'text',
        placeholder: t('functions.filter.search.placeholder'),
      },
      { key: 'category', label: t('core.ui/filter.category'), type: 'select', options: categoryOptions },
    ],
    [categoryOptions, t],
  );

  const tokenMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    filterTokens.forEach((token) => {
      map[token.key] = token.values;
    });
    return map;
  }, [filterTokens]);

  const filteredFunctions = useMemo(() => {
    const searchQ = (tokenMap['search']?.[0] ?? '').toLowerCase();
    const categoryFilter = tokenMap['category'] ?? [];
    return DATA_FUNCTIONS.filter((fn) => {
      if (searchQ && !fn.name.toLowerCase().includes(searchQ) && !fn.description.toLowerCase().includes(searchQ)) {
        return false;
      }
      if (categoryFilter.length > 0 && !categoryFilter.includes(fn.category)) return false;
      return true;
    });
  }, [tokenMap]);

  return { filterDefs, filterTokens, setFilterTokens, filteredFunctions };
};
