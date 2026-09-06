import { useCallback, useMemo } from 'react';
import { useLabel, useLocaleFormat } from '../i18n/useT';
import { useSchemaContext } from '../useSchemaContext';
import { fieldAtPath } from './reportFilterFields';
import { getValueAtPath, parsePath } from '../../../domain/schema/pathResolver';
import type { SchemaContext, SchemaScreen } from '../../../domain/schema/pathResolver';
import { resolveRecordTitle } from '../../../domain/services/customFieldValues';
import { bucketDateValue } from '../../../domain/schema/report/reportBuckets';
import { reportGranularityOf } from '../../../domain/schema/report/reportSpec';
import type { ReportDimension, ReportSpec } from '../../../domain/schema/report/reportSpec';

/**
 * A tela que descreve a coleção APONTADA.
 *
 * A chave do mapa é a coleção, e há declaração antiga que guardou em `refEntity` a chave da tela —
 * a mesma tolerância que a lista de referências já tem. Sem ela, o registro apontado ficaria sem
 * nome justamente onde o autor não tem como perceber.
 */
const referencedScreen = (ctx: SchemaContext, refEntity: string): SchemaScreen | undefined =>
  ctx.screens.get(refEntity) ?? [...ctx.screens.values()].find((screen) => screen.id === refEntity);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * O texto de uma célula da LISTA SIMPLES — a mesma para a tabela e para o CSV.
 *
 * O registro chega HIDRATADO: onde o documento guarda o id de uma referência, a linha traz o
 * registro apontado inteiro, e uma referência de vários traz a lista deles. Passar isso por
 * `String` escrevia `[object Object]` na coluna — e, na de vários, um `[object Object]` por
 * apontado, que é o dado inteiro perdido sem uma palavra dizendo que se perdeu.
 *
 * Quem sabe nomear um registro é o campo-TÍTULO da tela dele, o mesmo que a listagem, a busca e uma
 * menção mostram. É dele que sai o nome aqui, lido do que já veio hidratado — sem uma segunda
 * consulta, e sem depender de a coleção apontada estar carregada nesta tela.
 *
 * A DATA passa pelo mesmo corte que o agrupamento faria e, sem corte, pelo formato do idioma em
 * vigor. Uma lista simples é a única dobra em que a célula vem do registro e não do agregador: sem
 * isto, a autoria escolhia "Por mês" e a coluna mostrava o instante cru — a pergunta feita na tela
 * de desenho não tinha resposta nenhuma na tela do relatório.
 */
export const useReportCellText = (
  spec: ReportSpec,
): ((record: Record<string, unknown>, dimension: ReportDimension) => string) => {
  const ctx = useSchemaContext();
  const label = useLabel();
  const { formatDate } = useLocaleFormat();

  const titleFieldByDimension = useMemo(() => {
    const byDimension = new Map<string, string>();
    for (const dimension of spec.dataset.dimensions ?? []) {
      const field = fieldAtPath(ctx, spec.dataset.table, dimension.path);
      if (!field?.refEntity) continue;
      byDimension.set(dimension.key, referencedScreen(ctx, field.refEntity)?.titleFieldKey ?? '');
    }
    return byDimension;
  }, [ctx, spec]);

  const dateDimensions = useMemo(() => {
    const keys = new Set<string>();
    for (const dimension of spec.dataset.dimensions ?? []) {
      if (fieldAtPath(ctx, spec.dataset.table, dimension.path)?.type === 'date') keys.add(dimension.key);
    }
    return keys;
  }, [ctx, spec]);

  return useCallback((record, dimension) => {
    const raw = getValueAtPath(record, parsePath(dimension.path));
    if (raw === null || raw === undefined) return '';

    // O balde vem do MESMO corte do agregador, e a chave dele já é o texto: "2026-03" é o que a
    // dobra agrupada mostra para o mesmo dado, e duas telas não podem discordar sobre um mês.
    const granularity = reportGranularityOf(dimension.granularity);
    if (granularity) {
      const bucket = bucketDateValue(raw, granularity, dimension.timeZone);
      if (bucket !== null) return bucket;
    }

    const titleFieldKey = titleFieldByDimension.get(dimension.key);
    const isDate = dateDimensions.has(dimension.key);
    const textOf = (value: unknown): string => {
      if (value === null || value === undefined) return '';
      if (titleFieldKey !== undefined && isRecord(value)) return label(resolveRecordTitle(value, titleFieldKey));
      if (isDate) return formatDate(value);
      return String(value);
    };

    if (!Array.isArray(raw)) return textOf(raw);
    return raw.map(textOf).filter((text) => text !== '').join(', ');
  }, [titleFieldByDimension, dateDimensions, label, formatDate]);
};
