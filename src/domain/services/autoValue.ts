import type { FieldDefinition } from '../entities';

/**
 * O código GERADO de um campo (`autoValue`). O padrão descreve a forma caractere a caractere e o
 * resto é literal:
 *
 * | Símbolo | Produz            |
 * |---------|-------------------|
 * | `A`     | letra maiúscula   |
 * | `0`     | dígito            |
 * | `*`     | letra ou dígito   |
 *
 * `AA0000` produz `KP4821`; `CT-0000/A`, `CT-9317/B`.
 *
 * Sortear é IMPURO: nada aqui pode ser chamado no corpo de um componente ou dentro de um `useMemo` —
 * o lugar é o efeito que semeia o formulário de um registro novo. É a mesma disciplina que a tela
 * fixa de Contrato seguia quando o sorteio vivia em código.
 */
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
const ALPHANUMERIC = `${LETTERS}${DIGITS}`;

const ALPHABET_BY_SYMBOL: Record<string, string> = {
  A: LETTERS,
  '0': DIGITS,
  '*': ALPHANUMERIC,
};

const pick = (alphabet: string): string => alphabet[Math.floor(Math.random() * alphabet.length)];

const generateOnce = (pattern: string): string =>
  [...pattern].map((symbol) => (ALPHABET_BY_SYMBOL[symbol] ? pick(ALPHABET_BY_SYMBOL[symbol]) : symbol)).join('');

/**
 * O padrão produz algum valor variável — senão o "código gerado" seria uma constante repetida em
 * todo registro, e a busca por um livre nunca terminaria.
 */
export const hasGeneratedSymbol = (pattern: string): boolean =>
  [...pattern].some((symbol) => !!ALPHABET_BY_SYMBOL[symbol]);

/**
 * Um código do padrão que ainda não está em `taken`. O limite de tentativas evita o laço infinito
 * quando o espaço do padrão se esgota (um `A` sozinho com as 26 letras usadas): esgotadas, devolve
 * mesmo assim — um valor repetido que o usuário corrige é melhor que um formulário travado.
 */
const MAX_ATTEMPTS = 50;

export const generateAutoValue = (pattern: string, taken: ReadonlySet<string> = new Set()): string => {
  if (!pattern || !hasGeneratedSymbol(pattern)) return pattern;
  let candidate = generateOnce(pattern);
  for (let attempt = 1; attempt < MAX_ATTEMPTS && taken.has(candidate); attempt += 1) {
    candidate = generateOnce(pattern);
  }
  return candidate;
};

/** Os campos que pedem um código gerado, na ordem em que a tela os declara. */
export const autoValueFields = (fields: FieldDefinition[]): { key: string; pattern: string }[] =>
  fields
    .map((field) => ({ key: field.key, pattern: field.autoValue?.pattern?.trim() ?? '' }))
    .filter((field) => hasGeneratedSymbol(field.pattern));
