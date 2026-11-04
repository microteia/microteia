// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/recordSearch.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/recordSearch.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import type { FieldDefinition } from '../entities/entitySchemas';

/**
 * Onde o registro guarda os termos pelos quais ele é ACHADO.
 *
 * A listagem carrega os 500 mais recentes de cada coleção, e toda busca que rodava sobre esse
 * conjunto — o ⌘K, a caixa de filtro, o seletor de referência — deixava de achar o registro 501 sem
 * avisar ninguém. O Firestore não busca "contém o texto", mas busca `array-contains` sobre um array
 * com índice de campo ÚNICO, que ele cria sozinho: é o que deixa uma coleção criada em runtime, que
 * não tem como declarar índice composto, ser pesquisada no servidor.
 *
 * Quem grava o campo é o backend, nunca o cliente (a regra recusa): os termos dependem do título de
 * registros de OUTRAS coleções, e só um caminho que vê todas as gravações — formulário, automação,
 * MCP, portal — os mantém coerentes.
 */
export const RECORD_SEARCH_FIELD = 'searchTerms';

/** Prefixo mais curto guardado: uma letra casaria metade da coleção e não ajudaria ninguém. */
export const SEARCH_MIN_TERM_LENGTH = 2;

/**
 * Prefixo mais longo guardado. Ninguém digita mais que isso para achar um registro, e o número de
 * processo (20 dígitos) cabe inteiro. O termo pedido é cortado no mesmo ponto, e é isso que faz a
 * palavra longa continuar sendo achada.
 */
export const SEARCH_MAX_TERM_LENGTH = 20;

/**
 * Teto de termos por registro. O Firestore aceita 40 mil entradas de índice por documento; o teto
 * existe para o custo de gravação e de leitura não crescer com um campo de texto longo. Os termos do
 * TÍTULO vêm primeiro, e por isso nunca são os cortados.
 */
export const SEARCH_MAX_TERMS = 400;

/**
 * Os tipos que podem ser pesquisáveis. Arquivo é URL, markdown é texto longo que estouraria o teto e
 * afogaria o título, e data, número e caixa de seleção se pedem por intervalo ou igualdade — que é o
 * filtro da listagem, não a busca.
 */
export const SEARCHABLE_FIELD_TYPES: ReadonlySet<string> = new Set(['text', 'textarea', 'masked', 'select', 'reference']);

export const isSearchableFieldType = (type: string): boolean => SEARCHABLE_FIELD_TYPES.has(type);

const COMBINING_MARKS = /[̀-ͯ]/g;
const WORD_SEPARATOR = /[^a-z0-9]+/;
const DIGIT = /[0-9]/;
const NON_DIGIT = /[^0-9]/g;

const normalize = (text: string): string => text.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase();

/**
 * As palavras de um texto, sem acento e em minúsculas.
 *
 * Um trecho com dígitos e pontuação ganha também a versão SÓ com os dígitos: um número de processo
 * ("8227479-19.2026.8.05.0001") ou um CPF gravado formatado viram uma palavra só, e quem digita o
 * começo do número, com ou sem pontuação, acha o registro.
 */
const wordsOf = (text: string): string[] => {
  const words: string[] = [];
  for (const chunk of normalize(text).split(/\s+/)) {
    const parts = chunk.split(WORD_SEPARATOR).filter((part) => part !== '');
    words.push(...parts);
    if (parts.length > 1 && DIGIT.test(chunk)) {
      const digits = chunk.replace(NON_DIGIT, '');
      if (digits.length >= SEARCH_MIN_TERM_LENGTH) words.push(digits);
    }
  }
  return words.filter((word) => word.length >= SEARCH_MIN_TERM_LENGTH);
};

const prefixesOf = (word: string): string[] => {
  const last = Math.min(word.length, SEARCH_MAX_TERM_LENGTH);
  const prefixes: string[] = [];
  for (let length = SEARCH_MIN_TERM_LENGTH; length <= last; length += 1) prefixes.push(word.slice(0, length));
  return prefixes;
};

/**
 * Os termos que um registro grava, a partir dos textos que o nomeiam — na ordem em que vêm, sem
 * repetição e até o teto. Cada palavra entra com todos os prefixos: é o que faz "curat" achar
 * "Curatela" com uma igualdade de array.
 */
export const searchTermsOf = (texts: readonly string[]): string[] => {
  const terms = new Set<string>();
  for (const text of texts) {
    for (const word of wordsOf(text)) {
      for (const prefix of prefixesOf(word)) {
        if (terms.size >= SEARCH_MAX_TERMS) return [...terms];
        terms.add(prefix);
      }
    }
  }
  return [...terms];
};

/**
 * O que a pessoa digitou, tratado como os termos foram gravados: as mesmas palavras, cortadas no
 * mesmo comprimento. Uma função só para os dois lados é o que garante que "Família" digitado acha
 * "familia" gravado.
 */
export const searchQueryTerms = (input: string): string[] =>
  [...new Set(wordsOf(input).map((word) => word.slice(0, SEARCH_MAX_TERM_LENGTH)))];

/**
 * O termo que vai ao servidor. O Firestore aceita um `array-contains` por consulta, e o mais longo é
 * o que menos casa — a janela que volta tem mais chance de conter o registro procurado.
 */
export const pickServerSearchTerm = (terms: readonly string[]): string | undefined =>
  terms.reduce<string | undefined>((best, term) => (best === undefined || term.length > best.length ? term : best), undefined);

/** O registro tem TODAS as palavras pedidas? As que não foram ao servidor são conferidas aqui. */
export const matchesSearchTerms = (stored: unknown, terms: readonly string[]): boolean => {
  if (!Array.isArray(stored)) return false;
  const own = new Set(stored.filter((term): term is string => typeof term === 'string'));
  return terms.every((term) => own.has(term));
};

/** Os termos gravados num documento, ou `[]` quando ele ainda não tem nenhum. */
export const storedSearchTerms = (data: Record<string, unknown> | null | undefined): string[] => {
  const raw = data?.[RECORD_SEARCH_FIELD];
  return Array.isArray(raw) ? raw.filter((term): term is string => typeof term === 'string') : [];
};

export const sameSearchTerms = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((term, index) => term === right[index]);

// ─── O que nomeia um registro ─────────────────────────────────────────────────

/** A parte da tela que a busca lê. É `SchemaScreen` e `ScreenDefinition`, sem exigir nenhum dos dois. */
export interface SearchScreen {
  titleFieldKey?: string | null;
  fields: readonly FieldDefinition[];
}

/**
 * Os campos que entram na busca: o do TÍTULO sempre, sem declarar nada, e os marcados `searchable`
 * cujo tipo a busca sabe ler. Um `searchable` num tipo que ela não lê é recusado na autoria; aqui ele
 * só não entra.
 */
export const searchFieldsOf = (screen: SearchScreen): FieldDefinition[] => {
  const title = screen.titleFieldKey ? screen.fields.find((field) => field.key === screen.titleFieldKey) : undefined;
  const declared = screen.fields.filter(
    (field) => field !== title && field.searchable === true && isSearchableFieldType(field.type),
  );
  return title ? [title, ...declared] : declared;
};

/** O que precisa ser lido ANTES de derivar os termos: os registros que os campos de referência apontam. */
export interface SearchReferenceNeed {
  collection: string;
  ids: string[];
}

const idsOf = (value: unknown): string[] => {
  if (typeof value === 'string') return value.trim() === '' ? [] : [value];
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string' && id.trim() !== '') : [];
};

/**
 * Os registros apontados pelos campos de referência que entram na busca, agrupados por coleção —
 * para quem deriva os termos ler tudo em uma consulta por coleção, e não um registro por vez.
 */
export const searchReferencesOf = (screen: SearchScreen, data: Record<string, unknown>): SearchReferenceNeed[] => {
  const byCollection = new Map<string, Set<string>>();
  for (const field of searchFieldsOf(screen)) {
    if (field.type !== 'reference' || !field.refEntity) continue;
    const ids = byCollection.get(field.refEntity) ?? new Set<string>();
    for (const id of idsOf(data[field.key])) ids.add(id);
    byCollection.set(field.refEntity, ids);
  }
  return [...byCollection]
    .filter(([, ids]) => ids.size > 0)
    .map(([collection, ids]) => ({ collection, ids: [...ids] }));
};

/**
 * De onde vem o texto que não está no próprio registro. Quem chama já leu o que
 * `searchReferencesOf` pediu, e devolve o texto pronto: o rótulo de opção que é referência de
 * mensagem (`@namespace/chave`) chega aqui já traduzido.
 */
export interface SearchTextSources {
  referenceTitle: (collection: string, id: string) => string | undefined;
  optionLabel: (field: FieldDefinition, key: string) => string | undefined;
}

const textsOfField = (field: FieldDefinition, value: unknown, sources: SearchTextSources): string[] => {
  if (field.type === 'reference') {
    if (!field.refEntity) return [];
    const collection = field.refEntity;
    return idsOf(value)
      .map((id) => sources.referenceTitle(collection, id))
      .filter((title): title is string => !!title);
  }
  if (field.type === 'select') {
    return idsOf(value).map((key) => sources.optionLabel(field, key) ?? key);
  }
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  return [];
};

/**
 * Os termos de um registro. Uma referência sem título conhecido — o registro apontado foi excluído,
 * ou ainda não foi lido — simplesmente não contribui: o registro continua achável pelo resto.
 */
export const recordSearchTerms = (
  screen: SearchScreen,
  data: Record<string, unknown>,
  sources: SearchTextSources,
): string[] => searchTermsOf(searchFieldsOf(screen).flatMap((field) => textsOfField(field, data[field.key], sources)));

// ─── Quem aponta para quem ────────────────────────────────────────────────────

/** Um campo pesquisável que guarda o id de um registro da coleção apontada. */
export interface SearchReferrer {
  /** A coleção do registro que GUARDA a referência — a que precisa ser rederivada. */
  collection: string;
  fieldKey: string;
  multi: boolean;
}

/**
 * Os campos que levam o título de um registro de `target` para os termos de outra coleção. É a
 * pergunta que a propagação faz quando esse título muda: sem ela, renomear uma pessoa deixaria todo
 * processo em que ela é parte achável só pelo nome antigo.
 */
export const searchReferrersOf = (
  screens: readonly (SearchScreen & { collection: string })[],
  target: string,
): SearchReferrer[] => {
  const seen = new Set<string>();
  const referrers: SearchReferrer[] = [];
  for (const screen of screens) {
    for (const field of searchFieldsOf(screen)) {
      if (field.type !== 'reference' || field.refEntity !== target) continue;
      const id = `${screen.collection}/${field.key}`;
      if (seen.has(id)) continue;
      seen.add(id);
      referrers.push({ collection: screen.collection, fieldKey: field.key, multi: field.multi === true });
    }
  }
  return referrers;
};

/**
 * Os campos de lista que levam o rótulo de uma opção de `lookupCollection` para os termos. É a
 * contrapartida de `searchReferrersOf` para quando o escritório renomeia uma opção: o registro guarda
 * a chave, e o rótulo novo só chega aos termos rederivando quem a guarda.
 */
export const searchLookupReferrersOf = (
  screens: readonly (SearchScreen & { collection: string })[],
  lookupCollection: string,
): SearchReferrer[] => {
  const seen = new Set<string>();
  const referrers: SearchReferrer[] = [];
  for (const screen of screens) {
    for (const field of searchFieldsOf(screen)) {
      if (field.type !== 'select' || field.lookupCollection !== lookupCollection) continue;
      const id = `${screen.collection}/${field.key}`;
      if (seen.has(id)) continue;
      seen.add(id);
      referrers.push({ collection: screen.collection, fieldKey: field.key, multi: field.multi === true });
    }
  }
  return referrers;
};

// ─── O título que vai para quem aponta ────────────────────────────────────────

/**
 * O texto do título de um registro, como ele entra nos termos de QUEM o aponta. Um nível só: o título
 * que é ele mesmo uma referência não é seguido — a cadeia não tem fim conhecido, e cada salto seria uma
 * leitura por registro derivado.
 */
export const recordSearchTitle = (
  screen: SearchScreen,
  data: Record<string, unknown> | null | undefined,
  optionLabel: (field: FieldDefinition, key: string) => string | undefined = () => undefined,
): string => {
  if (!data || !screen.titleFieldKey) return '';
  const field = screen.fields.find((candidate) => candidate.key === screen.titleFieldKey);
  const value = data[screen.titleFieldKey];
  if (field?.type === 'reference') return '';
  if (field?.type === 'select') return idsOf(value).map((key) => optionLabel(field, key) ?? key).join(' ');
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  return '';
};

// ─── A passada sobre os registros que já existem ──────────────────────────────

/**
 * Sobe quando a NORMALIZAÇÃO muda — o corte, os prefixos, o tratamento dos dígitos. A assinatura da
 * coleção carrega este número, e uma regra nova de termo rederiva todos os registros sozinha, em vez
 * de deixar os antigos com a regra velha até alguém os editar.
 */
export const RECORD_SEARCH_VERSION = 1;

/**
 * A partir de qual `KERNEL_VERSION` um registro é achado pelos campos `searchable`. É o que o guia de
 * autoria cita.
 */
export const RECORD_SEARCH_SINCE_KERNEL = '2.95.0';

/**
 * Os jobs da busca: `backfill:<coleção>` rederiva a coleção inteira quando o que entra na busca muda;
 * `propagate:<coleção>:<id>` rederiva quem aponta para um registro (ou para uma opção de lista) cujo
 * título mudou.
 */
export const RECORD_SEARCH_JOBS_COLLECTION = 'record_search_jobs';

/** Registros por rodada. Cada rodada é uma execução de function: a coleção grande vira muitas curtas. */
export const RECORD_SEARCH_ROUND_SIZE = 200;

/** Sem gravação no job por mais que isto, a passada `running` está parada e pode ser acordada. */
export const RECORD_SEARCH_STALL_MS = 10 * 60_000;

export const recordSearchBackfillJobId = (collection: string): string => `backfill:${collection}`;

export const recordSearchPropagationJobId = (collection: string, id: string): string => `propagate:${collection}:${id}`;

/**
 * A identidade do que entra na busca de uma coleção: só o que muda os TERMOS. Rótulo do campo, ordem e
 * seção ficam fora — renomear um rótulo não pode rederivar uma coleção de milhares de registros.
 */
export const recordSearchSignature = (screen: SearchScreen): string =>
  JSON.stringify([
    RECORD_SEARCH_VERSION,
    screen.titleFieldKey ?? '',
    searchFieldsOf(screen).map((field) => [
      field.key,
      field.type,
      field.refEntity ?? null,
      field.lookupCollection ?? null,
      (field.options ?? []).map((option) => [option.key, option.label]),
    ]),
  ]);

/**
 * Uma varredura do job. Sem `fieldKey`, é a coleção inteira (o backfill); com ele, só os registros em
 * que o campo guarda `value` — o id do registro renomeado ou a chave da opção cujo rótulo mudou.
 */
export interface RecordSearchScan {
  collection: string;
  fieldKey: string | null;
  multi: boolean;
  value: string | null;
}

export type RecordSearchJobKind = 'backfill' | 'propagate';
export type RecordSearchJobStatus = 'running' | 'done';

export interface RecordSearchJobState {
  kind: RecordSearchJobKind;
  status: RecordSearchJobStatus;
  /** Backfill: a assinatura que a passada deriva. Com `done`, é o que já vale em toda a coleção. */
  signature: string | null;
  scans: RecordSearchScan[];
  scanIndex: number;
  /** Id do último registro processado na varredura em curso; `null` = começo. */
  cursor: string | null;
  /** Sobe a cada passada nova: a rodada de uma passada abandonada não grava sobre a seguinte. */
  generation: number;
  round: number;
  touchedAt: number;
  processed: number;
  written: number;
  failed: number;
}

export const isRecordSearchJobStalled = (state: RecordSearchJobState, now: number): boolean =>
  state.status === 'running' && now - state.touchedAt > RECORD_SEARCH_STALL_MS;

/** O job novo — ou o recomeço de um que já existia, com a geração seguinte. */
export const startRecordSearchJob = (
  kind: RecordSearchJobKind,
  scans: RecordSearchScan[],
  signature: string | null,
  previous: RecordSearchJobState | null,
  now: number,
): RecordSearchJobState => ({
  kind,
  status: 'running',
  signature,
  scans,
  scanIndex: 0,
  cursor: null,
  generation: (previous?.generation ?? 0) + 1,
  round: 0,
  touchedAt: now,
  processed: 0,
  written: 0,
  failed: 0,
});

/**
 * O que fazer com o backfill de uma coleção, dado o que ela declara agora: `start` quando a
 * assinatura não é a que o job derivou (ou derivou por último, se ainda corre) — inclusive quando o
 * job nunca existiu, que é o escritório que atualiza o kernel com registros antigos —; `nudge` quando
 * a passada parou; `none` no resto.
 */
export type RecordSearchBackfillPlan = { kind: 'none' } | { kind: 'start' } | { kind: 'nudge' };

export const planRecordSearchBackfill = (
  signature: string,
  state: RecordSearchJobState | null,
  now: number,
): RecordSearchBackfillPlan => {
  if (!state || state.signature !== signature) return { kind: 'start' };
  return isRecordSearchJobStalled(state, now) ? { kind: 'nudge' } : { kind: 'none' };
};

const asCount = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;

const asText = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

const readScan = (raw: unknown): RecordSearchScan | null => {
  const entry = raw as Record<string, unknown> | null;
  const collection = asText(entry?.collection);
  if (!collection) return null;
  return { collection, fieldKey: asText(entry?.fieldKey), multi: entry?.multi === true, value: asText(entry?.value) };
};

/** Lê o documento do job sem confiar na forma — um campo ausente vale o neutro dele. */
export const readRecordSearchJobState = (data: Record<string, unknown>): RecordSearchJobState => ({
  kind: data.kind === 'propagate' ? 'propagate' : 'backfill',
  status: data.status === 'running' ? 'running' : 'done',
  signature: asText(data.signature),
  scans: Array.isArray(data.scans)
    ? data.scans.map(readScan).filter((scan): scan is RecordSearchScan => scan !== null)
    : [],
  scanIndex: asCount(data.scanIndex),
  cursor: asText(data.cursor),
  generation: asCount(data.generation),
  round: asCount(data.round),
  touchedAt: asCount(data.touchedAt),
  processed: asCount(data.processed),
  written: asCount(data.written),
  failed: asCount(data.failed),
});
