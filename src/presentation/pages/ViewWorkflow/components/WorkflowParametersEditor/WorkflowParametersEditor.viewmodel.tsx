import { useState, useCallback, useMemo } from 'react';
import type { WorkflowParameter } from '../../../../../domain/entities/Workflow';
import type { FieldRulePresetOption } from '../../../../shared/useFieldRulePresets';
import {
  formatPresetOptions,
  useFieldRulePresets,
  validatePresetOptions,
} from '../../../../shared/useFieldRulePresets';

export type WorkflowParametersEditorVariant = 'input' | 'output';

export interface WorkflowParametersEditorProps {
  parameters: WorkflowParameter[];
  errors: (string | undefined)[];
  typeOptions: { value: WorkflowParameter['type']; label: string }[];
  entityOptions: { value: string; label: string }[];
  onAdd: () => void;
  onUpdate: (index: number, patch: Partial<WorkflowParameter>) => void;
  onRemove: (index: number) => void;
  onClone: (index: number) => void;
  variant?: WorkflowParametersEditorVariant;
}

export interface WorkflowParametersEditorViewModel {
  isExpanded: (index: number) => boolean;
  toggle: (index: number) => void;
  handleAdd: () => void;
  handleRemove: (index: number) => void;
  handleClone: (index: number) => void;
  summaryFor: (parameter: WorkflowParameter) => string;
  formatOptions: FieldRulePresetOption[];
  validateOptions: FieldRulePresetOption[];
}

export const useWorkflowParametersEditorViewModel = (
  props: WorkflowParametersEditorProps,
): WorkflowParametersEditorViewModel => {
  const { parameters, typeOptions, entityOptions, onAdd, onRemove, onClone } = props;
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const isExpanded = useCallback((index: number) => expanded.has(index), [expanded]);

  const toggle = useCallback((index: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const handleAdd = useCallback(() => {
    const newIndex = parameters.length;
    onAdd();
    setExpanded((prev) => new Set(prev).add(newIndex));
  }, [onAdd, parameters.length]);

  const handleRemove = useCallback((index: number) => {
    onRemove(index);
    setExpanded((prev) => {
      const next = new Set<number>();
      prev.forEach((i) => {
        if (i < index) next.add(i);
        else if (i > index) next.add(i - 1);
      });
      return next;
    });
  }, [onRemove]);

  const handleClone = useCallback((index: number) => {
    onClone(index);
    setExpanded((prev) => {
      const next = new Set<number>();
      prev.forEach((i) => {
        if (i <= index) next.add(i);
        else next.add(i + 1);
      });
      return next;
    });
  }, [onClone]);

  const summaryFor = useCallback(
    (parameter: WorkflowParameter): string => {
      const name = parameter.label.trim() || parameter.key.trim() || 'Sem nome';
      const parts = [typeOptions.find((option) => option.value === parameter.type)?.label ?? parameter.type];
      if (parameter.type === 'EntityReference' && parameter.entityType) {
        parts.push(entityOptions.find((option) => option.value === parameter.entityType)?.label ?? parameter.entityType);
      }
      if (parameter.list) parts.push('vários');
      if (parameter.required) parts.push('obrigatório');
      return `${name} — ${parts.join(' · ')}`;
    },
    [typeOptions, entityOptions],
  );

  const presets = useFieldRulePresets();

  const formatOptions = useMemo<FieldRulePresetOption[]>(
    () => [{ value: '', label: 'Nenhuma' }, ...formatPresetOptions(presets)],
    [presets],
  );

  const validateOptions = useMemo<FieldRulePresetOption[]>(
    () => [{ value: '', label: 'Nenhuma' }, ...validatePresetOptions(presets)],
    [presets],
  );

  return {
    isExpanded,
    toggle,
    handleAdd,
    handleRemove,
    handleClone,
    summaryFor,
    formatOptions,
    validateOptions,
  };
};
