import { useCallback, useMemo } from 'react';
import { useSchemaContext } from '../../../../shared/useSchemaContext';
import { ENTITY_REGISTRY_LIST } from '../../../../../domain/schema/entityRegistry';
import { LOOKUP_REGISTRY_LIST } from '../../../../../domain/schema/lookupRegistry';
import { resolveWritableTable } from '../../../../../domain/schema/mutationSpec';
import type { UpsertStepConfig } from '../../../../../domain/schema/mutationSpec';
import type { SearchSelectOption } from '../../../../components/ui/SearchSelect';

export interface UpsertBuilderControlProps {
  value: UpsertStepConfig | undefined;
  onChange: (config: UpsertStepConfig) => void;
}

const EMPTY_CONFIG: UpsertStepConfig = { table: '', source: 'input' };

export interface UpsertBuilderControlViewModel {
  config: UpsertStepConfig;
  tableOptions: SearchSelectOption[];
  sourceOptions: SearchSelectOption[];
  setTable: (table: string) => void;
  setSource: (source: string) => void;
  setProperty: (property: string) => void;
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

  const sourceOptions = useMemo<SearchSelectOption[]>(
    () => [
      { value: 'input', label: 'Dados dos steps anteriores', meta: 'input' },
      { value: 'event', label: 'Dados do evento', meta: 'event' },
    ],
    [],
  );

  const emit = useCallback((next: UpsertStepConfig) => onChange(next), [onChange]);

  const setTable = useCallback((table: string) => emit({ ...config, table }), [emit, config]);

  const setSource = useCallback(
    (source: string) => emit({ ...config, source: source === 'event' ? 'event' : 'input' }),
    [emit, config],
  );

  const setProperty = useCallback(
    (property: string) => emit({ ...config, property: property || undefined }),
    [emit, config],
  );

  return { config, tableOptions, sourceOptions, setTable, setSource, setProperty };
};
