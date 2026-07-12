import { useMemo, useState } from 'react';
import type { FilterDef, FilterToken } from '../../components/ui/CompositeFilter';

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
    category: 'Consulta',
    signature: 'query(spec) → Promise<{ count, results, first }>',
    description:
      'Pesquisa registros de qualquer cadastro do escritório (fixo, personalizado ou lista). O escritório atual é aplicado automaticamente.',
    params: [
      { name: 'table', description: 'Cadastro a consultar (ex: "persons", "cases" ou a chave de uma tela personalizada).' },
      { name: 'where', description: 'Lista de filtros { path, op, value }. Operadores: eq, neq, lt, lte, gt, gte, in, contains, exists.' },
      { name: 'orderBy', description: 'Ordenação opcional { path, dir: "asc" | "desc" }.' },
      { name: 'limit', description: 'Máximo de registros retornados.' },
      { name: 'projections', description: 'Campos retornados (inclui campos de referências, ex: "client.name").' },
    ],
    returns: 'count (quantidade), results (lista) e first (primeiro registro ou null).',
    example: `const r = await query({\n  table: 'cases',\n  where: [{ path: 'status', op: 'eq', value: 'Ativo' }],\n  projections: ['title', 'client.name'],\n  limit: 20,\n});\nlog(r.count, r.first?.title);`,
  },
  {
    name: 'upsert',
    category: 'Gravação',
    signature: 'upsert(spec) → Promise<{ id, created, record }>',
    description:
      'Inclui ou atualiza um registro. Sem "id" inclui um novo; com "id" atualiza o existente. O escritório atual é aplicado automaticamente.',
    params: [
      { name: 'table', description: 'Cadastro a gravar (fixo, personalizado ou lista).' },
      { name: 'id', description: 'Opcional. Informe para atualizar um registro existente; omita para incluir.' },
      {
        name: 'data',
        description:
          'Campos a gravar. Em cadastros fixos, os campos ficam no topo (e customizados em "customValues"); em personalizados, dentro de "values". O título é derivado automaticamente.',
      },
    ],
    returns: 'id (do registro gravado), created (true se incluído) e record (registro gravado).',
    example: `const r = await upsert({\n  table: 'persons',\n  data: { name: 'Ana Souza', customValues: { apelido: 'Aninha' } },\n});\nlog(r.created ? 'incluída' : 'atualizada', r.id);`,
  },
  {
    name: 'remove',
    category: 'Exclusão',
    signature: 'remove(spec) → Promise<{ id, removed }>',
    description:
      'Exclui um registro pelo seu id. Exclui apenas o registro informado (sem cascata). O escritório atual é aplicado automaticamente.',
    params: [
      { name: 'table', description: 'Cadastro do registro (fixo, personalizado ou lista).' },
      { name: 'id', description: 'Id do registro a excluir.' },
    ],
    returns: 'id (informado) e removed (true se o registro existia e foi excluído).',
    example: `const achado = await query({ table: 'persons', where: [{ path: 'cpf', op: 'eq', value: input.cpf }], limit: 1 });\nif (achado.first) {\n  await remove({ table: 'persons', id: achado.first.id });\n}`,
  },
];

export interface DataFunctionReferenceViewModel {
  filterDefs: FilterDef[];
  filterTokens: FilterToken[];
  setFilterTokens: (tokens: FilterToken[]) => void;
  filteredFunctions: DataFunctionDef[];
}

export const useDataFunctionReferenceViewModel = (): DataFunctionReferenceViewModel => {
  const [filterTokens, setFilterTokens] = useState<FilterToken[]>([]);

  const categoryOptions = useMemo(
    () => Array.from(new Set(DATA_FUNCTIONS.map((fn) => fn.category))).map((cat) => ({ value: cat, label: cat })),
    [],
  );

  const filterDefs = useMemo<FilterDef[]>(
    () => [
      { key: 'search', label: 'Busca', type: 'text', placeholder: 'Nome da função...' },
      { key: 'category', label: 'Categoria', type: 'select', options: categoryOptions },
    ],
    [categoryOptions],
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
