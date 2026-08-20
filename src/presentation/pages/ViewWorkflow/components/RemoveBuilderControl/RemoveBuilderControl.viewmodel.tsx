import { useCallback, useMemo } from 'react';
import { useLabel } from '../../../../shared/i18n/useT';
import { useSchemaContext } from '../../../../shared/useSchemaContext';
import { ENTITY_REGISTRY_LIST } from '../../../../../domain/schema/entityRegistry';
import { LOOKUP_REGISTRY_LIST } from '../../../../../domain/schema/lookupRegistry';
import type { PathRoot } from '../../../../../domain/schema/pathResolver';
import { resolveWritableTable } from '../../../../../domain/schema/mutationSpec';
import type { RemoveStepConfig } from '../../../../../domain/schema/mutationSpec';
import type { InputMapping } from '../../../../../domain/entities/Workflow';
import type { WorkflowEventFieldOption } from '../../../../../domain/services/workflowEventCatalog';
import type { StepOutputField, WorkflowVariable } from '../../../../components/ui/ExpressionEditor/autocompleteHelpers';
import type { SearchSelectOption } from '../../../../components/ui/SearchSelect';

export interface RemoveBuilderControlProps {
  value: RemoveStepConfig | undefined;
  onChange: (config: RemoveStepConfig) => void;
  eventFields: WorkflowEventFieldOption[];
  pathRoot?: PathRoot | null;
  inputRoot?: PathRoot | null;
  stepOutputFields: StepOutputField[];
  workflowVariables: WorkflowVariable[];
}

const EMPTY_CONFIG: RemoveStepConfig = { table: '', id: { kind: 'Literal', value: '' } };

export interface RemoveBuilderControlViewModel {
  config: RemoveStepConfig;
  tableOptions: SearchSelectOption[];
  setTable: (table: string) => void;
  setId: (mapping: InputMapping) => void;
}

export const useRemoveBuilderControlViewModel = (
  value: RemoveBuilderControlProps['value'],
  onChange: RemoveBuilderControlProps['onChange'],
): RemoveBuilderControlViewModel => {
  const label = useLabel();
  const ctx = useSchemaContext();
  const config = useMemo(() => value ?? EMPTY_CONFIG, [value]);

  const tableOptions = useMemo<SearchSelectOption[]>(() => {
    const entities = ENTITY_REGISTRY_LIST.filter(
      (entity) => entity.key !== 'customRecords' && resolveWritableTable(entity.collection, ctx).ok,
    ).map((entity) => ({ value: entity.collection, label: entity.labelPlural, meta: 'Cadastro' }));
    // A CHAVE do mapa é a coleção — é ela que o motor resolve. A `id` da tela pode ser outro nome.
    const screens = [...ctx.screens.entries()].map(([collection, screen]) => ({
      value: collection,
      label: label(screen.titleSingular),
      meta: 'Personalizada',
    }));
    const lookups = LOOKUP_REGISTRY_LIST.map((lookup) => ({
      value: lookup.collection,
      label: `${lookup.screenLabel}: ${lookup.entityLabel}`,
      meta: 'Lista',
    }));
    return [...entities, ...screens, ...lookups];
  }, [ctx, label]);

  const emit = useCallback((next: RemoveStepConfig) => onChange(next), [onChange]);

  const setTable = useCallback((table: string) => emit({ ...config, table }), [emit, config]);
  const setId = useCallback((id: InputMapping) => emit({ ...config, id }), [emit, config]);

  return { config, tableOptions, setTable, setId };
};
