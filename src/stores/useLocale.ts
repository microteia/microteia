import { createContext, useContext } from 'react';
import type { LocaleCode } from '../domain/schema/i18n/localeNegotiation';
import type { MessageCatalog } from '../domain/schema/i18n/messages';

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
