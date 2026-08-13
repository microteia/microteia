import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { I18N_MESSAGES_POINT, messageBundlesOf } from '../domain/schema/i18n/extensionPoints';
import type { LocaleCode } from '../domain/schema/i18n/localeNegotiation';
import { DEFAULT_LOCALE, negotiateLocale, normalizeLocale } from '../domain/schema/i18n/localeNegotiation';
import { buildMessageCatalog, localesOf } from '../domain/schema/i18n/messages';
import { LEGACY_LOCALE, setAmbientCatalog, setAmbientLocale } from '../domain/schema/i18n/localeGate';
import { LocaleContext } from './useLocale';
import { useContributions } from './useKernel';
import { useSettings } from './useSettings';

const STORAGE_KEY = 'microteia:locale';

const LOCALE_SETTING_KEY = 'i18n.locale';

const storedLocale = (): LocaleCode | null => {
  const saved = normalizeLocale(localStorage.getItem(STORAGE_KEY));
  return saved === '' ? null : saved;
};

interface LocaleProviderProps {
  children: React.ReactNode;
  /**
   * O idioma vindo de fora, quando existe uma fonte melhor que o `localStorage` — é o que o
   * `TenantLocaleProvider` passa depois de resolver a configuração do escritório.
   */
  preferred?: LocaleCode | null;
}

/**
 * O idioma corrente e o catálogo já resolvido.
 *
 * Ele lê as contribuições do host de plugins MAIS PRÓXIMO, e é isso que faz o mesmo componente servir
 * aos dois mundos sem nenhuma plumbing extra: montado no topo, enxerga os textos do núcleo e vale
 * para as telas públicas; montado de novo dentro do escritório, enxerga também os pacotes de tradução
 * instalados e sombreia o de cima. É exatamente o que o Kernel já faz com `TenantKernelProvider`.
 */
export const LocaleProvider: React.FC<LocaleProviderProps> = ({ children, preferred }) => {
  const contributions = useContributions(I18N_MESSAGES_POINT);
  const [chosen, setChosen] = useState<LocaleCode | null>(storedLocale);

  const bundles = useMemo(() => messageBundlesOf(contributions), [contributions]);

  /**
   * O idioma-fonte entra na lista mesmo sem catálogo declarado: ele é o idioma em que os textos
   * nascem, então há sempre o que mostrar nele — e sem isso um escritório sem nenhum pacote instalado
   * não teria nenhum idioma para escolher.
   */
  const available = useMemo(() => {
    const locales = new Set(localesOf(bundles));
    locales.add(DEFAULT_LOCALE);
    return Array.from(locales).sort();
  }, [bundles]);

  const requested = preferred ?? chosen;

  /**
   * Sem NINGUÉM ter escolhido idioma, o pedido é o LEGADO — não o idioma-fonte.
   *
   * A diferença decide o que um escritório existente vê no dia em que esta versão sobe. Pedir o
   * idioma-fonte viraria a interface para inglês sem ninguém ter tocado em nada; pedir o legado faz
   * com que INSTALAR o pacote de português baste para tudo continuar como era — e, se o pacote não
   * estiver instalado, a negociação cai no inglês, que é o destino declarado do projeto.
   *
   * Sai junto com `LEGACY_LOCALE`, na virada de major.
   */
  const locale = useMemo(
    () => negotiateLocale(requested ?? LEGACY_LOCALE, available, DEFAULT_LOCALE),
    [requested, available],
  );

  const catalog = useMemo(() => buildMessageCatalog(bundles, locale), [bundles, locale]);

  /**
   * O empurrão para o contexto de módulo: é o que permite a `src/utils/formatters.ts` — API pública
   * congelada, que as extensões importam como `@microteia/format` — passar a formatar no idioma certo
   * sem mudar de assinatura. Enquanto ninguém escolheu idioma nenhum, o gate continua NULO de
   * propósito, e a formatação segue exatamente como era.
   */
  useEffect(() => {
    setAmbientLocale(requested === null ? null : locale);
    setAmbientCatalog(catalog);
  }, [requested, locale, catalog]);

  const setLocale = useCallback((next: LocaleCode) => {
    const normalized = normalizeLocale(next);
    localStorage.setItem(STORAGE_KEY, normalized);
    setChosen(normalized === '' ? null : normalized);
  }, []);

  const value = useMemo(
    () => ({ locale, preferred: requested, available, catalog, setLocale }),
    [locale, requested, available, catalog, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
};

/**
 * A mesma coisa, dentro do escritório: o idioma passa a vir da configuração `i18n.locale`, onde a
 * preferência PESSOAL vence a do escritório — a mesma precedência que `resolveSetting` aplica a
 * qualquer configuração. Sem valor gravado em nenhum dos dois escopos, a escolha local do navegador
 * continua valendo, que é o que mantém a coerência com o que a pessoa viu antes de entrar.
 */
export const TenantLocaleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { values } = useSettings();

  const preferred = useMemo(() => {
    const stored = values.user[LOCALE_SETTING_KEY] ?? values.tenant[LOCALE_SETTING_KEY];
    if (typeof stored !== 'string') return null;
    const normalized = normalizeLocale(stored);
    return normalized === '' ? null : normalized;
  }, [values]);

  return <LocaleProvider preferred={preferred}>{children}</LocaleProvider>;
};
