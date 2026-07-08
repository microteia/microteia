import { useState, useCallback, useMemo } from 'react';
import type { Condition, FieldComparisonCondition } from '../../../../domain/entities/Workflow';
import { getWorkflowEventFields } from '../../../../domain/services/workflowEventCatalog';
import type { SearchSelectOption } from '../SearchSelect';
import { useScreenDefinitions } from '../../../../stores/useScreenDefinitions';
import { sortFieldsByOrder } from '../../../../domain/services/customFieldValues';

export type ConditionMode = 'always' | 'custom';

export interface ConditionBuilderViewModel {
  mode: ConditionMode;
  setMode: (mode: ConditionMode) => void;
  
  // Para FieldComparison simples (MVP)
  fieldPath: string;
  setFieldPath: (path: string) => void;
  operator: FieldComparisonCondition['operator'];
  setOperator: (op: FieldComparisonCondition['operator']) => void;
  value: string;
  setValue: (val: string) => void;
  valueType: FieldComparisonCondition['valueType'];
  setValueType: (type: FieldComparisonCondition['valueType']) => void;
  
  // Opções disponíveis
  fieldOptions: SearchSelectOption[];
  operatorOptions: SearchSelectOption[];
  
  // Múltiplas condições (AND)
  conditions: FieldComparisonCondition[];
  addCondition: () => void;
  removeCondition: (index: number) => void;
  updateCondition: (index: number, updates: Partial<FieldComparisonCondition>) => void;
}

const OPERATOR_OPTIONS: SearchSelectOption[] = [
  { value: '==', label: 'é igual a' },
  { value: '!=', label: 'é diferente de' },
  { value: '>', label: 'é maior que' },
  { value: '>=', label: 'é maior ou igual a' },
  { value: '<', label: 'é menor que' },
  { value: '<=', label: 'é menor ou igual a' },
  { value: 'contains', label: 'contém' },
  { value: 'startsWith', label: 'começa com' },
  { value: 'endsWith', label: 'termina com' },
  { value: 'isEmpty', label: 'está vazio' },
  { value: 'isNotEmpty', label: 'não está vazio' },
];

export const useConditionBuilderViewModel = (
  value: Condition,
  onChange: (condition: Condition) => void,
  eventName: string,
  screenKey?: string,
): ConditionBuilderViewModel => {
  const { dynamicScreens } = useScreenDefinitions();

  // Determina o modo inicial
  const initialMode: ConditionMode = value.kind === 'AlwaysTrue' ? 'always' : 'custom';
  const [mode, setModeState] = useState<ConditionMode>(initialMode);

  // Estado para condições múltiplas (AND)
  const initialConditions: FieldComparisonCondition[] = useMemo(() => {
    if (value.kind === 'LogicalAnd') {
      return value.conditions.filter((c): c is FieldComparisonCondition => c.kind === 'FieldComparison');
    }
    if (value.kind === 'FieldComparison') {
      return [value];
    }
    // Padrão: uma condição vazia
    return [{
      kind: 'FieldComparison',
      fieldPath: '',
      operator: '==',
      value: '',
      valueType: 'literal',
    }];
  }, [value]);

  const [conditions, setConditions] = useState<FieldComparisonCondition[]>(initialConditions);

  // Para edição rápida (MVP: apenas uma condição)
  const currentCondition = conditions[0];
  const [fieldPath, setFieldPath] = useState(currentCondition?.fieldPath ?? '');
  const [operator, setOperator] = useState<FieldComparisonCondition['operator']>(currentCondition?.operator ?? '==');
  const [valueInput, setValue] = useState(String(currentCondition?.value ?? ''));
  const [valueType, setValueType] = useState<FieldComparisonCondition['valueType']>(currentCondition?.valueType ?? 'literal');

  // Opções de campos disponíveis do evento
  const fieldOptions = useMemo((): SearchSelectOption[] => {
    // Campos dinâmicos se for custom_record e screenKey definido
    let dynamicFields: { key: string; label: string }[] = [];
    if (eventName.startsWith('custom_record.') && screenKey) {
      const definition = dynamicScreens.find((s) => s.id === screenKey);
      if (definition) {
        const sorted = sortFieldsByOrder(definition.fields);
        dynamicFields = sorted.map((f) => ({ key: f.key, label: f.label }));
      }
    }

    const catalogFields = getWorkflowEventFields(eventName, dynamicFields);
    
    // Adiciona prefixo "event.payload." para facilitar
    return catalogFields.map((f) => ({
      value: `event.payload.${f.path}`,
      label: f.label,
    }));
  }, [eventName, screenKey, dynamicScreens]);

  const setMode = useCallback((newMode: ConditionMode) => {
    setModeState(newMode);
    if (newMode === 'always') {
      onChange({ kind: 'AlwaysTrue' });
    } else {
      // Ao trocar para custom, cria uma condição padrão
      const defaultCondition: FieldComparisonCondition = {
        kind: 'FieldComparison',
        fieldPath: '',
        operator: '==',
        value: '',
        valueType: 'literal',
      };
      onChange(defaultCondition);
      setConditions([defaultCondition]);
    }
  }, [onChange]);

  // Atualiza a condição ao editar
  const syncCondition = useCallback(() => {
    const newCondition: FieldComparisonCondition = {
      kind: 'FieldComparison',
      fieldPath,
      operator,
      value: valueInput,
      valueType,
    };

    if (conditions.length === 1) {
      onChange(newCondition);
    } else {
      // Múltiplas condições: cria LogicalAnd
      const updated = [...conditions];
      updated[0] = newCondition;
      onChange({
        kind: 'LogicalAnd',
        conditions: updated,
      });
    }
  }, [fieldPath, operator, valueInput, valueType, conditions, onChange]);

  const handleFieldPathChange = useCallback((path: string) => {
    setFieldPath(path);
    syncCondition();
  }, [syncCondition]);

  const handleOperatorChange = useCallback((op: FieldComparisonCondition['operator']) => {
    setOperator(op);
    syncCondition();
  }, [syncCondition]);

  const handleValueChange = useCallback((val: string) => {
    setValue(val);
    syncCondition();
  }, [syncCondition]);

  const handleValueTypeChange = useCallback((type: FieldComparisonCondition['valueType']) => {
    setValueType(type);
    syncCondition();
  }, [syncCondition]);

  const addCondition = useCallback(() => {
    const newCondition: FieldComparisonCondition = {
      kind: 'FieldComparison',
      fieldPath: '',
      operator: '==',
      value: '',
      valueType: 'literal',
    };
    const updated = [...conditions, newCondition];
    setConditions(updated);
    onChange({
      kind: 'LogicalAnd',
      conditions: updated,
    });
  }, [conditions, onChange]);

  const removeCondition = useCallback((index: number) => {
    const updated = conditions.filter((_, i) => i !== index);
    setConditions(updated);
    if (updated.length === 1) {
      onChange(updated[0]);
    } else if (updated.length > 1) {
      onChange({
        kind: 'LogicalAnd',
        conditions: updated,
      });
    } else {
      // Se remover todas, volta para AlwaysTrue
      onChange({ kind: 'AlwaysTrue' });
      setModeState('always');
    }
  }, [conditions, onChange]);

  const updateCondition = useCallback((index: number, updates: Partial<FieldComparisonCondition>) => {
    const updated = [...conditions];
    updated[index] = { ...updated[index], ...updates };
    setConditions(updated);
    
    if (updated.length === 1) {
      onChange(updated[0]);
    } else {
      onChange({
        kind: 'LogicalAnd',
        conditions: updated,
      });
    }
  }, [conditions, onChange]);

  return {
    mode,
    setMode,
    fieldPath,
    setFieldPath: handleFieldPathChange,
    operator,
    setOperator: handleOperatorChange,
    value: valueInput,
    setValue: handleValueChange,
    valueType,
    setValueType: handleValueTypeChange,
    fieldOptions,
    operatorOptions: OPERATOR_OPTIONS,
    conditions,
    addCondition,
    removeCondition,
    updateCondition,
  };
};
