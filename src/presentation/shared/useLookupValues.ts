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
 * O VALOR é a CHAVE da opção — o que está gravado no registro —, e o rótulo é o que se lê. Na opção
 * cadastrada pelo escritório os dois são o mesmo texto; na lista declarada, cuja chave difere do
 * rótulo, comparar pelo rótulo era comparar com o que não está no documento.
 */
export const useLookupValues = (): LookupValuesState => {
  const { getOptions } = useLookups();

  const getLookupOptions = useCallback(
    (collection: string): LookupValueOption[] =>
      getOptions(collection).map((option) => ({
        value: option.key,
        label: option.label,
        color: option.color,
      })),
    [getOptions],
  );

  return { getLookupOptions };
};
