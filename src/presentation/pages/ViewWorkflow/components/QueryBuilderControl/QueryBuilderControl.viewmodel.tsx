import { useCallback, useMemo } from 'react';
import { useSchemaContext } from '../../../../shared/useSchemaContext';
import { ENTITY_REGISTRY_LIST } from '../../../../../domain/schema/entityRegistry';
import { LOOKUP_REGISTRY_LIST } from '../../../../../domain/schema/lookupRegistry';
import { parsePath, suggestNextSegments } from '../../../../../domain/schema/pathResolver';
import type { PathRoot, SchemaContext } from '../../../../../domain/schema/pathResolver';
import {
  QUERY_OPERATORS_WITHOUT_VALUE,
  resolveQueryTable,
  validateQuerySpec,
} from '../../../../../domain/schema/querySpec';
import type { QueryOperator, QueryOrderBy, QueryPredicate, QuerySpec } from '../../../../../domain/schema/querySpec';
import type { InputMapping } from '../../../../../domain/entities/Workflow';
import type { WorkflowEventFieldOption } from '../../../../../domain/services/workflowEventCatalog';
import type { StepOutputField, WorkflowVariable } from '../../../../components/ui/ExpressionEditor/autocompleteHelpers';
import type { SearchSelectOption } from '../../../../components/ui/SearchSelect';

export interface QueryBuilderControlProps {
  value: QuerySpec | undefined;
  onChange: (spec: QuerySpec) => void;
  eventFields: WorkflowEventFieldOption[];
  pathRoot?: PathRoot | null;
  inputRoot?: PathRoot | null;
  stepOutputFields: StepOutputField[];
  workflowVariables: WorkflowVariable[];
}

export interface OperatorOption {
  value: QueryOperator;
  label: string;
}

const DEFAULT_LIMIT = 20;
const MAX_PATH_DEPTH = 3;

export const OPERATOR_OPTIONS: OperatorOption[] = [
  { value: 'eq', label: 'igual a' },
  { value: 'neq', label: 'diferente de' },
  { value: 'lt', label: 'menor que' },
  { value: 'lte', label: 'menor ou igual a' },
  { value: 'gt', label: 'maior que' },
  { value: 'gte', label: 'maior ou igual a' },
  { value: 'in', label: 'está na lista' },
  { value: 'contains', label: 'contém' },
  { value: 'exists', label: 'está preenchido' },
];

export const operatorNeedsValue = (op: QueryOperator): boolean => !QUERY_OPERATORS_WITHOUT_VALUE.includes(op);

/**
 * As origens que o valor de um filtro aceita NESTA tela. O motor resolve as cinco variantes de
 * `InputMapping`, mas só estas duas têm controle aqui — e uma consulta gravada com outra abriria
 * mostrando "Valor fixo" vazio, perdendo o filtro no primeiro toque. Exportada para que quem
 * DECLARA uma consulta (uma extensão, um pacote) possa ser conferido contra o que a autoria lê.
 */
export const QUERY_VALUE_MAPPING_KINDS = ['Literal', 'Expression'] as const;

export const QUERY_VALUE_KIND_OPTIONS: SearchSelectOption[] = [
  { value: 'Literal', label: 'Valor fixo' },
  { value: 'Expression', label: 'Expressão' },
];

const EMPTY_SPEC: QuerySpec = { table: '', where: [], orderBy: [], limit: DEFAULT_LIMIT, projections: [] };

const collectPaths = (ctx: SchemaContext, root: PathRoot): SearchSelectOption[] => {
  const options: SearchSelectOption[] = [];
  const seen = new Set<string>();

  const walk = (prefix: string, depth: number): void => {
    const suggestions = suggestNextSegments(ctx, root, parsePath(prefix));
    for (const suggestion of suggestions) {
      if (suggestion.kind === 'index' || suggestion.kind === 'special') continue;
      const path = prefix ? `${prefix}.${suggestion.insertText}` : suggestion.insertText;
      if (!seen.has(path)) {
        seen.add(path);
        options.push({ value: path, label: path, meta: suggestion.detail ?? suggestion.label });
      }
      if (!suggestion.isLeaf && depth < MAX_PATH_DEPTH) walk(path, depth + 1);
    }
  };

  walk('', 0);
  return options;
};

export interface QueryBuilderControlViewModel {
  spec: QuerySpec;
  tableOptions: SearchSelectOption[];
  pathOptions: SearchSelectOption[];
  operatorOptions: OperatorOption[];
  issuesByField: Record<string, string>;
  setTable: (table: string) => void;
  addFilter: () => void;
  updateFilter: (index: number, predicate: QueryPredicate) => void;
  removeFilter: (index: number) => void;
  setProjections: (paths: string[]) => void;
  addOrderBy: () => void;
  updateOrderBy: (index: number, order: QueryOrderBy) => void;
  removeOrderBy: (index: number) => void;
  setLimit: (limit: number) => void;
}

export const useQueryBuilderControlViewModel = (
  value: QueryBuilderControlProps['value'],
  onChange: QueryBuilderControlProps['onChange'],
): QueryBuilderControlViewModel => {
  const ctx = useSchemaContext();
  const spec = useMemo(() => value ?? EMPTY_SPEC, [value]);

  const tableOptions = useMemo<SearchSelectOption[]>(() => {
    const entities = ENTITY_REGISTRY_LIST.filter((entity) => entity.key !== 'customRecords').map((entity) => ({
      value: entity.collection,
      label: entity.labelPlural,
      meta: 'Cadastro',
    }));
    const screens = [...ctx.screens.values()].map((screen) => ({
      value: screen.id,
      label: screen.titleSingular,
      meta: 'Personalizada',
    }));
    const lookups = LOOKUP_REGISTRY_LIST.map((lookup) => ({
      value: lookup.collection,
      label: `${lookup.screenLabel}: ${lookup.entityLabel}`,
      meta: 'Lista',
    }));
    return [...entities, ...screens, ...lookups];
  }, [ctx]);

  const pathOptions = useMemo<SearchSelectOption[]>(() => {
    const resolved = spec.table ? resolveQueryTable(spec.table, ctx) : null;
    return resolved ? collectPaths(ctx, resolved.root) : [];
  }, [ctx, spec.table]);

  const issuesByField = useMemo<Record<string, string>>(() => {
    if (!spec.table) return {};
    const map: Record<string, string> = {};
    for (const issue of validateQuerySpec(spec, ctx)) map[issue.field] = issue.error;
    return map;
  }, [ctx, spec]);

  const emit = useCallback((next: QuerySpec) => onChange(next), [onChange]);

  const setTable = useCallback(
    (table: string) => emit({ ...spec, table, where: [], orderBy: [], projections: [] }),
    [emit, spec],
  );

  const addFilter = useCallback(() => {
    const predicate: QueryPredicate = { path: '', op: 'eq', value: { kind: 'Literal', value: '' } as InputMapping };
    emit({ ...spec, where: [...spec.where, predicate] });
  }, [emit, spec]);

  const updateFilter = useCallback(
    (index: number, predicate: QueryPredicate) =>
      emit({ ...spec, where: spec.where.map((item, i) => (i === index ? predicate : item)) }),
    [emit, spec],
  );

  const removeFilter = useCallback(
    (index: number) => emit({ ...spec, where: spec.where.filter((_, i) => i !== index) }),
    [emit, spec],
  );

  const setProjections = useCallback((paths: string[]) => emit({ ...spec, projections: paths }), [emit, spec]);

  const addOrderBy = useCallback(() => {
    const order: QueryOrderBy = { path: '', dir: 'asc' };
    emit({ ...spec, orderBy: [...(spec.orderBy ?? []), order] });
  }, [emit, spec]);

  const updateOrderBy = useCallback(
    (index: number, order: QueryOrderBy) =>
      emit({ ...spec, orderBy: (spec.orderBy ?? []).map((item, i) => (i === index ? order : item)) }),
    [emit, spec],
  );

  const removeOrderBy = useCallback(
    (index: number) => emit({ ...spec, orderBy: (spec.orderBy ?? []).filter((_, i) => i !== index) }),
    [emit, spec],
  );

  const setLimit = useCallback(
    (limit: number) => emit({ ...spec, limit: Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_LIMIT }),
    [emit, spec],
  );

  return {
    spec,
    tableOptions,
    pathOptions,
    operatorOptions: OPERATOR_OPTIONS,
    issuesByField,
    setTable,
    addFilter,
    updateFilter,
    removeFilter,
    setProjections,
    addOrderBy,
    updateOrderBy,
    removeOrderBy,
    setLimit,
  };
};
