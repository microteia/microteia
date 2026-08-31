import { useCallback, useMemo } from 'react';
import { readRecordText } from '../../../domain/services/customFieldValues';
import type { CustomFieldListing } from '../../hooks/useCustomFieldListing';
import type { FieldDefinition, ScreenDefinition } from '../../../domain/entities';

export interface RecordIdentityText {
  /** Texto do campo-TÍTULO, com seleção e relação já resolvidas para o rótulo. Vazio quando não há. */
  titleOf: (values: object) => string;
  /** Idem para o campo-SUBTÍTULO. */
  subtitleOf: (values: object) => string;
}

/**
 * O que identifica um registro na tela: o texto do campo-título e o do campo-subtítulo.
 *
 * Uma seleção guarda a CHAVE da opção e uma relação guarda o ID do registro apontado — nenhum dos
 * dois é o que se lê. O cartão da listagem resolvia; o cabeçalho do detalhe e o rótulo da aba liam o
 * valor cru, e por isso o mesmo registro aparecia como "Alex" na lista e como
 * `BnUQ236xn6k16FTlcwfQ` no detalhe. Uma declaração, três lugares — e agora um resolvedor só.
 *
 * O `displayValue` entra por parâmetro, e não por `useCustomFieldListing` aqui dentro, porque a
 * listagem já tem o dela: montar um segundo refaria o mapa de opções de TODAS as coleções a cada
 * render da lista.
 */
export const useRecordIdentityText = (
  definition: ScreenDefinition | null,
  fields: FieldDefinition[],
  displayValue: CustomFieldListing['displayValue'],
): RecordIdentityText => {
  const titleField = useMemo(
    () => fields.find((field) => field.key === definition?.titleFieldKey) ?? null,
    [fields, definition],
  );
  const subtitleField = useMemo(
    () => fields.find((field) => field.key === definition?.subtitleFieldKey) ?? null,
    [fields, definition],
  );

  const textOf = useCallback(
    (values: object, field: FieldDefinition | null, fieldKey: string): string => {
      if (field && (field.type === 'reference' || field.type === 'select')) {
        const shown = displayValue(values as never, field);
        return shown === '—' ? '' : shown;
      }
      return readRecordText(values, fieldKey);
    },
    [displayValue],
  );

  const titleOf = useCallback(
    (values: object) => textOf(values, titleField, definition?.titleFieldKey ?? ''),
    [textOf, titleField, definition],
  );
  const subtitleOf = useCallback(
    (values: object) => textOf(values, subtitleField, definition?.subtitleFieldKey ?? ''),
    [textOf, subtitleField, definition],
  );

  return useMemo(() => ({ titleOf, subtitleOf }), [titleOf, subtitleOf]);
};
