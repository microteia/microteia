// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/i18n/messages.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

import type { LocaleCode } from './localeNegotiation';
import { DEFAULT_LOCALE, isValidLocale, normalizeLocale, resolutionOrder } from './localeNegotiation';

/**
 * Um CATÁLOGO de mensagens de um plugin, para um idioma. É a `metadata` de uma contribuição ao ponto
 * `i18n.messages` — dado 100% serializável, sem função e sem componente, porque viaja no pacote até
 * um escritório que não roda este bundle.
 *
 * `namespace` é o id do plugin DONO do texto, e não de quem traduz: um pacote de tradução de terceiro
 * declara `namespace: 'core.ui'` para traduzir a barra lateral. É essa separação que permite instalar
 * um pacote só de traduções cobrindo o kernel e as extensões de uma vez.
 */
export interface MessageBundle {
  locale: LocaleCode;
  namespace: string;
  messages: Record<string, string>;
}

/** O catálogo já resolvido para um idioma: chaves plenamente qualificadas (`namespace/chave`). */
export interface MessageCatalog {
  locale: LocaleCode;
  messages: Record<string, string>;
}

export type MessageParams = Record<string, unknown>;

const MESSAGE_KEY_PATTERN = /^[a-z0-9][a-z0-9.-]*$/i;

export const isValidMessageKey = (key: unknown): boolean =>
  typeof key === 'string' && MESSAGE_KEY_PATTERN.test(key);

/**
 * A chave plena. Uma chave que já traz `/` é ABSOLUTA e ignora o namespace de quem chama — é o
 * escape para uma extensão reaproveitar um texto do kernel (`core.ui/action.save`) em vez de
 * traduzir de novo o que já está traduzido.
 */
export const qualifyKey = (namespace: string, key: string): string =>
  key.includes('/') ? key : `${namespace}/${key}`;

export const emptyCatalog = (locale: LocaleCode = DEFAULT_LOCALE): MessageCatalog => ({
  locale: normalizeLocale(locale) || DEFAULT_LOCALE,
  messages: {},
});

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Lê a `metadata` de uma contribuição como bundle. Nunca lança e nunca aproveita pela metade: uma
 * metadata malformada devolve `null` e a contribuição é simplesmente ignorada, no mesmo contrato de
 * tolerância dos presets de campo — um pacote quebrado não pode deixar a tela sem texto.
 */
export const asMessageBundle = (metadata: unknown): MessageBundle | null => {
  if (!isPlainObject(metadata)) return null;
  const { locale, namespace, messages } = metadata;
  if (!isValidLocale(locale)) return null;
  if (typeof namespace !== 'string' || namespace.trim() === '') return null;
  if (!isPlainObject(messages)) return null;

  const entries: Record<string, string> = {};
  for (const [key, value] of Object.entries(messages)) {
    if (typeof value !== 'string') continue;
    if (!isValidMessageKey(key)) continue;
    entries[key] = value;
  }
  return { locale: normalizeLocale(locale), namespace: namespace.trim(), messages: entries };
};

/**
 * Funde os bundles em um catálogo para o idioma pedido.
 *
 * Duas ordens se cruzam aqui, e confundi-las inverteria o resultado:
 *
 * 1. Entre IDIOMAS, o mais específico sobrepõe o mais genérico — `en` na base, depois `pt`, depois
 *    `pt-BR`. É o que faz um pacote regional completar o do idioma em vez de substituí-lo.
 * 2. Dentro do MESMO idioma, quem chega primeiro VENCE e não é sobrescrito. `bundles` chega na ordem
 *    do `ContributionRegistry` (maior prioridade primeiro, empate alfabético por pluginId/id), então
 *    "primeiro vence" significa "maior prioridade vence", de forma determinística entre um boot e
 *    outro. É o mesmo contrato de `fieldRulePresets`: chave já ocupada não é redefinida.
 */
export const buildMessageCatalog = (
  bundles: MessageBundle[],
  locale: LocaleCode,
  fallback: LocaleCode = DEFAULT_LOCALE,
): MessageCatalog => {
  const target = normalizeLocale(locale) || DEFAULT_LOCALE;
  const messages: Record<string, string> = {};

  for (const step of resolutionOrder(target, fallback)) {
    const layer: Record<string, string> = {};
    for (const bundle of bundles) {
      if (normalizeLocale(bundle.locale) !== step) continue;
      for (const [key, value] of Object.entries(bundle.messages)) {
        const full = qualifyKey(bundle.namespace, key);
        if (layer[full] === undefined) layer[full] = value;
      }
    }
    Object.assign(messages, layer);
  }

  return { locale: target, messages };
};

/**
 * Um VALOR de parâmetro pode ser ele próprio uma referência de mensagem. Um diagnóstico que diz
 * `{kind} "{id}" não existe` precisa que `kind` — "a tela", "a automação" — também traduza, e quem o
 * produz é o domínio, que não conhece idioma. Resolver o parâmetro aqui evita que cada consumidor
 * tenha de lembrar quais dos seus parâmetros são referências e quais são dado do escritório.
 */
const resolveParam = (
  catalog: MessageCatalog,
  value: unknown,
  siblings?: MessageParams,
): string => {
  if (typeof value !== 'string' || !value.startsWith('@')) return String(value);
  const match = /^@([a-z0-9][a-z0-9.-]*)\/([a-z0-9][a-z0-9.-]*)$/i.exec(value);
  if (!match) return value;
  // Os parâmetros IRMÃOS descem para a mensagem aninhada. Um erro embrulhado por outro
  // ("[Campo: {field}] {detail}") traz junto o que a frase de dentro precisa interpolar — sem isso,
  // ela apareceria com o próprio `{label}` cru no meio.
  return translate(catalog, `${match[1]}/${match[2]}`, siblings);
};

/**
 * Interpola `{nome}` — a MESMA convenção da função `interpolate` do catálogo de expressões
 * (`fieldExpression.ts`), de propósito: quem escreve uma automação e quem escreve uma tradução não
 * deveriam precisar aprender duas sintaxes para a mesma ideia.
 */
const interpolate = (
  catalog: MessageCatalog,
  template: string,
  params?: MessageParams,
): string => {
  if (!params) return template;
  return template.replace(/\{([\w.]+)\}/g, (match, token: string) => {
    const value = params[token];
    if (value === null || value === undefined) return match;
    return resolveParam(catalog, value, params);
  });
};

/**
 * Plural pelo `Intl.PluralRules`, e não por `n > 1 ? 's' : ''`. A regra do inglês e a do português
 * coincidem; a do polonês tem três formas e a do japonês tem uma. Escrever a condição à mão trava o
 * projeto nas línguas que se parecem com a nossa — que é justamente o que este trabalho desfaz.
 *
 * A convenção é a chave sufixada: `items.one`, `items.other`, `items.many`. Sem sufixo declarado,
 * cai na chave sem sufixo.
 */
const pluralKey = (key: string, count: unknown, locale: LocaleCode): string | null => {
  if (typeof count !== 'number' || !Number.isFinite(count)) return null;
  try {
    return `${key}.${new Intl.PluralRules(locale).select(count)}`;
  } catch {
    return `${key}.other`;
  }
};

/**
 * Resolve uma chave. Chave ausente devolve a PRÓPRIA CHAVE, nunca string vazia: uma tela com
 * `core.ui/nav.settings` escrito nela é feia, mas é diagnosticável e continua clicável — uma tela com
 * botões em branco não é nem uma coisa nem outra. Tolerância a falha é a mesma dos presets de campo:
 * um pacote de tradução desinstalado não pode deixar o sistema inutilizável.
 */
export const translate = (
  catalog: MessageCatalog,
  key: string,
  params?: MessageParams,
): string => {
  if (typeof key !== 'string' || key === '') return '';

  const plural = params ? pluralKey(key, params.count, catalog.locale) : null;
  const found =
    (plural === null ? undefined : catalog.messages[plural]) ?? catalog.messages[key];

  return interpolate(catalog, found ?? key, params);
};

export const hasMessage = (catalog: MessageCatalog, key: string): boolean =>
  catalog.messages[key] !== undefined;

/** As chaves de um namespace, para a tela de traduções montar o modelo de exportação. */
export const messagesOfNamespace = (
  catalog: MessageCatalog,
  namespace: string,
): Record<string, string> => {
  const prefix = `${namespace}/`;
  const entries: Record<string, string> = {};
  for (const [full, value] of Object.entries(catalog.messages)) {
    if (full.startsWith(prefix)) entries[full.slice(prefix.length)] = value;
  }
  return entries;
};

export const namespacesOf = (bundles: MessageBundle[]): string[] =>
  Array.from(new Set(bundles.map((bundle) => bundle.namespace))).sort();

export const localesOf = (bundles: MessageBundle[]): LocaleCode[] =>
  Array.from(new Set(bundles.map((bundle) => normalizeLocale(bundle.locale)))).sort();
