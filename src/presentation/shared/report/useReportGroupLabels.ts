import { useCallback, useMemo } from 'react';
import { useCustomFieldListing } from '../../hooks/useCustomFieldListing';
import { useReportSchema } from './useReportSchema';
import { fieldAtPath } from './reportFilterFields';
import { useLabel, useT } from '../i18n/useT';
import type { FieldDefinition } from '../../../domain/entities/entitySchemas';
import type { ReportGroupKey } from '../../../domain/schema/report/reportResult';
import { REPORT_OTHERS_KEY } from '../../../domain/schema/report/reportSpec';
import type { ReportSpec } from '../../../domain/schema/report/reportSpec';

/**
 * Traduz a chave CRUA de um grupo no que o escritório lê.
 *
 * O backend manda a chave crua de propósito — `pending`, o id do registro apontado — e quem sabe
 * transformá-la em "Pendente" é a listagem, com as opções do escritório. Reusar o `displayValue`
 * dela é o que faz o relatório e o cartão dizerem a MESMA palavra sobre o mesmo dado; um segundo
 * formatador aqui divergiria na primeira lista renomeada.
 *
 * O que o backend já rotulou — o balde de data, a faixa — não passa pela listagem: ele derivou aquele
 * texto, e nenhuma opção do escritório o descreve.
 */
export const useReportGroupLabels = (spec: ReportSpec): ((entry: ReportGroupKey | undefined) => string) => {
  const { ctx, table } = useReportSchema(spec);
  const t = useT('core.reports');
  const label = useLabel();
  const emptyLabel = t('group.empty');
  const othersLabel = t('group.others');

  const fieldByDimension = useMemo(() => {
    const byDimension = new Map<string, FieldDefinition>();
    for (const dimension of spec.dataset.dimensions ?? []) {
      const field = fieldAtPath(ctx, table, dimension.path);
      if (field) byDimension.set(dimension.key, field);
    }
    return byDimension;
  }, [ctx, spec, table]);

  const fields = useMemo(() => [...fieldByDimension.values()], [fieldByDimension]);
  const listing = useCustomFieldListing(fields);

  return useCallback((entry) => {
    if (!entry) return '';
    // O balde de data e a FAIXA declarada já vêm rotuladas — a faixa pode ser uma referência `@ns/chave`
    // de uma extensão, e o texto do escritório passa intacto pelo mesmo `label`.
    if (entry.label) return label(entry.label);
    if (entry.key === '') return emptyLabel;
    // O grupo residual de um Top N tem chave reservada, e é a tela que diz o nome dele no idioma de
    // quem lê — o servidor que o montou não fala idioma nenhum.
    if (entry.key === REPORT_OTHERS_KEY) return othersLabel;

    const field = fieldByDimension.get(entry.dimension);
    if (!field) return entry.key;

    const shown = listing.displayValue({ [field.key]: entry.key }, field);
    return shown.trim() === '' ? entry.key : shown;
  }, [fieldByDimension, listing, emptyLabel, othersLabel, label]);
};
