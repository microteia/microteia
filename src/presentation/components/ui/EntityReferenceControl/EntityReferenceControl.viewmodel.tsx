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
