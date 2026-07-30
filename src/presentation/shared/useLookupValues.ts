import { useCallback } from 'react';
import { useLookups } from '../../stores/useLookups';

export interface LookupValueOption {
  value: string;
  label: string;
  color?: string;
}

export interface LookupValuesState {
  getLookupOptions: (collection: string) => LookupValueOption[];
}

/**
 * As opções de uma lista pelo nome da coleção. A assinatura é a mesma de antes — o que mudou é que
 * atrás dela não existe mais um mapa de 30 linhas ligando coleção a store: qualquer lista responde,
 * inclusive as que o tenant criou depois do build.
 *
 * O VALOR gravado no registro é o rótulo, não a chave: é o que as telas fixas sempre fizeram, e o
 * que o formulário mostra ao usuário.
 */
export const useLookupValues = (): LookupValuesState => {
  const { getOptions } = useLookups();

  const getLookupOptions = useCallback(
    (collection: string): LookupValueOption[] =>
      getOptions(collection).map((option) => ({
        value: option.label,
        label: option.label,
        color: option.color,
      })),
    [getOptions],
  );

  return { getLookupOptions };
};
