import type { CustomFieldOption, FieldDefinition } from '../entities/entitySchemas';
import type { SchemaContext } from '../schema/pathResolver';
import { getValueAtPath, parsePath } from '../schema/pathResolver';
import type { MessageCatalog } from '../schema/i18n/messages';
import { resolveLabel } from '../schema/i18n/messageRef';
import { REPORT_OTHERS_KEY, isComputedDimension } from '../schema/report/reportSpec';
import type { ReportDimension, ReportSpec, ReportValueFormat } from '../schema/report/reportSpec';
import type { ReportGroupKey, ReportResult } from '../schema/report/reportResult';
import type { ReportTableText } from '../schema/report/reportTable';
import { recordSearchTitle } from '../schema/recordSearch';

export interface ReportFileTextSources {
  getRecords(tenantId: string, collection: string, ids: readonly string[]): Promise<Map<string, Record<string, unknown>>>;
  getLookupOptions(tenantId: string, collection: string, keys: readonly string[]): Promise<CustomFieldOption[]>;
}

const fieldsOf = (ctx: SchemaContext, collection: string): FieldDefinition[] => ctx.screens.get(collection)?.fields ?? [];

/**
 * O campo que a dimensão lê — atravessando referências pelo `refDenormKey` (ou pela chave), como a
 * tela faz. A calculada não tem campo: o valor dela é o que a expressão deu.
 */
export const reportDimensionField = (
  ctx: SchemaContext,
  table: string,
  dimension: ReportDimension,
): FieldDefinition | undefined => {
  if (isComputedDimension(dimension)) return undefined;
  const segments = dimension.path.split('.').filter(Boolean);
  let collection = table;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const hop = fieldsOf(ctx, collection).find((field) =>
      (field.refDenormKey ?? field.key) === segments[index] || field.key === segments[index]);
    if (!hop?.refEntity) return undefined;
    collection = hop.refEntity;
  }
  return fieldsOf(ctx, collection).find((field) => field.key === segments[segments.length - 1]);
};

const idsOf = (value: unknown): string[] => {
  if (typeof value === 'string') return value === '' ? [] : [value];
  if (Array.isArray(value)) return value.flatMap(idsOf);
  if (value && typeof value === 'object') {
    const id = (value as Record<string, unknown>).id;
    return typeof id === 'string' && id !== '' ? [id] : [];
  }
  return [];
};

const numberFormatOf = (format: ReportValueFormat | undefined): Intl.NumberFormatOptions => {
  if (format?.kind === 'integer') return { maximumFractionDigits: 0 };
  if (format?.kind === 'percent') {
    return { minimumFractionDigits: format.decimals ?? 1, maximumFractionDigits: format.decimals ?? 1 };
  }
  return { minimumFractionDigits: format?.decimals ?? 0, maximumFractionDigits: format?.decimals ?? 2 };
};

/**
 * O relatório escrito como a TELA o escreve, no servidor — para o arquivo de uma automação.
 *
 * As chaves chegam cruas do agregador (a opção `pending`, o id do cliente), e é aqui que viram o que o
 * escritório lê: o rótulo da opção (inclusive o de uma lista do escritório), o título do registro
 * apontado, o balde de data, "Outros" e "sem valor". As fontes são as MESMAS da busca de registros — uma
 * leitura por coleção apontada e uma por lista, nunca uma por linha.
 *
 * `formatted` decide o número: cru para a planilha (que soma o cru), formatado no idioma do escritório
 * para o PDF, que é para ser lido.
 */
export const reportFileText = async (input: {
  tenantId: string;
  spec: ReportSpec;
  result: ReportResult;
  schema: SchemaContext;
  catalog: MessageCatalog;
  sources: ReportFileTextSources;
  locale: string;
  formatted: boolean;
}): Promise<ReportTableText> => {
  const { tenantId, spec, result, schema, catalog, sources } = input;
  const translate = (value: string | null | undefined): string => (value ? resolveLabel(catalog, value) : '');
  const dimensions = new Map((spec.dataset.dimensions ?? []).map((dimension) => [dimension.key, dimension]));
  const fieldOf = (dimension: ReportDimension | undefined) =>
    (dimension ? reportDimensionField(schema, spec.dataset.table, dimension) : undefined);

  // O que precisa ser LIDO antes de escrever: os ids por coleção apontada e as chaves por lista.
  const titleNeeds = new Map<string, Set<string>>();
  const lookupNeeds = new Map<string, Set<string>>();
  const need = (field: FieldDefinition | undefined, keys: string[]): void => {
    if (!field || keys.length === 0) return;
    const target = field.type === 'reference' && field.refEntity ? titleNeeds : field.lookupCollection ? lookupNeeds : null;
    const collection = field.type === 'reference' ? field.refEntity : field.lookupCollection;
    if (!target || !collection) return;
    const set = target.get(collection) ?? new Set<string>();
    for (const key of keys) set.add(key);
    target.set(collection, set);
  };
  const entries = [...result.rows.flatMap((row) => row.keys), ...result.columns.flat()];
  for (const entry of entries) need(fieldOf(dimensions.get(entry.dimension)), idsOf(entry.key));
  for (const record of [...(result.records ?? []), ...result.rows.flatMap((row) => row.records ?? [])]) {
    for (const dimension of dimensions.values()) {
      need(fieldOf(dimension), idsOf(getValueAtPath(record, parsePath(dimension.path))));
    }
  }

  const titles = new Map<string, string>();
  const lookupLabels = new Map<string, string>();
  await Promise.all([
    ...[...titleNeeds].map(async ([collection, ids]) => {
      const screen = schema.screens.get(collection);
      const found = await sources.getRecords(tenantId, collection, [...ids]);
      for (const [id, data] of found) {
        const title = screen ? recordSearchTitle(screen, data) : '';
        if (title) titles.set(`${collection}/${id}`, title);
      }
    }),
    ...[...lookupNeeds].map(async ([collection, keys]) => {
      for (const option of await sources.getLookupOptions(tenantId, collection, [...keys])) {
        lookupLabels.set(`${collection}/${option.key}`, option.label);
      }
    }),
  ]);

  const valueText = (field: FieldDefinition | undefined, key: string): string => {
    if (!field) return key;
    if (field.type === 'reference' && field.refEntity) return titles.get(`${field.refEntity}/${key}`) ?? key;
    if (field.lookupCollection) return translate(lookupLabels.get(`${field.lookupCollection}/${key}`)) || key;
    const option = field.options?.find((candidate) => candidate.key === key);
    return option ? translate(option.label) || key : key;
  };

  const number = new Intl.NumberFormat(input.locale || undefined);
  return {
    label: translate,
    group: (entry: ReportGroupKey | undefined) => {
      if (!entry) return '';
      if (entry.label) return translate(entry.label);
      if (entry.key === '') return translate('@core.reports/group.empty');
      if (entry.key === REPORT_OTHERS_KEY) return translate('@core.reports/group.others');
      return valueText(fieldOf(dimensions.get(entry.dimension)), entry.key);
    },
    cell: (record, dimension) => {
      const value = getValueAtPath(record, parsePath(dimension.path));
      if (value === null || value === undefined) return '';
      const field = fieldOf(dimension);
      if (Array.isArray(value)) return value.map((item) => (typeof item === 'string' ? valueText(field, item) : idsOf(item).map((id) => valueText(field, id)).join(''))).join(', ');
      if (value && typeof value === 'object') return idsOf(value).map((id) => valueText(field, id)).join(', ');
      return typeof value === 'string' ? valueText(field, value) : String(value);
    },
    number: (value, format) => {
      if (value === null || value === undefined) return '';
      if (!input.formatted) return String(value);
      const text = new Intl.NumberFormat(input.locale || undefined, numberFormatOf(format)).format(value);
      return format?.kind === 'percent' ? [text, '%'].join('') : text;
    },
    total: translate('@core.reports/table.total'),
    partial: (scanned) => resolveLabel(catalog, '@core.reports/csv.partial', { scanned: number.format(scanned) }),
  };
};
