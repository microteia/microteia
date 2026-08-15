import { useCallback, useMemo } from 'react';
import { useSchemaContext } from '../../../../shared/useSchemaContext';
import { ENTITY_REGISTRY_LIST } from '../../../../../domain/schema/entityRegistry';
import { LOOKUP_REGISTRY_LIST } from '../../../../../domain/schema/lookupRegistry';
import { resolveWritableTable } from '../../../../../domain/schema/mutationSpec';
import type { UpsertStepConfig } from '../../../../../domain/schema/mutationSpec';
import type { SearchSelectOption } from '../../../../components/ui/SearchSelect';

import { useT } from '../../../../shared/i18n/useT';

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
  const t = useT('core.automation');
  const ctx = useSchemaContext();
  const config = useMemo(() => value ?? EMPTY_CONFIG, [value]);

  const tableOptions = useMemo<SearchSelectOption[]>(() => {
    const entities = ENTITY_REGISTRY_LIST.filter(
      (entity) => entity.key !== 'customRecords' && resolveWritableTable(entity.collection, ctx).ok,
    ).map((entity) => ({ value: entity.collection, label: entity.labelPlural, meta: 'Cadastro' }));
    // A CHAVE do mapa é a coleção — é ela que o motor resolve. A `id` da tela pode ser outro nome.
    const screens = [...ctx.screens.entries()].map(([collection, screen]) => ({
      value: collection,
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
      { value: 'input', label: t('upsert.source.output'), meta: 'input' },
      { value: 'event', label: t('upsert.source.event'), meta: 'event' },
    ],
    [t],
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
