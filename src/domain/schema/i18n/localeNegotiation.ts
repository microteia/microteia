/**
 * Identificação e negociação de idioma — BCP-47 sem dependência externa, no mesmo espírito de
 * `plugin/semver.ts`: o kernel precisa comparar idiomas em dois runtimes e não pode pagar uma
 * biblioteca por isso.
 *
 * `LocaleCode` é `string` de propósito, e não uma união fechada. Uma união exigiria um commit no
 * núcleo para cada idioma novo — exatamente o oposto da pedra fundamental. Quem decide que idiomas
 * existem é o conjunto de pacotes instalados.
 */
export type LocaleCode = string;

/** O idioma da FONTE. Todo texto nasce aqui, e todo outro idioma é uma tradução dele. */
export const DEFAULT_LOCALE: LocaleCode = 'en';

/**
 * Normaliza para a forma canônica do BCP-47. Cada tipo de subtag tem a SUA caixa, e não uma só:
 * idioma em minúsculas (`pt`), escrita em Title Case com quatro letras (`Hans`), região em
 * maiúsculas com duas letras ou em três dígitos (`BR`, `419`).
 *
 * Aceita `pt_br`, `PT-BR` e `pt-br` porque as três aparecem em arquivo escrito à mão, e recusar uma
 * tradução por causa de um sublinhado seria hostilidade sem ganho.
 */
export const normalizeLocale = (value: unknown): LocaleCode => {
  const raw = typeof value === 'string' ? value.trim().replace(/_/g, '-') : '';
  if (raw === '') return '';
  const [language, ...rest] = raw.split('-');
  const parts = [language.toLowerCase()];
  for (const part of rest) {
    if (part.length === 0) continue;
    if (part.length === 4 && /^[a-zA-Z]+$/.test(part)) {
      parts.push(part[0].toUpperCase() + part.slice(1).toLowerCase());
    } else if (part.length === 2 && /^[a-zA-Z]+$/.test(part)) {
      parts.push(part.toUpperCase());
    } else {
      parts.push(part.toLowerCase());
    }
  }
  return parts.join('-');
};

export const isValidLocale = (value: unknown): boolean => /^[a-z]{2,3}(-[A-Za-z0-9]+)*$/.test(normalizeLocale(value));

/**
 * A cadeia do mais específico ao mais genérico: `pt-BR` → `['pt-BR', 'pt']`. É o que permite a uma
 * tradução de `pt` cobrir o que o pacote `pt-BR` não traduziu, em vez de cair direto no inglês.
 */
export const localeChain = (locale: LocaleCode): LocaleCode[] => {
  const normalized = normalizeLocale(locale);
  if (normalized === '') return [];
  const parts = normalized.split('-');
  const chain: LocaleCode[] = [];
  for (let size = parts.length; size > 0; size -= 1) chain.push(parts.slice(0, size).join('-'));
  return chain;
};

/**
 * O idioma efetivo: o primeiro da cadeia do pedido que exista entre os disponíveis. Sem candidato,
 * devolve o `fallback` — nunca string vazia, porque quem chama vai usar isso para formatar data.
 */
export const negotiateLocale = (
  requested: LocaleCode,
  available: LocaleCode[],
  fallback: LocaleCode = DEFAULT_LOCALE,
): LocaleCode => {
  const offered = new Map(available.map((locale) => [normalizeLocale(locale), normalizeLocale(locale)]));
  for (const candidate of localeChain(requested)) {
    const match = offered.get(candidate);
    if (match) return match;
  }
  return normalizeLocale(fallback) || DEFAULT_LOCALE;
};

/**
 * A ordem em que os catálogos se empilham: do mais genérico ao mais específico, com o idioma-fonte
 * na base. Quem constrói o catálogo aplica nesta ordem, deixando o mais específico sobrepor.
 */
export const resolutionOrder = (
  locale: LocaleCode,
  fallback: LocaleCode = DEFAULT_LOCALE,
): LocaleCode[] => {
  const chain = localeChain(locale);
  const base = normalizeLocale(fallback) || DEFAULT_LOCALE;
  const ordered = chain.includes(base) ? [...chain] : [...chain, base];
  return ordered.reverse();
};
