import { useCallback, useMemo } from 'react';
import { useCustomFieldListing } from '../../hooks/useCustomFieldListing';
import { useSchemaContext } from '../useSchemaContext';
import { useT } from '../i18n/useT';
import type { FieldDefinition } from '../../../domain/entities/entitySchemas';
import type { SchemaContext } from '../../../domain/schema/pathResolver';
import type { ReportGroupKey } from '../../../domain/schema/report/reportResult';
import type { ReportSpec } from '../../../domain/schema/report/reportSpec';

/** A tela que descreve uma coleção — a chave do mapa é a própria coleção. */
const fieldsOf = (ctx: SchemaContext, collection: string): FieldDefinition[] =>
  ctx.screens.get(collection)?.fields ?? [];

/**
 * O CAMPO que a dimensão lê, mesmo quando o caminho atravessa uma referência.
 *
 * `situacao` é um campo da coleção-fonte; `cliente.cidade` é um campo da coleção APONTADA, e é ele
 * que sabe se `pending` se escreve "Pendente". O salto é feito pelo `refDenormKey` (o nome pelo qual
 * o registro apontado é navegado) ou pela própria chave do campo de referência.
 */
const fieldAtPath = (
  ctx: SchemaContext,
  table: string,
  path: string,
): FieldDefinition | undefined => {
  const segments = path.split('.').filter(Boolean);
  let collection = table;

  for (let index = 0; index < segments.length - 1; index += 1) {
    const hop = fieldsOf(ctx, collection).find((field) =>
      (field.refDenormKey ?? field.key) === segments[index] || field.key === segments[index]);
    if (!hop?.refEntity) return undefined;
    collection = hop.refEntity;
  }

  return fieldsOf(ctx, collection).find((field) => field.key === segments[segments.length - 1]);
};

/**
 * Traduz a chave CRUA de um grupo no que o escritório lê.
 *
 * O backend manda a chave crua de propósito — `pending`, o id do registro apontado — e quem sabe
 * transformá-la em "Pendente" é a listagem, com as opções do escritório. Reusar o `displayValue`
 * dela é o que faz o relatório e o cartão dizerem a MESMA palavra sobre o mesmo dado; um segundo
 * formatador aqui divergiria na primeira lista renomeada.
 *
 * O que o backend já rotulou — o balde de data — passa direto: ele derivou aquele texto, e nenhuma
 * opção do escritório o descreve.
 */
export const useReportGroupLabels = (spec: ReportSpec): ((entry: ReportGroupKey | undefined) => string) => {
  const ctx = useSchemaContext();
  const t = useT('core.reports');
  const emptyLabel = t('group.empty');

  const fieldByDimension = useMemo(() => {
    const byDimension = new Map<string, FieldDefinition>();
    for (const dimension of spec.dataset.dimensions ?? []) {
      const field = fieldAtPath(ctx, spec.dataset.table, dimension.path);
      if (field) byDimension.set(dimension.key, field);
    }
    return byDimension;
  }, [ctx, spec]);

  const fields = useMemo(() => [...fieldByDimension.values()], [fieldByDimension]);
  const listing = useCustomFieldListing(fields);

  return useCallback((entry) => {
    if (!entry) return '';
    if (entry.label) return entry.label;
    if (entry.key === '') return emptyLabel;

    const field = fieldByDimension.get(entry.dimension);
    if (!field) return entry.key;

    const shown = listing.displayValue({ [field.key]: entry.key }, field);
    return shown.trim() === '' ? entry.key : shown;
  }, [fieldByDimension, listing, emptyLabel]);
};
