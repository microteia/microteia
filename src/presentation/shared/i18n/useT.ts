import { useCallback, useMemo } from 'react';
import { useLocale } from '../../../stores/useLocale';
import type { MessageParams } from '../../../domain/schema/i18n/messages';
import { qualifyKey, translate } from '../../../domain/schema/i18n/messages';
import { resolveLabel } from '../../../domain/schema/i18n/messageRef';
import {
  compareTextFor,
  currencyForLocale,
  formatDateFor,
  formatDateTimeFor,
  formatMoneyFor,
  formatNumberFor,
} from '../../../domain/schema/i18n/localeFormat';

export type TranslateFn = (key: string, params?: MessageParams) => string;

/**
 * O tradutor de um NAMESPACE. `useT('core.ui')` devolve um `t('nav.settings')` que resolve
 * `core.ui/nav.settings` — o namespace some das ~4.000 chamadas e reaparece só onde importa.
 *
 * Uma chave com `/` é absoluta e ignora o namespace, que é como uma extensão reaproveita um texto do
 * núcleo (`t('core.ui/action.save')`) em vez de traduzir de novo o que já está traduzido.
 *
 * > Este hook é a ÚNICA exceção à regra "a View só chama `use[Nome]ViewModel()`". Traduzir é leitura
 * > pura de apresentação — sem estado, sem ref, sem efeito —, e obrigar cada literal a atravessar o
 * > ViewModel dobraria a interface de todo ViewModel do projeto sem separar nada que já não esteja
 * > separado. `useState`/`useEffect`/`useRef` na View continuam proibidos.
 */
export const useT = (namespace: string): TranslateFn => {
  const { catalog } = useLocale();
  return useCallback(
    (key, params) => translate(catalog, qualifyKey(namespace, key), params),
    [catalog, namespace],
  );
};

/**
 * Resolve um rótulo DECLARATIVO — o que vem de uma tela, de um campo ou de uma contribuição, e que
 * pode ser tanto uma referência (`@com.acme.docs/screen.title`) quanto o texto que o escritório
 * digitou. Texto comum passa intacto: é o que mantém o dado do escritório fora da tradução.
 */
export const useLabel = (): ((value: string | null | undefined) => string) => {
  const { catalog } = useLocale();
  return useCallback((value) => resolveLabel(catalog, value), [catalog]);
};

export interface LocaleFormatters {
  formatDate: (value: unknown) => string;
  formatDateTime: (value: unknown) => string;
  formatNumber: (value: number | null | undefined, options?: Intl.NumberFormatOptions) => string;
  formatMoney: (value: number | null | undefined, currency?: string) => string;
  compareText: (a: string, b: string) => number;
  /** A moeda padrão do idioma corrente, para quem precisa exibi-la sem escolher uma. */
  currency: string;
}

/** As formatações já presas ao idioma corrente, para não repetir `locale` em cada chamada. */
export const useLocaleFormat = (): LocaleFormatters => {
  const { locale } = useLocale();
  return useMemo(
    () => ({
      formatDate: (value) => formatDateFor(locale, value),
      formatDateTime: (value) => formatDateTimeFor(locale, value),
      formatNumber: (value, options) => formatNumberFor(locale, value, options),
      formatMoney: (value, currency) => formatMoneyFor(locale, value, currency ?? currencyForLocale(locale)),
      compareText: (a, b) => compareTextFor(locale, a, b),
      currency: currencyForLocale(locale),
    }),
    [locale],
  );
};
