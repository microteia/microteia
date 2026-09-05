import { useCallback, useMemo } from 'react';
import { useLabel } from '../i18n/useT';
import { useSchemaContext } from '../useSchemaContext';
import { fieldAtPath } from './reportFilterFields';
import { getValueAtPath, parsePath } from '../../../domain/schema/pathResolver';
import type { SchemaContext, SchemaScreen } from '../../../domain/schema/pathResolver';
import { resolveRecordTitle } from '../../../domain/services/customFieldValues';
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
 */
export const useReportCellText = (
  spec: ReportSpec,
): ((record: Record<string, unknown>, dimension: ReportDimension) => string) => {
  const ctx = useSchemaContext();
  const label = useLabel();

  const titleFieldByDimension = useMemo(() => {
    const byDimension = new Map<string, string>();
    for (const dimension of spec.dataset.dimensions ?? []) {
      const field = fieldAtPath(ctx, spec.dataset.table, dimension.path);
      if (!field?.refEntity) continue;
      byDimension.set(dimension.key, referencedScreen(ctx, field.refEntity)?.titleFieldKey ?? '');
    }
    return byDimension;
  }, [ctx, spec]);

  return useCallback((record, dimension) => {
    const raw = getValueAtPath(record, parsePath(dimension.path));
    if (raw === null || raw === undefined) return '';

    const titleFieldKey = titleFieldByDimension.get(dimension.key);
    const textOf = (value: unknown): string => {
      if (value === null || value === undefined) return '';
      if (titleFieldKey !== undefined && isRecord(value)) return label(resolveRecordTitle(value, titleFieldKey));
      return String(value);
    };

    if (!Array.isArray(raw)) return textOf(raw);
    return raw.map(textOf).filter((text) => text !== '').join(', ');
  }, [titleFieldByDimension, label]);
};
