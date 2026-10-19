import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { I18N_MESSAGES_POINT, messageBundlesOf } from '../domain/schema/i18n/extensionPoints';
import type { LocaleCode } from '../domain/schema/i18n/localeNegotiation';
import { DEFAULT_LOCALE, negotiateFromCandidates, normalizeLocale } from '../domain/schema/i18n/localeNegotiation';
import { buildMessageCatalog, localesOf } from '../domain/schema/i18n/messages';
import type { MessageBundle } from '../domain/schema/i18n/messages';
import { setAmbientCatalog, setAmbientLocale } from '../domain/schema/i18n/localeGate';
import { resolveTimeZone } from '../domain/schema/i18n/timeZone';
import { setAmbientTimeZone } from '../domain/schema/clockGate';
import { LocaleContext } from './useLocale';
import { useContributions } from './useKernel';
import { useSettings } from './useSettings';
import { usePortal } from './usePortal';
import { useSearchParams } from 'react-router-dom';

const STORAGE_KEY = 'microteia:locale';

/**
 * Os idiomas do NAVEGADOR, na ordem de preferência de quem está nele.
 *
 * É a única resposta honesta para "que idioma usar antes de alguém escolher". A alternativa que
 * existia aqui era uma âncora hardcoded (`pt-BR`), que transformava a mera EXISTÊNCIA de um catálogo
 * português em padrão do produto — inclusive para quem nunca falou português.
 */
const browserLocales = (): LocaleCode[] => {
  if (typeof navigator === 'undefined') return [];
  const languages = Array.isArray(navigator.languages) && navigator.languages.length > 0
    ? navigator.languages
    : [navigator.language];
  return languages.filter((language): language is string => typeof language === 'string' && language !== '');
};

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
  /**
   * Textos que não chegam por contribuição do kernel ao alcance — os das extensões no PORTAL, que o
   * servidor entrega junto com o contexto, porque o convidado não lê as extensões instaladas.
   */
  extraBundles?: readonly MessageBundle[];
}

/**
 * O idioma corrente e o catálogo já resolvido.
 *
 * Ele lê as contribuições do host de plugins MAIS PRÓXIMO, e é isso que faz o mesmo componente servir
 * aos dois mundos sem nenhuma plumbing extra: montado no topo, enxerga os textos do núcleo e vale
 * para as telas públicas; montado de novo dentro do escritório, enxerga também os pacotes de tradução
 * instalados e sombreia o de cima. É exatamente o que o Kernel já faz com `TenantKernelProvider`.
 */
export const LocaleProvider: React.FC<LocaleProviderProps> = ({ children, preferred, extraBundles }) => {
  const contributions = useContributions(I18N_MESSAGES_POINT);
  const [chosen, setChosen] = useState<LocaleCode | null>(storedLocale);

  const bundles = useMemo(
    () => [...messageBundlesOf(contributions), ...(extraBundles ?? [])],
    [contributions, extraBundles],
  );

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

  /**
   * Quando existe configuração, é ela quem manda — INCLUSIVE quando ela não diz nada. O valor do
   * navegador só entra onde não há configuração para consultar: as telas públicas, que recebem este
   * provedor sem a propriedade.
   *
   * A diferença é entre `null` e ausente, e é ela que faz "Restaurar padrão" funcionar. O que estava
   * gravado no navegador é ESPELHO da configuração — quem escreve lá é o `TenantLocaleProvider` —,
   * então tratá-lo como segunda opinião dentro do escritório fazia o espelho sobreviver ao que ele
   * espelhava: apagar o idioma da configuração devolvia a tela ao mesmo idioma, e o campo passava a
   * mostrar um padrão que a interface não obedecia.
   */
  const requested = preferred === undefined ? chosen : preferred;

  /**
   * Escolha explícita vence; sem ela, negocia-se com o idioma do NAVEGADOR e, em último caso, com o
   * idioma-fonte.
   *
   * O que isto desfaz: antes o pedido implícito era `pt-BR` fixo, então bastava existir QUALQUER
   * catálogo português — o dos Termos de Uso, que viaja no bundle — para o português virar o padrão
   * do produto, inclusive para quem nunca falou português. Idioma disponível não é idioma
   * escolhido.
   *
   * O navegador também resolve, sem âncora, o problema que a âncora existia para resolver: um
   * escritório brasileiro chega a `pt-BR` porque o navegador dele diz `pt-BR`.
   */
  const locale = useMemo(
    () => negotiateFromCandidates(
      requested === null ? browserLocales() : [requested],
      available,
      DEFAULT_LOCALE,
    ),
    [requested, available],
  );

  const catalog = useMemo(() => buildMessageCatalog(bundles, locale), [bundles, locale]);

  /**
   * O empurrão para o contexto de módulo: é o que permite a `src/utils/formatters.ts` — API pública
   * congelada, que as extensões importam como `@microteia/format` — passar a formatar no idioma certo
   * sem mudar de assinatura.
   *
   * O idioma NEGOCIADO vai para o gate mesmo quando ninguém escolheu nada. Antes ele ficava nulo
   * nesse caso, e a formatação caía numa âncora `pt-BR` dentro do próprio gate; hoje formatar segue
   * o mesmo idioma em que a interface está sendo lida, que é o único jeito de os dois não se
   * contradizerem na tela.
   */
  useEffect(() => {
    setAmbientLocale(locale);
    setAmbientCatalog(catalog);
  }, [locale, catalog]);

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
 * qualquer configuração. Sem valor gravado em nenhum dos dois escopos, a negociação com o navegador
 * continua valendo, que é o que mantém a coerência com o que a pessoa viu antes de entrar.
 */
export const TenantLocaleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { values, isLoading } = useSettings();

  const preferred = useMemo(() => {
    const stored = values.user[LOCALE_SETTING_KEY] ?? values.tenant[LOCALE_SETTING_KEY];
    if (typeof stored !== 'string') return null;
    const normalized = normalizeLocale(stored);
    return normalized === '' ? null : normalized;
  }, [values]);

  /**
   * A configuração é ESPELHADA no `localStorage`, e é isso que faz as telas públicas obedecerem à
   * escolha de quem configurou.
   *
   * Sem o espelho, `/license` e `/login` — que rodam no provedor de CIMA, sem escritório nem sessão —
   * nunca souberam da configuração: mudar o idioma em Configurações arrumava o workspace e deixava a
   * licença no idioma do navegador. Como a licença abre em ABA NOVA, ela sequer compartilha a árvore
   * de componentes; o `localStorage` é o único canal que as duas pontas enxergam.
   *
   * O espelho é FIEL, inclusive ao apagar: sem configuração gravada, o valor é removido em vez de
   * ficar para trás. Sem isso, uma escolha antiga continuaria mandando nas telas públicas depois de
   * a configuração ter sido limpa — que é como um valor obsoleto sobrevive a uma troca de versão.
   *
   * O sentido é só um: configuração → navegador. O `localStorage` é memória do navegador, não fonte
   * de verdade; quem manda é a configuração do usuário e do escritório.
   */
  useEffect(() => {
    if (isLoading) return;
    if (preferred === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, preferred);
  }, [preferred, isLoading]);

  /**
   * O FUSO do escritório vai para o gate do relógio: é nele que `today()` diz que dia é. A regra de
   * resolução é a mesma que o servidor aplica (`resolveTimeZone`), e é por isso que a tela e a
   * automação concordam sobre a data — inclusive às 22h em Brasília, quando UTC já é amanhã.
   *
   * Ao sair do escritório o gate volta ao padrão: o fuso de um escritório não vale para o próximo.
   */
  const timeZone = useMemo(() => resolveTimeZone(values), [values]);

  useEffect(() => {
    if (isLoading) return;
    setAmbientTimeZone(timeZone);
    return () => setAmbientTimeZone(null);
  }, [timeZone, isLoading]);

  /**
   * Enquanto a configuração não chegou do servidor ela não tem opinião nenhuma — nem "nada gravado".
   * Passar `undefined` ali deixa o espelho valendo por esses instantes, e é o que evita a interface
   * abrir no idioma do navegador para depois pular para o configurado a cada recarga.
   */
  return (
    <LocaleProvider preferred={isLoading ? undefined : preferred}>
      {children}
    </LocaleProvider>
  );
};

/**
 * O idioma no PORTAL. O convidado não lê as configurações do escritório, então quem diz o idioma é o
 * servidor, que já resolveu nele os rótulos das telas (`getPortalContext`): a casca fala o mesmo
 * idioma que o conteúdo. Antes de haver contexto — a escolha do escritório, o "sem acesso" —, vale o
 * do navegador, como em toda tela pública.
 */
export const PortalLocaleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { context, memberships, tenantId } = usePortal();
  // O escolhido (contexto); senão o do convite deste escritório, ou de qualquer convite — é o que
  // vale nas telas que aparecem ANTES do contexto: a escolha do escritório e os erros.
  const preferred = useMemo(() => {
    const invitation = memberships.find((one) => one.tenantId === tenantId)?.locale ?? memberships[0]?.locale ?? '';
    const normalized = normalizeLocale(context?.locale || invitation);
    return normalized === '' ? undefined : normalized;
  }, [context, memberships, tenantId]);

  // O mesmo ESPELHO do escritório: o idioma conhecido fica no navegador, e é ele que fala nas telas que
  // aparecem antes de haver convite ou contexto na próxima visita — o "carregando", o erro.
  useEffect(() => {
    if (!preferred) return;
    try {
      localStorage.setItem(STORAGE_KEY, preferred);
    } catch {
      // Sem armazenamento, a próxima visita começa no idioma do navegador — só isso.
    }
  }, [preferred]);

  return <LocaleProvider preferred={preferred} extraBundles={context?.bundles}>{children}</LocaleProvider>;
};

/**
 * O idioma vindo do ENDEREÇO (`?locale=`; `lang` é do Firebase, que o acrescenta ao devolver): o link de acesso ao portal o carrega, porque a página de
 * entrada abre antes de haver sessão ou escritório para dizer em que idioma falar.
 */
export const UrlLocaleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [params] = useSearchParams();
  const preferred = useMemo(() => {
    const normalized = normalizeLocale(params.get('locale') ?? '');
    return normalized === '' ? undefined : normalized;
  }, [params]);

  useEffect(() => {
    if (!preferred) return;
    try {
      localStorage.setItem(STORAGE_KEY, preferred);
    } catch {
      // Idem: só conveniência.
    }
  }, [preferred]);
  return <LocaleProvider preferred={preferred}>{children}</LocaleProvider>;
};
