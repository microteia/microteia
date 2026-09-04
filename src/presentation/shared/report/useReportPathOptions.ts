import { useMemo } from 'react';
import { useLabel } from '../i18n/useT';
import { useSchemaContext } from '../useSchemaContext';
import type { FieldDefinition } from '../../../domain/entities/entitySchemas';

export interface ReportPathOption {
  value: string;
  label: string;
  /** O tipo nativo do campo, para a autoria oferecer só o que faz sentido. */
  isDate: boolean;
  isNumeric: boolean;
}

const NUMERIC_TYPES = new Set(['number', 'currency']);

const optionOf = (
  field: FieldDefinition,
  prefix: string,
  prefixLabel: string,
  label: (value: string | null | undefined) => string,
): ReportPathOption => ({
  value: prefix ? `${prefix}.${field.key}` : field.key,
  label: prefixLabel ? `${prefixLabel} › ${label(field.label)}` : label(field.label),
  isDate: field.type === 'date',
  isNumeric: NUMERIC_TYPES.has(field.type),
});

/**
 * Os caminhos que a autoria oferece: os campos da coleção e os da coleção APONTADA por cada
 * referência, um salto adiante.
 *
 * Um salto só, e é escolha: dois já é uma árvore, e uma lista de trezentas entradas não ajuda
 * ninguém a achar "a cidade do cliente". Quem precisa de mais escreve o caminho — o validador aceita
 * a mesma profundidade que o resto do produto.
 */
export const useReportPathOptions = (table: string): ReportPathOption[] => {
  const ctx = useSchemaContext();
  const label = useLabel();

  return useMemo(() => {
    const own = ctx.screens.get(table)?.fields ?? [];
    const options: ReportPathOption[] = [];

    for (const field of own) {
      if (field.type === 'file') continue;
      options.push(optionOf(field, '', '', label));

      const target = field.refEntity ? ctx.screens.get(field.refEntity) : undefined;
      if (!target) continue;

      const hop = field.refDenormKey ?? field.key;
      for (const nested of target.fields) {
        if (nested.type === 'file' || nested.type === 'reference') continue;
        options.push(optionOf(nested, hop, label(field.label), label));
      }
    }

    return options;
  }, [ctx, table, label]);
};
