import { useCallback, useMemo } from 'react';
import { useSchemaContext } from '../../../../shared/useSchemaContext';
import { useLookupCollectionOptions } from '../../../../shared/useParameterOptions';
import { ENTITY_REGISTRY_LIST } from '../../../../../domain/schema/entityRegistry';
import { PARAMETER_TYPE_VALUES, cloneParameterInList, siblingParameterErrors } from '../../../../../domain/schema/workflowParameters';
import type { ValidateStepConfig } from '../../../../../domain/schema/validateSpec';
import type { WorkflowParameter, WorkflowParameterType } from '../../../../../domain/entities/Workflow';
import type { SearchSelectOption } from '../../../../components/ui/SearchSelect';

import { useT } from '../../../../shared/i18n/useT';

export interface ValidateBuilderControlProps {
  value: ValidateStepConfig | undefined;
  onChange: (config: ValidateStepConfig) => void;
}

const EMPTY_CONFIG: ValidateStepConfig = { source: 'input', outputName: '' };

const PARAMETER_TYPE_KEYS: Record<WorkflowParameterType, string> = {
  String: 'parameter.type.string',
  Number: 'parameter.type.number',
  Date: 'parameter.type.date',
  Boolean: 'parameter.type.boolean-label',
  select: 'parameter.type.select',
  lookup: 'parameter.type.lookup',
  EntityReference: 'parameter.type.entity-record',
  Object: 'parameter.type.object-short',
};

export interface ValidateBuilderControlViewModel {
  config: ValidateStepConfig;
  parameters: WorkflowParameter[];
  parameterErrors: (string | undefined)[];
  sourceOptions: SearchSelectOption[];
  entityOptions: SearchSelectOption[];
  lookupOptions: SearchSelectOption[];
  typeOptions: { value: WorkflowParameterType; label: string }[];
  setSource: (source: string) => void;
  setProperty: (property: string) => void;
  setEntityType: (entityType: string) => void;
  setOutputName: (outputName: string) => void;
  addParameter: () => void;
  updateParameter: (index: number, patch: Partial<WorkflowParameter>) => void;
  removeParameter: (index: number) => void;
  cloneParameter: (index: number) => void;
}

export const useValidateBuilderControlViewModel = (
  value: ValidateBuilderControlProps['value'],
  onChange: ValidateBuilderControlProps['onChange'],
): ValidateBuilderControlViewModel => {
  const ctx = useSchemaContext();
  const t = useT('core.automation');
  const config = useMemo(() => value ?? EMPTY_CONFIG, [value]);
  const parameters = useMemo(() => config.parameters ?? [], [config.parameters]);

  const parameterErrors = useMemo(() => siblingParameterErrors(parameters), [parameters]);

  const sourceOptions = useMemo<SearchSelectOption[]>(
    () => [
      { value: 'input', label: 'Dados dos steps anteriores', meta: 'input' },
      { value: 'event', label: 'Dados do evento', meta: 'event' },
    ],
    [],
  );

  const entityOptions = useMemo<SearchSelectOption[]>(() => {
    const entities = ENTITY_REGISTRY_LIST.filter((entity) => entity.key !== 'customRecords').map((entity) => ({
      value: entity.collection,
      label: entity.labelPlural,
      meta: 'Cadastro',
    }));
    // O mapa de telas já é indexado pela COLEÇÃO — é ela que `resolveEntity` responde, e é ela que
    // o objeto validado guarda. A chave da tela aqui apontaria para uma entidade que ninguém acha.
    const named = new Set(entities.map((entity) => entity.value));
    const screens = [...ctx.screens.entries()]
      .filter(([collection]) => !named.has(collection))
      .map(([collection, screen]) => ({
        value: collection,
        label: screen.titleSingular,
        meta: t('source.custom'),
      }));
    return [{ value: '', label: t('validate.source.none') }, ...entities, ...screens];
  }, [ctx, t]);

  const lookupOptions = useLookupCollectionOptions();

  const typeOptions = useMemo<{ value: WorkflowParameterType; label: string }[]>(
    () => PARAMETER_TYPE_VALUES.map((type) => ({ value: type, label: t(PARAMETER_TYPE_KEYS[type]) })),
    [t],
  );

  const emit = useCallback((next: ValidateStepConfig) => onChange(next), [onChange]);

  const emitParameters = useCallback(
    (next: WorkflowParameter[]) => emit({ ...config, parameters: next.length > 0 ? next : undefined }),
    [emit, config],
  );

  const setSource = useCallback(
    (source: string) => emit({ ...config, source: source === 'event' ? 'event' : 'input' }),
    [emit, config],
  );

  const setProperty = useCallback(
    (property: string) => emit({ ...config, property: property || undefined }),
    [emit, config],
  );

  const setEntityType = useCallback(
    (entityType: string) => emit({ ...config, entityType: entityType || undefined }),
    [emit, config],
  );

  const setOutputName = useCallback((outputName: string) => emit({ ...config, outputName }), [emit, config]);

  const addParameter = useCallback(
    () => emitParameters([...parameters, { key: '', label: '', type: 'String' }]),
    [emitParameters, parameters],
  );

  const updateParameter = useCallback(
    (index: number, patch: Partial<WorkflowParameter>) =>
      emitParameters(parameters.map((parameter, i) => (i === index ? { ...parameter, ...patch } : parameter))),
    [emitParameters, parameters],
  );

  const removeParameter = useCallback(
    (index: number) => emitParameters(parameters.filter((_, i) => i !== index)),
    [emitParameters, parameters],
  );

  const cloneParameter = useCallback(
    (index: number) => emitParameters(cloneParameterInList(parameters, index)),
    [emitParameters, parameters],
  );

  return {
    config,
    parameters,
    parameterErrors,
    sourceOptions,
    entityOptions,
    lookupOptions,
    typeOptions,
    setSource,
    setProperty,
    setEntityType,
    setOutputName,
    addParameter,
    updateParameter,
    removeParameter,
    cloneParameter,
  };
};
