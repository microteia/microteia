import type { NativeFieldType } from '../schema/entityRegistry';
import type { SchemaContext } from '../schema/pathResolver';
import { validateWritablePath } from '../schema/mutationSpec';
import { collectDerivedFieldKeys } from '../schema/recordRules';
import { resolveEntity, resolveEntityKeys } from '../schema/screenEntity';
import type { RecordImportRow, RecordImportRowResult } from '../schema/recordImport';
import { importLookupKeys, resolveImportReference } from '../schema/recordImportReference';

/**
 * O lado do NAVEGADOR da importação: ler o arquivo, dizer o que dá para mapear, converter cada célula no
 * tipo do campo e montar as linhas que o servidor grava. Nada aqui grava nem decide se uma linha é válida
 * para a tela — isso é do caminho de gravação, no servidor. O que mora aqui é só o que precisa do
 * ARQUIVO: o número da linha e a célula que não converte.
 */

/** Quatro vezes o teto de um arquivo de 50 mil linhas largas. Acima disso o navegador sofre antes do servidor. */
export const RECORD_IMPORT_MAX_FILE_BYTES = 20 * 1024 * 1024;

/** O separador dos valores de um campo de vários valores dentro de UMA célula. */
export const RECORD_IMPORT_LIST_SEPARATOR = '|';

export type ImportFileKind = 'csv' | 'json';

/** O arquivo como tabela: cabeçalho e linhas, cada uma com o número dela no ARQUIVO. */
export interface ImportTable {
  kind: ImportFileKind;
  headers: string[];
  rows: { line: number; cells: unknown[] }[];
}

export type ImportFileOutcome =
  | { ok: true; table: ImportTable }
  | { ok: false; error: string; errorParams?: Record<string, string> };

const CSV_DELIMITERS = [',', ';', '\t'] as const;

/** O delimitador é o que mais aparece FORA de aspas na primeira linha — a de cabeçalho. */
const detectDelimiter = (text: string): string => {
  const counts = new Map<string, number>(CSV_DELIMITERS.map((delimiter) => [delimiter, 0]));
  let quoted = false;
  for (const char of text) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && (char === '\n' || char === '\r')) break;
    else if (!quoted && counts.has(char)) counts.set(char, (counts.get(char) ?? 0) + 1);
  }
  const [best, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return count > 0 ? best : ',';
};

const isBlankRow = (cells: readonly string[]): boolean => cells.every((cell) => cell.trim() === '');

/**
 * CSV pela RFC 4180: aspas duplas escapam aspas, e um valor entre aspas pode conter delimitador e quebra
 * de linha. O número de cada linha é o da linha FÍSICA em que ela começa — é o que a pessoa vê no editor
 * do arquivo. Linha em branco é pulada; aspas sem fechamento recusam o arquivo inteiro, porque tudo depois
 * dela estaria deslocado.
 */
export const parseImportCsv = (source: string): ImportFileOutcome => {
  const text = source.replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(text);
  const records: { line: number; cells: string[] }[] = [];
  let cells: string[] = [];
  let cell = '';
  let quoted = false;
  let line = 1;
  let recordLine = 1;

  const endCell = () => {
    cells.push(cell);
    cell = '';
  };
  const endRecord = () => {
    endCell();
    if (!isBlankRow(cells)) records.push({ line: recordLine, cells });
    cells = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        if (char === '\n') line += 1;
        cell += char;
      }
      continue;
    }
    if (char === '"' && cell === '') quoted = true;
    else if (char === delimiter) endCell();
    else if (char === '\r' && text[index + 1] === '\n') continue;
    else if (char === '\n' || char === '\r') {
      endRecord();
      line += 1;
      recordLine = line;
    } else cell += char;
  }
  if (quoted) return { ok: false, error: '@core.records/import.file.unclosed-quote', errorParams: { line: String(recordLine) } };
  if (cell !== '' || cells.length > 0) endRecord();

  const [header, ...body] = records;
  if (!header) return { ok: false, error: '@core.records/import.file.empty' };
  return {
    ok: true,
    table: { kind: 'csv', headers: header.cells.map((name) => name.trim()), rows: body },
  };
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * JSON é uma LISTA de objetos, um por registro. As colunas são as chaves, na ordem em que aparecem pela
 * primeira vez; a "linha" é a posição do objeto na lista, a partir de 1. O valor chega como está — número
 * é número, lista é lista —, que é a razão de existir do formato.
 */
export const parseImportJson = (source: string): ImportFileOutcome => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source.replace(/^\uFEFF/, ''));
  } catch {
    return { ok: false, error: '@core.records/import.file.invalid-json' };
  }
  if (!Array.isArray(parsed)) return { ok: false, error: '@core.records/import.file.not-a-list' };
  const headers: string[] = [];
  const seen = new Set<string>();
  for (const [index, item] of parsed.entries()) {
    if (!isPlainObject(item)) {
      return { ok: false, error: '@core.records/import.file.not-an-object', errorParams: { line: String(index + 1) } };
    }
    for (const key of Object.keys(item)) {
      if (!seen.has(key)) {
        seen.add(key);
        headers.push(key);
      }
    }
  }
  if (parsed.length === 0) return { ok: false, error: '@core.records/import.file.empty' };
  return {
    ok: true,
    table: {
      kind: 'json',
      headers,
      rows: (parsed as Record<string, unknown>[]).map((item, index) => ({
        line: index + 1,
        cells: headers.map((key) => item[key]),
      })),
    },
  };
};

export const importFileKindOf = (fileName: string): ImportFileKind | null => {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.csv') || lower.endsWith('.txt')) return 'csv';
  return null;
};

export const parseImportFile = (kind: ImportFileKind, source: string): ImportFileOutcome =>
  kind === 'json' ? parseImportJson(source) : parseImportCsv(source);

/** Uma chave do alvo por que a coluna de uma referência acha o registro. `label` é o do campo dela. */
export interface ImportLookupKey {
  key: string;
  label: string;
}

/** Um campo que pode receber uma coluna. `label` é o declarado — referência ou texto do escritório. */
export interface ImportableField {
  key: string;
  label: string;
  type: NativeFieldType;
  required: boolean;
  /** Faz parte da chave `primary`: é por ele que a linha acha o registro que já existe. */
  primary: boolean;
  /** Numa referência, as chaves do alvo por que a célula pode procurá-lo em vez de trazer o id. */
  lookupKeys: ImportLookupKey[];
}

/** As chaves de um campo só do alvo de uma referência, com o rótulo do campo de cada uma. */
const lookupKeysOf = (ctx: SchemaContext, collection: string, fieldKey: string): ImportLookupKey[] => {
  const target = resolveImportReference(ctx, collection, fieldKey);
  if (!target) return [];
  const targetFields = resolveEntity(ctx, target.collection)?.fields ?? [];
  return importLookupKeys(ctx, target.collection).map((key) => ({
    key: key.name,
    label: targetFields.find((field) => field.key === key.fields[0])?.label ?? key.fields[0],
  }));
};

/**
 * Os campos que uma coluna pode preencher: os que o `upsert` aceita gravar (nem de sistema, nem
 * sequência, nem através de referência), menos os que um arquivo não tem como trazer — arquivo, objeto
 * aninhado, agregado e derivado. A pergunta "pode gravar?" é a do caminho de gravação
 * (`validateWritablePath`), não uma lista nova.
 *
 * `lockedFieldKey` é o vínculo com o pai na importação feita na aba dele: quem o grava é o servidor, e
 * ele não é coluna.
 */
export const importableFields = (
  ctx: SchemaContext,
  collection: string,
  options: { lockedFieldKey?: string } = {},
): ImportableField[] => {
  const entity = resolveEntity(ctx, collection);
  if (!entity) return [];
  const derived = collectDerivedFieldKeys(ctx, collection);
  const primary = new Set(resolveEntityKeys(ctx, collection).find((key) => key.kind === 'primary')?.fields ?? []);
  return entity.fields
    .filter((field) => field.key !== options.lockedFieldKey)
    .filter((field) => field.type !== 'object' && field.ui?.control !== 'file' && !field.file && !field.aggregation && !derived.has(field.key))
    .filter((field) => validateWritablePath(ctx, collection, field.key) === undefined)
    .map((field) => ({
      key: field.key,
      label: field.label,
      type: field.type,
      required: field.required === true,
      primary: primary.has(field.key),
      lookupKeys: field.refEntity ? lookupKeysOf(ctx, collection, field.key) : [],
    }));
};

/** Os campos da chave `primary`, na ordem dela — vazio quando a tela não declara uma. */
export const importPrimaryKeyFields = (ctx: SchemaContext, collection: string): string[] =>
  resolveEntityKeys(ctx, collection).find((key) => key.kind === 'primary')?.fields ?? [];

const comparable = (text: string): string =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * A sugestão de mapeamento: a coluna cujo nome é a chave ou o rótulo (já resolvido) do campo, sem
 * caixa, acento nem pontuação. Cada campo recebe no máximo uma coluna — a primeira que casa. A pessoa
 * confere e corrige; a sugestão só poupa o trabalho óbvio.
 */
export const suggestImportMapping = (
  headers: readonly string[],
  fields: readonly ImportableField[],
  labelOf: (field: ImportableField) => string,
): (string | null)[] => {
  const taken = new Set<string>();
  return headers.map((header) => {
    const wanted = comparable(header);
    if (wanted === '') return null;
    const match = fields.find((field) =>
      !taken.has(field.key) && (comparable(field.key) === wanted || comparable(labelOf(field)) === wanted));
    if (!match) return null;
    taken.add(match.key);
    return match.key;
  });
};

export type ImportDecimalSeparator = '.' | ',';
export type ImportDateFormat = 'iso' | 'dmy' | 'mdy';

export interface ImportCellOptions {
  decimalSeparator: ImportDecimalSeparator;
  dateFormat: ImportDateFormat;
}

export type ImportCellOutcome =
  | { ok: true; value: unknown }
  /** A célula vazia não manda nada: na alteração, o campo fica como estava. */
  | { ok: true; skip: true }
  | { ok: false; error: string };

const BOOLEAN_WORDS: Record<string, boolean> = { true: true, false: false, '1': true, '0': false, yes: true, no: false };

const pad = (value: string): string => value.padStart(2, '0');

/** Só um dia que existe: `31/02` não vira `03/03` por arredondamento do `Date`. */
const isoDay = (year: string, month: string, day: string): string | null => {
  const iso = `${year}-${pad(month)}-${pad(day)}`;
  const date = new Date(`${iso}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : null;
};

const parseImportNumber = (text: string, separator: ImportDecimalSeparator): number | null => {
  const compact = text.replace(/\s/g, '');
  const thousands = separator === ',' ? '.' : ',';
  const normalized = compact.split(thousands).join('').replace(separator, '.');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
};

const parseImportDate = (text: string, format: ImportDateFormat): string | null => {
  if (format === 'iso') {
    const day = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
    if (day) return isoDay(day[1], day[2], day[3]);
    return /^\d{4}-\d{2}-\d{2}T/.test(text) && !Number.isNaN(new Date(text).getTime()) ? text : null;
  }
  const parts = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text);
  if (!parts) return null;
  return format === 'dmy' ? isoDay(parts[3], parts[2], parts[1]) : isoDay(parts[3], parts[1], parts[2]);
};

/**
 * Uma célula no tipo do campo. Só o TEXTO é convertido: o valor que veio tipado de um JSON segue como
 * está, e o servidor responde por ele como responde por qualquer gravação.
 *
 * Número e data têm formato DECLARADO na importação, e não adivinhado: `1.234` é mil duzentos e trinta e
 * quatro ou um vírgula dois três quatro conforme quem exportou, e `03/04/2026` é março ou abril pela mesma
 * razão. Adivinhar acertaria quase sempre — e erraria em silêncio no resto.
 */
export const coerceImportCell = (raw: unknown, type: NativeFieldType, options: ImportCellOptions): ImportCellOutcome => {
  if (raw === undefined) return { ok: true, skip: true };
  if (typeof raw !== 'string') return { ok: true, value: raw };
  const text = raw.trim();
  if (text === '') return { ok: true, skip: true };
  switch (type) {
    case 'number': {
      const value = parseImportNumber(text, options.decimalSeparator);
      return value === null ? { ok: false, error: '@core.records/import.cell.not-a-number' } : { ok: true, value };
    }
    case 'boolean': {
      const value = BOOLEAN_WORDS[text.toLowerCase()];
      return value === undefined ? { ok: false, error: '@core.records/import.cell.not-a-boolean' } : { ok: true, value };
    }
    case 'date': {
      const value = parseImportDate(text, options.dateFormat);
      return value === null ? { ok: false, error: '@core.records/import.cell.not-a-date' } : { ok: true, value };
    }
    case 'stringArray':
      return {
        ok: true,
        value: text.split(RECORD_IMPORT_LIST_SEPARATOR).map((item) => item.trim()).filter((item) => item !== ''),
      };
    default:
      return { ok: true, value: raw };
  }
};

export interface ImportRowsOutcome {
  rows: RecordImportRow[];
  /** As linhas que nem chegam ao servidor: célula que não converte, ou nada mapeado com valor. */
  rejected: RecordImportRowResult[];
}

/**
 * As linhas prontas para o servidor. `mapping[i]` é o campo da coluna `i` (ou `null`, coluna ignorada).
 * A linha com uma célula que não converte é recusada AQUI, pela primeira célula ruim — mandar a linha sem
 * aquele campo gravaria um registro diferente do arquivo.
 */
export const buildImportRows = (
  table: ImportTable,
  mapping: readonly (string | null)[],
  fields: readonly ImportableField[],
  options: ImportCellOptions,
): ImportRowsOutcome => {
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const rows: RecordImportRow[] = [];
  const rejected: RecordImportRowResult[] = [];
  for (const source of table.rows) {
    const data: Record<string, unknown> = {};
    let failure: RecordImportRowResult | null = null;
    for (const [column, fieldKey] of mapping.entries()) {
      const field = fieldKey ? byKey.get(fieldKey) : undefined;
      if (!field) continue;
      const outcome = coerceImportCell(source.cells[column], field.type, options);
      if (!outcome.ok) {
        failure = {
          line: source.line,
          status: 'failed',
          error: outcome.error,
          errorParams: { column: table.headers[column] ?? String(column + 1), value: String(source.cells[column]) },
        };
        break;
      }
      if (!('skip' in outcome)) data[field.key] = outcome.value;
    }
    if (failure) rejected.push(failure);
    else if (Object.keys(data).length === 0) {
      rejected.push({ line: source.line, status: 'failed', error: '@core.records/import.row.empty' });
    } else rows.push({ line: source.line, data });
  }
  return { rows, rejected };
};

/** O mapeamento que não pode seguir: nada mapeado, ou o mesmo campo em duas colunas. REFERÊNCIA, ou `null`. */
export const importMappingIssue = (mapping: readonly (string | null)[]): string | null => {
  const mapped = mapping.filter((key): key is string => key !== null);
  if (mapped.length === 0) return '@core.records/import.mapping.empty';
  return new Set(mapped).size === mapped.length ? null : '@core.records/import.mapping.duplicate';
};
