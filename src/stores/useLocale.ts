import { createContext, useContext } from 'react';
import type { LocaleCode } from '../domain/schema/i18n/localeNegotiation';
import { DEFAULT_LOCALE } from '../domain/schema/i18n/localeNegotiation';
import type { MessageCatalog } from '../domain/schema/i18n/messages';
import { emptyCatalog } from '../domain/schema/i18n/messages';

export interface LocaleContextValue {
  /** O idioma em vigor, já negociado contra o que está instalado. */
  locale: LocaleCode;
  /** O que o usuário escolheu, antes da negociação. `null` enquanto ninguém escolheu nada. */
  preferred: LocaleCode | null;
  /** Os idiomas com ao menos um catálogo instalado, incluindo sempre o idioma-fonte. */
  available: LocaleCode[];
  catalog: MessageCatalog;
  /**
   * Troca o idioma. Grava no `localStorage` sempre — é o que faz a escolha valer nas telas públicas,
   * antes de haver escritório. Dentro do escritório, quem manda é a configuração `i18n.locale`.
   */
  setLocale: (locale: LocaleCode) => void;
}

export const LocaleContext = createContext<LocaleContextValue | null>(null);

export const useLocale = (): LocaleContextValue => {
  const context = useContext(LocaleContext);
  if (!context) throw new Error('useLocale precisa estar dentro de <LocaleProvider>');
  return context;
};

/**
 * O contexto de idioma quando ele PODE não existir — é o que `useT` e `useLabel` usam.
 *
 * Traduzir passou a acontecer em toda parte, inclusive em componente montado fora da árvore do
 * provedor: um átomo renderizado isoladamente num teste, um `WidgetRenderer` de extensão instanciado
 * à parte. Lançar ali derrubaria a tela inteira por causa de um rótulo, e a regra do motor de idioma
 * é a oposta — chave sem catálogo devolve a própria chave, nunca uma exceção.
 *
 * `useLocale` continua estrito de propósito: quem lê `available`/`setLocale` está construindo o
 * seletor de idioma, e ali estar fora do provedor É um erro de montagem.
 */
export const useOptionalLocale = (): LocaleContextValue =>
  useContext(LocaleContext) ?? FALLBACK_LOCALE_CONTEXT;

const FALLBACK_LOCALE_CONTEXT: LocaleContextValue = {
  locale: DEFAULT_LOCALE,
  preferred: null,
  available: [DEFAULT_LOCALE],
  catalog: emptyCatalog(DEFAULT_LOCALE),
  setLocale: () => {},
};
