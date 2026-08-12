import { useTheme } from 'styled-components';
import { resolveColor } from '../../../../shared/styles/colorUtils';
import type { InputDefinition } from '../../../../domain/entities/WorkflowStepCatalog';
import type { DynamicSelectOption } from '../DynamicSelect';
import type { SearchSelectOption } from '../SearchSelect';
import { useLookups } from '../../../../stores/useLookups';

export interface LiteralOptionsControlProps {
  input: InputDefinition;
  value: string;
  onChange: (value: string) => void;
}

export type LiteralOptionsViewModel =
  | { mode: 'static'; options: SearchSelectOption[] }
  | {
      mode: 'dynamic';
      staticOptions: DynamicSelectOption[];
      dynamicOptions: DynamicSelectOption[];
      onAdd: (label: string) => Promise<void>;
      onDelete: (value: string) => Promise<void>;
    }
  | { mode: 'none' };

/**
 * `InputDefinition.options.lookup` nomeia a COLEÇÃO da lista, e qualquer uma responde — as do
 * kernel e as declaradas pelo tenant. Não há mais um `case` por lista para acrescentar aqui.
 */
export const useLiteralOptionsViewModel = (input: InputDefinition): LiteralOptionsViewModel => {
  const theme = useTheme();
  const { getOptions, addOption, removeOption } = useLookups();

  if (input.options?.kind === 'Static') {
    return {
      mode: 'static',
      options: input.options.options.map((opt) => ({
        value: opt.value,
        label: opt.label,
        color: resolveColor(opt.color, theme, false),
      })),
    };
  }

  if (input.options?.kind === 'Lookup') {
    const collection = input.options.lookup;
    const options = getOptions(collection);
    return {
      mode: 'dynamic',
      staticOptions: options
        .filter((option) => option.isStatic)
        .map((option) => ({ value: option.key, label: option.label, color: resolveColor(option.color, theme, false) })),
      dynamicOptions: options
        .filter((option) => !option.isStatic)
        .map((option) => ({ value: option.key, label: option.label, color: resolveColor(option.color, theme, false) })),
      onAdd: (label: string) => addOption(collection, label),
      onDelete: (key: string) => removeOption(collection, key),
    };
  }

  return { mode: 'none' };
};
