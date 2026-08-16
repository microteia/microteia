import { describe, it, expect } from 'vitest';
import { asThemeSpec, composeTheme, type ThemeShape } from './themeSpec';
import { asThemeTokenBundle, resolveThemeTokens } from './themeTokens';
import { AUTOMATIC_THEME, negotiateTheme } from './preference';

const base: ThemeShape = {
  id: 'dark',
  base: 'dark',
  colors: { background: '#000', primary: '#111', text: '#fff' },
  fonts: { body: 'Inter', mono: 'Mono' },
  fontSizes: { md: '1rem' },
  spacing: { md: '16px' },
  borderRadius: { md: '10px' },
  transitions: { fast: '150ms' },
  sidebar: { width: '260px' },
  highlights: { yellow: '#ff0' },
  tagColors: [{ label: '@core.ui/color.blue', value: '#00f' }],
};

describe('asThemeSpec', () => {
  it('aceita a declaração mínima: identidade, nome e de que lado nasce', () => {
    expect(asThemeSpec({ id: 'oceano', name: 'Oceano', extends: 'dark' }))
      .toEqual({ id: 'oceano', name: 'Oceano', extends: 'dark' });
  });

  it('recusa o que não é tema: sem id, sem nome, ou com um lado que não existe', () => {
    expect(asThemeSpec({ name: 'Oceano', extends: 'dark' })).toBeNull();
    expect(asThemeSpec({ id: 'oceano', name: '  ', extends: 'dark' })).toBeNull();
    expect(asThemeSpec({ id: 'oceano', name: 'Oceano', extends: 'sepia' })).toBeNull();
    expect(asThemeSpec('não é objeto')).toBeNull();
  });

  /** O `.json` de um tema é editado à mão: um valor estranho no meio não pode derrubar o resto. */
  it('descarta a entrada malformada e preserva o resto da seção', () => {
    const spec = asThemeSpec({
      id: 'oceano',
      name: 'Oceano',
      extends: 'light',
      colors: { primary: '#2E86AB', border: 42, surface: '' },
    });
    expect(spec?.colors).toEqual({ primary: '#2E86AB' });
  });

  it('ignora a seção que não sobrou nada dentro, em vez de deixá-la vazia', () => {
    expect(asThemeSpec({ id: 'x', name: 'X', extends: 'dark', colors: { a: 1 } })?.colors)
      .toBeUndefined();
  });
});

describe('composeTheme', () => {
  it('o que o tema não declara vem inteiro da base', () => {
    const theme = composeTheme(base, {}, { id: 'oceano', name: 'Oceano', extends: 'dark' });
    expect(theme.colors).toEqual(base.colors);
    expect(theme.fonts).toEqual(base.fonts);
    expect(theme.id).toBe('oceano');
  });

  it('o token contribuído por uma extensão existe sob um tema que nunca ouviu falar dela', () => {
    const theme = composeTheme(
      base,
      { caseStatusWon: '#10b981' },
      { id: 'oceano', name: 'Oceano', extends: 'dark' },
    );
    expect(theme.colors.caseStatusWon).toBe('#10b981');
  });

  /** É o direito de um tema dizer que, NELE, aquele status é outra cor. */
  it('o tema sobrepõe o token da extensão', () => {
    const theme = composeTheme(
      base,
      { caseStatusWon: '#10b981' },
      { id: 'themis', name: 'Themis', extends: 'dark', colors: { caseStatusWon: '#2F6B4F' } },
    );
    expect(theme.colors.caseStatusWon).toBe('#2F6B4F');
  });

  it('carimba o lado declarado, para quem precisa saber se está sobre fundo escuro', () => {
    expect(composeTheme(base, {}, { id: 'x', name: 'X', extends: 'light' }).base).toBe('light');
  });

  it('a paleta de etiquetas só é substituída quando o tema traz a dele inteira', () => {
    expect(composeTheme(base, {}, { id: 'x', name: 'X', extends: 'dark' }).tagColors)
      .toEqual(base.tagColors);
  });
});

describe('resolveThemeTokens', () => {
  const bundle = asThemeTokenBundle({
    light: { won: '#0a0' },
    dark: { won: '#0f0' },
    themes: { themis: { won: '#2F6B4F' } },
  })!;

  it('escolhe o lado pedido', () => {
    expect(resolveThemeTokens([bundle], 'dark')).toEqual({ won: '#0f0' });
    expect(resolveThemeTokens([bundle], 'light')).toEqual({ won: '#0a0' });
  });

  /**
   * O afinamento por tema é o que dispensa um pacote de tema de carregar cor de domínio: quem
   * conhece o Themis é o dono do token, não o Themis.
   */
  it('o valor do tema conhecido sobrepõe o piso do lado', () => {
    expect(resolveThemeTokens([bundle], 'light', 'themis')).toEqual({ won: '#2F6B4F' });
  });

  it('tema que o plugin não conhece cai no piso', () => {
    expect(resolveThemeTokens([bundle], 'dark', 'oceano')).toEqual({ won: '#0f0' });
  });

  /** Mesma regra dos catálogos de mensagem: prioridade maior chega primeiro e vence. */
  it('quem chega primeiro vence a chave disputada', () => {
    const outro = asThemeTokenBundle({ light: {}, dark: { won: '#111' } })!;
    expect(resolveThemeTokens([bundle, outro], 'dark')).toEqual({ won: '#0f0' });
  });

  /** O nível específico vence o piso mesmo quando o piso veio de um pacote que chegou antes. */
  it('o afinamento de um pacote sobrepõe o piso de outro', () => {
    const piso = asThemeTokenBundle({ light: { won: '#aaa' }, dark: { won: '#aaa' } })!;
    const afinado = asThemeTokenBundle({ light: {}, dark: {}, themes: { themis: { won: '#bbb' } } })!;
    expect(resolveThemeTokens([piso, afinado], 'light', 'themis')).toEqual({ won: '#bbb' });
  });

  it('pacote sem nenhuma cor em nível nenhum não é pacote', () => {
    expect(asThemeTokenBundle({ light: {}, dark: {} })).toBeNull();
    expect(asThemeTokenBundle({ light: {}, dark: {}, themes: { themis: {} } })).toBeNull();
    expect(asThemeTokenBundle(null)).toBeNull();
  });

  it('pacote só com afinamento é pacote válido', () => {
    expect(asThemeTokenBundle({ themes: { themis: { won: '#bbb' } } }))
      .toEqual({ light: {}, dark: {}, themes: { themis: { won: '#bbb' } } });
  });
});

describe('negotiateTheme', () => {
  const dark = { id: 'dark', name: 'Dark', extends: 'dark' as const };
  const white = { id: 'white', name: 'White', extends: 'light' as const };

  it('a escolha explícita vence o aparelho', () => {
    expect(negotiateTheme('white', [dark, white], 'dark')).toBe(white);
  });

  it('sem escolha, segue o aparelho', () => {
    expect(negotiateTheme(null, [dark, white], 'light')).toBe(white);
    expect(negotiateTheme(AUTOMATIC_THEME, [dark, white], 'dark')).toBe(dark);
  });

  /** Desinstalar um tema não pode deixar a interface sem paleta. */
  it('a escolha órfã cai no automático em vez de quebrar', () => {
    expect(negotiateTheme('themis', [dark, white], 'dark')).toBe(dark);
  });

  it('sem tema do lado pedido, vale o primeiro que houver', () => {
    expect(negotiateTheme(null, [dark], 'light')).toBe(dark);
  });

  it('sem tema nenhum, não há o que negociar', () => {
    expect(negotiateTheme('dark', [], 'dark')).toBeNull();
  });
});
