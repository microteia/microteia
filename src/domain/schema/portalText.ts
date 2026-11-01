/**
 * O TEXTO do portal — o conteúdo dos nós `markdown` das páginas e cartões declarados — e a edição dele
 * pelo escritório (`portalTexts`).
 *
 * O texto nasce num bundle de mensagens: o da própria extensão, ou o de outra que só o traz (a lei de um
 * município, instalada como um pacote de tradução). Quem tem `portal.content` pode trocá-lo no escritório,
 * por idioma, e a edição vence o bundle NO MESMO IDIOMA; apagá-la volta ao texto do pacote.
 *
 * A edição só alcança o conteúdo dos nós `markdown`: ela entra num catálogo PRÓPRIO, montado só para eles
 * (`portalContentOf`), e nunca no que resolve título, rótulo ou frase do produto. Um documento que cite a
 * chave de um botão do kernel não muda botão nenhum.
 *
 * Este arquivo é compartilhado com `functions/` (`SHARED_FILES`).
 */

import { PORTAL_TEXTS_COLLECTION } from './portalCollections';
import { parseMessageRef } from './i18n/messageRef';
import { buildMessageCatalog, type MessageBundle } from './i18n/messages';
import { DEFAULT_LOCALE, isValidLocale, normalizeLocale } from './i18n/localeNegotiation';

export { PORTAL_TEXTS_COLLECTION };

/**
 * O teto de um texto, por idioma. A Auditoria guarda o antes e o depois da alteração no mesmo log, e o
 * documento do Firestore não passa de 1 MiB: dois textos neste teto ainda cabem com folga.
 */
export const PORTAL_TEXT_MAX_LENGTH = 100_000;

/** Quantos idiomas um texto editado pode ter — o teto que a regra do Firestore também cobra. */
export const PORTAL_TEXT_MAX_LOCALES = 20;

/** O texto editado de UMA referência, em cada idioma em que o escritório o escreveu. */
export interface PortalTextOverride {
  /** A referência de mensagem (`@ns/chave`) cujo texto foi trocado. */
  ref: string;
  /** Idioma (normalizado) → texto. */
  texts: Record<string, string>;
}

/**
 * O id do documento de uma referência. A barra não cabe num id do Firestore; os dois-pontos não cabem
 * num namespace nem numa chave de mensagem, e por isso a troca é reversível. `null` quando o valor não é
 * uma referência.
 */
export const portalTextDocId = (ref: string): string | null => {
  const parsed = parseMessageRef(ref);
  return parsed ? `${parsed.namespace}:${parsed.key}` : null;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * O documento lido com desconfiança: referência válida, idiomas válidos, texto não vazio e no teto. O que
 * não serve é descartado; sem nenhum texto aproveitável, `null` — vale o do pacote.
 */
export const asPortalTextOverride = (data: unknown): PortalTextOverride | null => {
  if (!isPlainObject(data) || typeof data.ref !== 'string' || !parseMessageRef(data.ref)) return null;
  const texts: Record<string, string> = {};
  if (isPlainObject(data.texts)) {
    for (const [locale, text] of Object.entries(data.texts)) {
      if (!isValidLocale(locale) || typeof text !== 'string' || text.trim() === '') continue;
      if (text.length > PORTAL_TEXT_MAX_LENGTH) continue;
      texts[normalizeLocale(locale)] = text;
    }
  }
  return Object.keys(texts).length > 0 ? { ref: data.ref, texts } : null;
};

/** As edições como bundles — um por referência e idioma —, para entrarem na fusão do catálogo. */
const overrideBundles = (overrides: readonly PortalTextOverride[]): MessageBundle[] =>
  overrides.flatMap((override) => {
    const parsed = parseMessageRef(override.ref);
    if (!parsed) return [];
    return Object.entries(override.texts).map(([locale, text]) => ({
      locale,
      namespace: parsed.namespace,
      messages: { [parsed.key]: text },
    }));
  });

/**
 * O texto de cada referência de conteúdo no idioma de quem lê: `null` quando nem a edição nem bundle
 * nenhum tem a chave — e então o nó não aparece, em vez de mostrar a referência crua.
 *
 * É a fusão de `buildMessageCatalog`, com as edições na FRENTE dos bundles. Daí saem as duas regras sem
 * código próprio: no mesmo idioma a edição vence (quem chega primeiro fica com a chave), e entre idiomas
 * o mais específico vence — a edição em `en` não passa por cima do texto `pt-BR` do pacote para quem lê
 * em português.
 */
export const portalContentOf = (
  bundles: readonly MessageBundle[],
  overrides: readonly PortalTextOverride[],
  locale: string,
): ((ref: string) => string | null) => {
  const catalog = buildMessageCatalog(
    [...overrideBundles(overrides), ...bundles],
    normalizeLocale(locale) || DEFAULT_LOCALE,
  );
  return (ref) => {
    const parsed = parseMessageRef(ref);
    return parsed ? catalog.messages[parsed.full] ?? null : null;
  };
};
