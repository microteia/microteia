import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ThemeProvider as StyledThemeProvider } from 'styled-components';
import { THEME_BASES, baseDarkTheme } from '../shared/styles/theme';
import type { Theme } from '../shared/styles/theme';
import { GlobalStyles } from '../shared/styles/GlobalStyles';
import {
  THEME_DEFINITION_POINT,
  THEME_TOKENS_POINT,
  composeTheme,
  negotiateTheme,
  themeSpecsOf,
  themeTokenBundlesOf,
  resolveThemeTokens,
} from '../domain/schema/theme';
import type { ThemeBase, ThemeSpec, ThemeTokenBundle } from '../domain/schema/theme';
import { ThemeContext, type ThemeOption } from './useTheme';
import { ThemeSourceContext, type ThemeSource } from './useThemeSource';
import { useContributions } from './useKernel';
import { RESERVED_THEME_IDS } from '../plugins/themes/systemThemes';

const STORAGE_KEY = 'microteia:theme';

/**
 * O lado que a MÁQUINA pede — claro ou escuro —, conforme a preferência do sistema operacional.
 *
 * É a única resposta honesta para "que aparência usar antes de alguém escolher". Um padrão fixo em
 * código responderia a mesma coisa a todo mundo: quem trabalha no escuro receberia a tela branca em
 * todo primeiro acesso, em qualquer máquina.
 */
const COLOR_SCHEME_QUERY = '(prefers-color-scheme: dark)';

const systemBase = (): ThemeBase =>
  typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(COLOR_SCHEME_QUERY).matches
    ? 'dark'
    : 'light';

const storedTheme = (): string | null => {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === null || saved.trim() === '' ? null : saved.trim();
};

/**
 * A aparência em vigor, montada a partir das CONTRIBUIÇÕES.
 *
 * Fica no topo da árvore, sozinho, e é por isso que o fundo da página, a barra de rolagem e as telas
 * públicas obedecem à mesma escolha que o workspace. O que ele não alcança de lá — os temas que o
 * escritório instalou e a preferência gravada na configuração — chega pelo `TenantThemeBridge`, que
 * publica os dois de dentro. Enquanto ninguém publica, valem os temas embutidos no bundle e o que
 * ficou no navegador, que é exatamente o que `/login` precisa.
 */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const bundledThemes = useContributions(THEME_DEFINITION_POINT);
  const bundledTokens = useContributions(THEME_TOKENS_POINT);
  const [source, setSource] = useState<ThemeSource | null>(null);
  const [chosen, setChosen] = useState<string | null>(storedTheme);
  const [base, setBase] = useState<ThemeBase>(systemBase);

  /**
   * A máquina muda de ideia com a tela aberta — é o que acontece às seis da tarde em quem usa o modo
   * automático do sistema. Sem esta assinatura, "Automático" seria automático só no boot.
   */
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(COLOR_SCHEME_QUERY);
    const listener = (event: MediaQueryListEvent) => setBase(event.matches ? 'dark' : 'light');
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, []);

  const bundledSpecs = useMemo(() => themeSpecsOf(bundledThemes, RESERVED_THEME_IDS), [bundledThemes]);
  const bundledBundles = useMemo(() => themeTokenBundlesOf(bundledTokens), [bundledTokens]);

  const specs: ThemeSpec[] = source?.specs ?? bundledSpecs;
  const bundles: ThemeTokenBundle[] = source?.bundles ?? bundledBundles;

  /**
   * Quando a configuração do escritório já respondeu, é ela quem manda — INCLUSIVE quando a resposta
   * é "nada gravado". O que ficou no navegador vale onde não há configuração para consultar: as
   * telas públicas, e o intervalo em que a configuração ainda está a caminho.
   *
   * A diferença entre `null` e ausente é o que faz "Restaurar padrão" funcionar. O valor guardado no
   * navegador é ESPELHO da configuração — quem escreve lá é o `TenantThemeBridge` —, então tratá-lo
   * como segunda opinião dentro do escritório fazia o espelho sobreviver ao que ele espelhava:
   * apagar o tema da configuração devolvia a tela ao mesmo tema, e o campo passava a mostrar um
   * padrão que a interface não obedecia.
   */
  const requested = source && source.preferred !== undefined ? source.preferred : chosen;

  const active = useMemo(
    () => negotiateTheme(requested, specs, base),
    [requested, specs, base],
  );

  /**
   * Sem tema contribuído nenhum, a base do kernel vale sozinha. Não é hipótese: é o instante entre o
   * React montar a árvore e o host de plugins terminar de carregar — e nele a tela precisa ter cor.
   */
  const theme: Theme = useMemo(
    () => (active
      ? composeTheme(
        THEME_BASES[active.extends],
        resolveThemeTokens(bundles, active.extends, active.id),
        active,
      )
      : baseDarkTheme),
    [active, bundles],
  );

  /**
   * A lista que Configurações e a barra lateral mostram. A amostra de cor sai do tema JÁ MONTADO de
   * cada um — nunca de uma tabela paralela de cores em código, que era o que existia aqui e que
   * envelhecia calada toda vez que uma paleta mudava.
   */
  const available = useMemo<ThemeOption[]>(
    () => specs.map((spec) => {
      const resolved = composeTheme(
        THEME_BASES[spec.extends],
        resolveThemeTokens(bundles, spec.extends, spec.id),
        spec,
      );
      return {
        id: spec.id,
        name: spec.name,
        base: spec.extends,
        primaryColor: resolved.colors.primary,
        backgroundColor: resolved.colors.background,
      };
    }),
    [specs, bundles],
  );

  /**
   * Há UM lugar por vez onde a escolha mora, e o gesto é o mesmo nos dois. Fora do escritório é o
   * navegador — é o que mantém a escolha viva em `/login` e `/license`, que rodam sem sessão. Dentro
   * dele é a configuração pessoal, gravada pelo `TenantThemeBridge`; escrever no navegador ali
   * faria a configuração desfazer o clique no render seguinte.
   */
  const save = source?.save;
  const setTheme = useCallback((id: string) => {
    if (save) { save(id); return; }
    localStorage.setItem(STORAGE_KEY, id);
    setChosen(id);
  }, [save]);

  const themeId = active?.id ?? baseDarkTheme.id;

  const value = useMemo(
    () => ({ themeId, preferred: requested, available, setTheme }),
    [themeId, requested, available, setTheme],
  );

  const sourceValue = useMemo(() => ({ publish: setSource }), []);

  return (
    <ThemeSourceContext.Provider value={sourceValue}>
      <ThemeContext.Provider value={value}>
        <StyledThemeProvider theme={theme}>
          <GlobalStyles />
          {children}
        </StyledThemeProvider>
      </ThemeContext.Provider>
    </ThemeSourceContext.Provider>
  );
};
