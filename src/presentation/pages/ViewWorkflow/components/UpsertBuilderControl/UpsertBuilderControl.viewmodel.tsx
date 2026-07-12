import { useCallback, useMemo } from 'react';
import { useSchemaContext } from '../../../../shared/useSchemaContext';
import { ENTITY_REGISTRY, ENTITY_REGISTRY_LIST } from '../../../../../domain/schema/entityRegistry';
import { LOOKUP_REGISTRY_LIST } from '../../../../../domain/schema/lookupRegistry';
import { parsePath, suggestNextSegments } from '../../../../../domain/schema/pathResolver';
import type { PathRoot, SchemaContext } from '../../../../../domain/schema/pathResolver';
import { resolveWritableTable, validateWritablePath } from '../../../../../domain/schema/mutationSpec';
import type { UpsertFieldMapping, UpsertStepConfig } from '../../../../../domain/schema/mutationSpec';
import type { InputMapping } from '../../../../../domain/entities/Workflow';
import type { WorkflowEventFieldOption } from '../../../../../domain/services/workflowEventCatalog';
import type { StepOutputField, WorkflowVariable } from '../../../../components/ui/ExpressionEditor/autocompleteHelpers';
import type { SearchSelectOption } from '../../../../components/ui/SearchSelect';

export interface UpsertBuilderControlProps {
  value: UpsertStepConfig | undefined;
  onChange: (config: UpsertStepConfig) => void;
  eventFields: WorkflowEventFieldOption[];
  pathRoot?: PathRoot | null;
  inputRoot?: PathRoot | null;
  stepOutputFields: StepOutputField[];
  workflowVariables: WorkflowVariable[];
}

const MAX_PATH_DEPTH = 3;

const EMPTY_CONFIG: UpsertStepConfig = { table: '', fields: [] };

const LOOKUP_FIELD_OPTIONS: SearchSelectOption[] = [
  { value: 'key', label: 'key', meta: 'Chave' },
  { value: 'label', label: 'label', meta: 'Rótulo' },
  { value: 'color', label: 'color', meta: 'Cor' },
];

const collectWritablePaths = (ctx: SchemaContext, table: string, root: PathRoot): SearchSelectOption[] => {
  const options: SearchSelectOption[] = [];
  const seen = new Set<string>();

  const walk = (prefix: string, depth: number): void => {
    for (const suggestion of suggestNextSegments(ctx, root, parsePath(prefix))) {
      if (suggestion.kind === 'index') continue;
      const path = prefix ? `${prefix}.${suggestion.insertText}` : suggestion.insertText;
      if (suggestion.kind !== 'special' && !seen.has(path) && !validateWritablePath(ctx, table, path)) {
        seen.add(path);
        options.push({ value: path, label: path, meta: suggestion.detail ?? suggestion.label });
      }
      if (!suggestion.isLeaf && depth < MAX_PATH_DEPTH) walk(path, depth + 1);
    }
  };

  walk('', 0);
  return options;
};

export interface UpsertBuilderControlViewModel {
  config: UpsertStepConfig;
  tableOptions: SearchSelectOption[];
  pathOptions: SearchSelectOption[];
  issuesByPath: Record<number, string>;
  setTable: (table: string) => void;
  setId: (mapping: InputMapping | undefined) => void;
  addField: () => void;
  updateField: (index: number, field: UpsertFieldMapping) => void;
  removeField: (index: number) => void;
}

export const useUpsertBuilderControlViewModel = (
  value: UpsertBuilderControlProps['value'],
  onChange: UpsertBuilderControlProps['onChange'],
): UpsertBuilderControlViewModel => {
  const ctx = useSchemaContext();
  const config = useMemo(() => value ?? EMPTY_CONFIG, [value]);

  const tableOptions = useMemo<SearchSelectOption[]>(() => {
    const entities = ENTITY_REGISTRY_LIST.filter(
      (entity) => entity.key !== 'customRecords' && resolveWritableTable(entity.collection, ctx).ok,
    ).map((entity) => ({ value: entity.collection, label: entity.labelPlural, meta: 'Cadastro' }));
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
    if (!config.table) return [];
    const outcome = resolveWritableTable(config.table, ctx);
    if (!outcome.ok) return [];
    const resolved = outcome.value;
    if (resolved.kind === 'lookup') return LOOKUP_FIELD_OPTIONS;

    const options = collectWritablePaths(ctx, config.table, resolved.root);
    if (resolved.kind === 'entity' && resolved.entityKey) {
      const known = new Set(options.map((option) => option.value));
      for (const fk of ENTITY_REGISTRY[resolved.entityKey].fks) {
        if (!known.has(fk.key)) options.push({ value: fk.key, label: fk.key, meta: fk.label });
      }
    }
    return options;
  }, [ctx, config.table]);

  const issuesByPath = useMemo<Record<number, string>>(() => {
    if (!config.table) return {};
    const map: Record<number, string> = {};
    config.fields.forEach((field, index) => {
      const error = field.path ? validateWritablePath(ctx, config.table, field.path) : undefined;
      if (error) map[index] = error;
    });
    return map;
  }, [ctx, config]);

  const emit = useCallback((next: UpsertStepConfig) => onChange(next), [onChange]);

  const setTable = useCallback((table: string) => emit({ table, fields: [], id: config.id }), [emit, config.id]);

  const setId = useCallback(
    (mapping: InputMapping | undefined) => {
      const next: UpsertStepConfig = { ...config };
      if (mapping) next.id = mapping;
      else delete next.id;
      emit(next);
    },
    [emit, config],
  );

  const addField = useCallback(() => {
    const field: UpsertFieldMapping = { path: '', value: { kind: 'Literal', value: '' } };
    emit({ ...config, fields: [...config.fields, field] });
  }, [emit, config]);

  const updateField = useCallback(
    (index: number, field: UpsertFieldMapping) =>
      emit({ ...config, fields: config.fields.map((item, i) => (i === index ? field : item)) }),
    [emit, config],
  );

  const removeField = useCallback(
    (index: number) => emit({ ...config, fields: config.fields.filter((_, i) => i !== index) }),
    [emit, config],
  );

  return {
    config,
    tableOptions,
    pathOptions,
    issuesByPath,
    setTable,
    setId,
    addField,
    updateField,
    removeField,
  };
};
