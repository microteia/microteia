/**
 * A APARÊNCIA como dado.
 *
 * Um tema é a `metadata` de uma contribuição ao ponto `theme.definition` — nada além de nomes e
 * valores, como um catálogo de tradução. Isso não é economia de código: é o que permite a um escritório
 * baixar o tema pronto, abrir o `.json` num editor de texto, trocar as cores e reimportar sem
 * escrever uma linha de programa e sem nenhum gesto de confiança de código.
 *
 * O tema é PARCIAL de propósito. Ele declara `extends` — de que lado, claro ou escuro, ele nasce —
 * e só o que muda em relação a esse lado. Um tema completo pareceria mais explícito, mas amarraria
 * todo tema já publicado ao dia em que o núcleo ganhasse um token novo: o arquivo de ontem ficaria
 * incompleto sem ninguém ter mexido nele.
 */

export type ThemeBase = 'dark' | 'light';

export interface ThemeTagColor {
  label: string;
  value: string;
}

export interface ThemeSpec {
  /**
   * A identidade do tema, e o que fica gravado na preferência de quem o escolheu. É a chave da
   * lista: dois temas com o mesmo `id` são o mesmo tema, e quem tiver maior prioridade no registro
   * de contribuições vence.
   */
  id: string;
  /**
   * O nome na lista. Aceita uma referência de mensagem (`@core.theme/theme.dark`) para os temas do
   * sistema, e texto literal para o que o escritório escreveu — `useLabel()` resolve os dois.
   */
  name: string;
  extends: ThemeBase;
  colors?: Record<string, string>;
  fonts?: Record<string, string>;
  fontSizes?: Record<string, string>;
  spacing?: Record<string, string>;
  borderRadius?: Record<string, string>;
  transitions?: Record<string, string>;
  sidebar?: Record<string, string>;
  highlights?: Record<string, string>;
  tagColors?: ThemeTagColor[];
}

/**
 * As seções de um tema já resolvido. É a FORMA, sem os nomes dos tokens: o núcleo conhece os seus,
 * as extensões trazem os delas, e esta camada não precisa saber de nenhum dos dois.
 */
export interface ThemeShape {
  id: string;
  /**
   * De que lado o tema nasce. Está no tema RESOLVIDO, e não só na declaração, porque há componente
   * que precisa saber se está sobre fundo escuro para escolher a opacidade de um realce — e a
   * alternativa que existia era uma lista de nomes de tema em código (`['dark','teams','microteia']`),
   * que envelhecia calada a cada tema novo e era cega a qualquer tema de terceiro.
   */
  base: ThemeBase;
  colors: Record<string, string>;
  fonts: Record<string, string>;
  fontSizes: Record<string, string>;
  spacing: Record<string, string>;
  borderRadius: Record<string, string>;
  transitions: Record<string, string>;
  sidebar: Record<string, string>;
  highlights: Record<string, string>;
  tagColors: ThemeTagColor[];
}

const THEME_ID_PATTERN = /^[a-z0-9][a-z0-9.-]*$/i;

export const isValidThemeId = (id: unknown): id is string =>
  typeof id === 'string' && THEME_ID_PATTERN.test(id);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Só entradas de texto sobrevivem — número, nulo e objeto aninhado são descartados em silêncio. */
const stringRecord = (value: unknown): Record<string, string> | undefined => {
  if (!isPlainObject(value)) return undefined;
  const entries: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string' && entry.trim() !== '') entries[key] = entry;
  }
  return entries;
};

const tagColors = (value: unknown): ThemeTagColor[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const colors: ThemeTagColor[] = [];
  for (const entry of value) {
    if (!isPlainObject(entry)) continue;
    const { label, value: color } = entry;
    if (typeof label !== 'string' || typeof color !== 'string') continue;
    if (label.trim() === '' || color.trim() === '') continue;
    colors.push({ label, value: color });
  }
  return colors.length === 0 ? undefined : colors;
};

const withSection = (
  spec: ThemeSpec,
  key: 'colors' | 'fonts' | 'fontSizes' | 'spacing' | 'borderRadius' | 'transitions' | 'sidebar' | 'highlights',
  value: unknown,
): void => {
  const section = stringRecord(value);
  if (section && Object.keys(section).length > 0) spec[key] = section;
};

/**
 * Lê a `metadata` de uma contribuição como tema, sem nunca lançar.
 *
 * A tolerância é a mesma dos catálogos de mensagem, e pelo mesmo motivo: um `.json` que alguém
 * editou à mão vai ter erro de digitação um dia, e um valor estranho no meio da paleta não pode
 * deixar o escritório sem interface. O que não se entende é descartado; o que sobra continua sendo
 * um tema válido, porque o resto vem da base.
 */
export const asThemeSpec = (metadata: unknown): ThemeSpec | null => {
  if (!isPlainObject(metadata)) return null;
  const { id, name, extends: base } = metadata;
  if (!isValidThemeId(id)) return null;
  if (typeof name !== 'string' || name.trim() === '') return null;
  if (base !== 'dark' && base !== 'light') return null;

  const spec: ThemeSpec = { id, name: name.trim(), extends: base };
  withSection(spec, 'colors', metadata.colors);
  withSection(spec, 'fonts', metadata.fonts);
  withSection(spec, 'fontSizes', metadata.fontSizes);
  withSection(spec, 'spacing', metadata.spacing);
  withSection(spec, 'borderRadius', metadata.borderRadius);
  withSection(spec, 'transitions', metadata.transitions);
  withSection(spec, 'sidebar', metadata.sidebar);
  withSection(spec, 'highlights', metadata.highlights);
  const palette = tagColors(metadata.tagColors);
  if (palette) spec.tagColors = palette;
  return spec;
};

/**
 * Monta o tema em vigor: a base do lado declarado, depois os tokens que as extensões contribuíram,
 * depois o que o próprio tema declara.
 *
 * Essa ordem é a regra inteira. Os tokens de extensão entram DEPOIS da base porque é assim que
 * `caseStatusWon` existe sob qualquer tema, inclusive um que o escritório escreveu ontem sem saber
 * que Processos existe. E entram ANTES do tema porque um tema tem o direito de dizer que, nele,
 * "ganho de causa" é outro verde — sem precisar da permissão de quem declarou o token.
 */
export const composeTheme = <T extends ThemeShape>(
  base: T,
  tokens: Record<string, string>,
  spec: ThemeSpec,
): T => ({
  ...base,
  id: spec.id,
  base: spec.extends,
  colors: { ...base.colors, ...tokens, ...spec.colors },
  fonts: { ...base.fonts, ...spec.fonts },
  fontSizes: { ...base.fontSizes, ...spec.fontSizes },
  spacing: { ...base.spacing, ...spec.spacing },
  borderRadius: { ...base.borderRadius, ...spec.borderRadius },
  transitions: { ...base.transitions, ...spec.transitions },
  sidebar: { ...base.sidebar, ...spec.sidebar },
  highlights: { ...base.highlights, ...spec.highlights },
  tagColors: spec.tagColors ?? base.tagColors,
  // A forma genérica não sobrevive ao espalhamento: `colors` volta como Record de texto, que é o
  // que ele é. O contrato preservado é o do tipo concreto de quem chamou, e a base o garante.
} as T);
