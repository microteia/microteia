import { useCallback, useMemo } from 'react';
import { useSchemaContext } from '../../../../shared/useSchemaContext';
import { ENTITY_REGISTRY_LIST } from '../../../../../domain/schema/entityRegistry';
import { resolveWritableTable } from '../../../../../domain/schema/mutationSpec';
import type { PathRoot } from '../../../../../domain/schema/pathResolver';
import type { MapFieldMapping, MapStepConfig } from '../../../../../domain/schema/mapSpec';
import type { WorkflowEventFieldOption } from '../../../../../domain/services/workflowEventCatalog';
import type { StepOutputField, WorkflowVariable } from '../../../../components/ui/ExpressionEditor/autocompleteHelpers';
import type { SearchSelectOption } from '../../../../components/ui/SearchSelect';

export interface MapBuilderControlProps {
  value: MapStepConfig | undefined;
  onChange: (config: MapStepConfig) => void;
  eventFields: WorkflowEventFieldOption[];
  pathRoot?: PathRoot | null;
  inputRoot?: PathRoot | null;
  stepOutputFields: StepOutputField[];
  workflowVariables: WorkflowVariable[];
  priorStepOptions: SearchSelectOption[];
  getStepOutputs: (stepId: string) => { value: string; label: string }[];
}

const EMPTY_CONFIG: MapStepConfig = { name: '', fields: [] };

export interface MapBuilderControlViewModel {
  config: MapStepConfig;
  typeOptions: SearchSelectOption[];
  setName: (name: string) => void;
  setType: (type: string) => void;
  addField: () => void;
  updateField: (index: number, field: MapFieldMapping) => void;
  removeField: (index: number) => void;
}

export const useMapBuilderControlViewModel = (
  value: MapBuilderControlProps['value'],
  onChange: MapBuilderControlProps['onChange'],
): MapBuilderControlViewModel => {
  const ctx = useSchemaContext();
  const config = useMemo(() => value ?? EMPTY_CONFIG, [value]);

  const typeOptions = useMemo<SearchSelectOption[]>(() => {
    const entities = ENTITY_REGISTRY_LIST.filter(
      (entity) => entity.key !== 'customRecords' && resolveWritableTable(entity.collection, ctx).ok,
    ).map((entity) => ({ value: entity.collection, label: entity.labelPlural, meta: 'Cadastro' }));
    const screens = [...ctx.screens.values()].map((screen) => ({
      value: screen.id,
      label: screen.titleSingular,
      meta: 'Personalizada',
    }));
    return [...entities, ...screens];
  }, [ctx]);

  const emit = useCallback((next: MapStepConfig) => onChange(next), [onChange]);

  const setName = useCallback((name: string) => emit({ ...config, name }), [emit, config]);

  const setType = useCallback((type: string) => emit({ ...config, type: type || undefined }), [emit, config]);

  const addField = useCallback(() => {
    const field: MapFieldMapping = { name: '', value: { kind: 'Literal', value: '' } };
    emit({ ...config, fields: [...config.fields, field] });
  }, [emit, config]);

  const updateField = useCallback(
    (index: number, field: MapFieldMapping) =>
      emit({ ...config, fields: config.fields.map((item, i) => (i === index ? field : item)) }),
    [emit, config],
  );

  const removeField = useCallback(
    (index: number) => emit({ ...config, fields: config.fields.filter((_, i) => i !== index) }),
    [emit, config],
  );

  return { config, typeOptions, setName, setType, addField, updateField, removeField };
};
