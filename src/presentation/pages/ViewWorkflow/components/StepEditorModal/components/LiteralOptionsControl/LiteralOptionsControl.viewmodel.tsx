import { useTheme } from 'styled-components';
import { useDeadlineLookup } from '../../../../../../../stores/useDeadlineLookup';
import { resolveColor } from '../../../../../../../shared/styles/colorUtils';
import type { InputDefinition } from '../../../../../../../domain/entities/WorkflowStepCatalog';
import type { DynamicSelectOption } from '../../../../../../components/ui/DynamicSelect';
import type { SearchSelectOption } from '../../../../../../components/ui/SearchSelect';

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
 * Ponto único de extensão para novos campos de lista dinâmica: chame o hook do lookup
 * aqui (incondicionalmente, por causa das regras de Hooks) e adicione um `case` no switch
 * abaixo mapeando a chave declarada em `InputDefinition.options.lookup` no StepDefinition.
 * Se a config subjacente tiver um campo `color`, resolva com `resolveColor` (hex ou token
 * do tema) e inclua em cada opção — igual ao branch `Static` abaixo.
 */
export const useLiteralOptionsViewModel = (input: InputDefinition): LiteralOptionsViewModel => {
  const theme = useTheme();
  const deadlineTypeLookup = useDeadlineLookup();

  if (input.options?.kind === 'Static') {
    return {
      mode: 'static',
      options: input.options.options.map((opt) => ({
        value: opt.value,
        label: opt.label,
        color: resolveColor(opt.colorToken ?? opt.color, theme, false),
      })),
    };
  }

  if (input.options?.kind === 'Lookup') {
    switch (input.options.lookup) {
      case 'deadlineTypes':
        return {
          mode: 'dynamic',
          staticOptions: deadlineTypeLookup.typeConfigs
            .filter((t) => t.isStatic)
            .map((t) => ({ value: t.key, label: t.label })),
          dynamicOptions: deadlineTypeLookup.typeConfigs
            .filter((t) => !t.isStatic)
            .map((t) => ({ value: t.key, label: t.label })),
          onAdd: deadlineTypeLookup.addType,
          onDelete: deadlineTypeLookup.removeType,
        };
      default:
        return { mode: 'none' };
    }
  }

  return { mode: 'none' };
};
