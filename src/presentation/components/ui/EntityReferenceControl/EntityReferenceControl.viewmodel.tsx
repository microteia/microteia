import { useCallback, useMemo } from 'react';
import { useReferenceSearch } from '../../../shared/useReferenceSearch';
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
  /** O texto digitado na busca do seletor, que vai ao servidor buscar além das opções carregadas. */
  onQuery: (text: string) => void;
  /** Os ids que o servidor achou para esse texto. */
  searchMatches: ReadonlySet<string>;
}

export const useEntityReferenceControlViewModel = (input: InputDefinition): EntityReferenceControlViewModel => {
  const referenceOptionsByEntity = useReferenceOptions();
  const resolveReferenceOpener = useReferenceOpener();
  const entityType = input.entityType ?? '';

  const options = useMemo(
    () => referenceOptionsByEntity[entityType] ?? [],
    [referenceOptionsByEntity, entityType],
  );

  const search = useReferenceSearch();
  const onQuery = useCallback((text: string) => search.onQuery('input', entityType, text), [search, entityType]);

  return { options, openSelected: resolveReferenceOpener(entityType), onQuery, searchMatches: search.matchesFor('input') };
};
