import { useMemo } from 'react';
import { useReferenceOptions } from '../../../hooks/useReferenceOptions';
import { useReferenceOpener } from '../../../shared/useReferenceOpener';
import type { InputDefinition } from '../../../../domain/entities/WorkflowStepCatalog';
import type { ReferenceOpener } from '../../../shared/useReferenceOpener';
import type { SearchSelectOption } from '../SearchSelect';

export interface EntityReferenceControlProps {
  input: InputDefinition;
  value: string;
  onChange: (value: string) => void;
  /**
   * A seleção MÚLTIPLA, quando o input declara `list: true`. Opcional para que quem só sabe lidar com
   * um valor continue igual: sem `onChangeMany`, o controle é o de sempre.
   */
  values?: string[];
  onChangeMany?: (values: string[]) => void;
}

export interface EntityReferenceControlViewModel {
  options: SearchSelectOption[];
  /** O atalho até o registro escolhido, ou `null` quando nenhuma tela legível apresenta a entidade. */
  openSelected: ReferenceOpener | null;
}

export const useEntityReferenceControlViewModel = (input: InputDefinition): EntityReferenceControlViewModel => {
  const referenceOptionsByEntity = useReferenceOptions();
  const resolveReferenceOpener = useReferenceOpener();
  const entityType = input.entityType ?? '';

  const options = useMemo(
    () => referenceOptionsByEntity[entityType] ?? [],
    [referenceOptionsByEntity, entityType],
  );

  return { options, openSelected: resolveReferenceOpener(entityType) };
};
