import { useCallback, useMemo } from 'react';
import { useReferenceOptions } from '../../../hooks/useReferenceOptions';
import { useLookupValues } from '../../../shared/useLookupValues';
import { parameterToInputDefinition } from '../../../shared/parameterInputs';
import type { WorkflowParameter } from '../../../../domain/entities/Workflow';
import type { InputDefinition } from '../../../../domain/entities/WorkflowStepCatalog';
import type { MultiSearchSelectOption } from '../MultiSearchSelect';

export interface ParameterFieldProps {
  parameter: WorkflowParameter;
  /** O valor SEMPRE em texto — é como o formulário guarda tudo; lista e objeto viajam como JSON. */
  value: string;
  onChange: (value: string) => void;
}

/**
 * Como o parâmetro é preenchido. `entity` e `options` delegam aos mesmos controles do Step; `multi`
 * é a versão de vários do que teria escolha fechada; `json` é o que não tem forma própria (objeto,
 * e a lista de qualquer tipo livre).
 */
export type ParameterFieldMode = 'entity' | 'options' | 'multi' | 'date' | 'boolean' | 'text' | 'json';

export interface ParameterFieldViewModel {
  mode: ParameterFieldMode;
  input: InputDefinition;
  multiOptions: MultiSearchSelectOption[];
  multiValues: string[];
  setMultiValues: (values: string[]) => void;
  numeric: boolean;
  jsonPlaceholder: string;
}

const CHOICE_TYPES: WorkflowParameter['type'][] = ['EntityReference', 'lookup', 'select'];

const parseList = (text: string): string[] => {
  const trimmed = text.trim();
  if (!trimmed) return [];
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
};

const modeOf = (parameter: WorkflowParameter): ParameterFieldMode => {
  const hasChoices = CHOICE_TYPES.includes(parameter.type);
  if (parameter.type === 'Object') return 'json';
  if (parameter.list) return hasChoices ? 'multi' : 'json';
  if (parameter.type === 'EntityReference') return 'entity';
  if (parameter.type === 'lookup' || parameter.type === 'select') return 'options';
  if (parameter.type === 'Date') return 'date';
  if (parameter.type === 'Boolean') return 'boolean';
  return 'text';
};

export const useParameterFieldViewModel = (props: ParameterFieldProps): ParameterFieldViewModel => {
  const { parameter, value, onChange } = props;
  const referenceOptionsByEntity = useReferenceOptions();
  const { getLookupOptions } = useLookupValues();

  const mode = modeOf(parameter);
  const input = useMemo(() => parameterToInputDefinition(parameter), [parameter]);

  const multiOptions = useMemo<MultiSearchSelectOption[]>(() => {
    if (parameter.type === 'EntityReference') return referenceOptionsByEntity[parameter.entityType ?? ''] ?? [];
    if (parameter.type === 'lookup') return getLookupOptions(parameter.lookupCollection ?? '');
    return parameter.options ?? [];
  }, [parameter, referenceOptionsByEntity, getLookupOptions]);

  const multiValues = useMemo(() => parseList(value), [value]);

  // Vários valores voltam a ser texto JSON na saída porque é o que o formulário transporta: quem lê
  // de volta (o "Executar" e a ação que pergunta) desserializa lista e objeto do mesmo jeito.
  const setMultiValues = useCallback(
    (values: string[]) => onChange(values.length > 0 ? JSON.stringify(values) : ''),
    [onChange],
  );

  return {
    mode,
    input,
    multiOptions,
    multiValues,
    setMultiValues,
    numeric: parameter.type === 'Number',
    jsonPlaceholder: parameter.list ? '[ ... ]' : '{ ... }',
  };
};
