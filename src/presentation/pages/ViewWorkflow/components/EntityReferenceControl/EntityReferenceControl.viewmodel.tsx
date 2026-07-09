import { useMemo } from 'react';
import { useReferenceOptions } from '../../../../hooks/useReferenceOptions';
import type { InputDefinition } from '../../../../../domain/entities/WorkflowStepCatalog';
import type { SearchSelectOption } from '../../../../components/ui/SearchSelect';

export interface EntityReferenceControlProps {
  input: InputDefinition;
  value: string;
  onChange: (value: string) => void;
}

export const useEntityReferenceControlViewModel = (input: InputDefinition): SearchSelectOption[] => {
  const referenceOptionsByEntity = useReferenceOptions();
  return useMemo(
    () => referenceOptionsByEntity[input.entityType ?? ''] ?? [],
    [referenceOptionsByEntity, input.entityType],
  );
};
