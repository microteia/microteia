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
