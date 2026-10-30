/**
 * O PISO da aparência — as duas bases sobre as quais todo tema é escrito.
 *
 * Não são temas escolhíveis: nenhuma delas aparece na lista de Configurações. São o valor completo
 * de cada token, para que `theme.colors.primary` nunca seja `undefined` num styled-component — o que
 * derrubaria a interface inteira por causa de um `.json` mal preenchido. Quem se escolhe são as
 * contribuições ao ponto `theme.definition`, e todas elas nascem de uma destas duas.
 *
 * Só mora aqui o que é DO KERNEL. As cores de um domínio — o verde de "ganho de causa", o âmbar de
 * "aguardando assinatura" — viajam com o plugin que as usa, pelo ponto `theme.tokens`. A regra é
 * literal: se nenhum arquivo fora de `src/plugins/marketplace/` lê o token, ele não pertence a este
 * arquivo.
 */
import type { ThemeBase, ThemeTagColor } from '../../domain/schema/theme';

/**
 * A paleta de etiquetas: as cores oferecidas ao escritório quando ele pinta uma etiqueta ou uma
 * opção de lista. É do kernel porque etiquetar é do kernel — e o `label` é uma REFERÊNCIA de
 * mensagem, não a palavra "Azul", porque a paleta viaja até as extensões com a forma congelada.
 */
const TAG_COLORS: ThemeTagColor[] = [
  { label: '@core.ui/color.gray',      value: '#6B7280' },
  { label: '@core.ui/color.red',       value: '#DC2626' },
  { label: '@core.ui/color.orange',    value: '#EA580C' },
  { label: '@core.ui/color.amber',     value: '#D97706' },
  { label: '@core.ui/color.yellow',    value: '#CA8A04' },
  { label: '@core.ui/color.green',     value: '#16A34A' },
  { label: '@core.ui/color.teal',      value: '#0D9488' },
  { label: '@core.ui/color.cyan',      value: '#0891B2' },
  { label: '@core.ui/color.blue',      value: '#2563EB' },
  { label: '@core.ui/color.indigo',    value: '#4F46E5' },
  { label: '@core.ui/color.violet',    value: '#7C3AED' },
  { label: '@core.ui/color.pink',      value: '#DB2777' },
  { label: '@core.ui/color.brown',     value: '#92400E' },
];

const METRICS = {
  fontSizes: {
    xs: '0.75rem',
    sm: '0.875rem',
    md: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    '2xl': '48px',
  },
  borderRadius: {
    sm: '8px',
    md: '10px',
    lg: '16px',
    xl: '24px',
    full: '9999px',
  },
  transitions: {
    fast: '150ms ease',
    normal: '250ms ease',
    slow: '350ms ease',
  },
  sidebar: {
    width: '260px',
    collapsedWidth: '72px',
  },
  listCard: {
    minWidth: {
      sm: '240px',
      md: '320px',
      lg: '420px',
    },
    avatar: {
      sm: '32px',
      md: '44px',
      lg: '64px',
    },
  },
};

/**
 * Os dois neutros de linha, e a diferença entre eles é a função, não a intensidade:
 *
 * - `border` CONTORNA — dá forma ao que é um objeto: campo, card, menu, painel flutuante.
 * - `borderSubtle` DIVIDE — separa regiões que já diferem no preenchimento: a sidebar do painel,
 *   a barra de abas da página, uma linha de tabela da seguinte. Quem separa ali é a troca de fundo;
 *   a linha só insinua.
 *
 * Os dois são SOBREPOSIÇÃO (`rgba`), não hex opaco, e isso é o que os faz valer em qualquer tema:
 * uma sobreposição compõe sobre o fundo que encontrar, então a mesma divisória acerta o `background`
 * e o `surface` — e acerta também o tema escuro que um escritório escrever amanhã sem redeclará-la.
 * Um hex opaco só pode acertar um dos dois.
 */
export const baseDarkTheme = {
  id: 'dark',
  base: 'dark' as ThemeBase,
  colors: {
    background: '#0A0A0A',
    surface: '#131313',
    surfaceHover: '#1E1E1E',
    cardHover: '#1E1E1E',
    border: 'rgba(255, 255, 255, 0.11)',
    borderSubtle: 'rgba(255, 255, 255, 0.055)',
    primary: '#F56B3A',
    primaryHover: '#D45A2A',
    primaryLight: 'rgba(245, 107, 58, 0.15)',
    secondary: '#FF9A6E',
    success: '#92C353',
    warning: '#F8D22A',
    warningLight: 'rgba(245, 158, 11, 0.12)',
    danger: '#CC4A31',
    dangerLight: 'rgba(239, 68, 68, 0.12)',
    revenue: '#92C353',
    revenueLight: 'rgba(146, 195, 83, 0.15)',
    expense: '#CC4A31',
    info: '#4FA8C9',
    text: '#ECECEC',
    textSecondary: '#B4B4B4',
    textMuted: '#858585',
    inputBackground: '#171717',
    scrollbar: 'rgba(255, 255, 255, 0.03)',
    scrollbarThumb: 'rgba(255, 255, 255, 0.16)',
    shadow: 'rgba(0, 0, 0, 0.6)',
    overlay: 'rgba(0, 0, 0, 0.72)',
    calendarToday: 'rgba(245, 107, 58, 0.14)',
    white: '#ffffff',
    aiOpenai: '#10a37f',
    aiAnthropic: '#c97c5d',
    aiGoogle: '#4285f4',
    aiMistral: '#ff7000',
    aiCohere: '#39594d',
    aiOllama: '#333333',
    aiOther: '#6c63ff',
  },
  fonts: {
    body: "'Geist', system-ui, -apple-system, 'Segoe UI', sans-serif",
    mono: "'Geist Mono', 'JetBrains Mono', 'Fira Code', monospace",
  },
  ...METRICS,
  highlights: {
    yellow: 'rgba(253, 224, 71, 0.42)',
    green: 'rgba(74, 222, 128, 0.38)',
    pink: 'rgba(244, 114, 182, 0.38)',
    blue: 'rgba(56, 189, 248, 0.38)',
    orange: 'rgba(251, 146, 60, 0.40)',
  },
  tagColors: TAG_COLORS,
};

export const baseLightTheme: typeof baseDarkTheme = {
  ...baseDarkTheme,
  id: 'light',
  base: 'light' as ThemeBase,
  colors: {
    ...baseDarkTheme.colors,
    background: '#ECEEF2',
    surface: '#F5F6F9',
    surfaceHover: '#E8EBF1',
    cardHover: '#E4E7EF',
    border: 'rgba(26, 32, 53, 0.13)',
    borderSubtle: 'rgba(26, 32, 53, 0.07)',
    primary: '#5B7ED6',
    primaryHover: '#4A6BC4',
    primaryLight: 'rgba(91, 126, 214, 0.10)',
    secondary: '#8896B3',
    success: '#3D9970',
    warning: '#C99A3A',
    warningLight: 'rgba(201, 154, 58, 0.12)',
    danger: '#C85A5A',
    dangerLight: 'rgba(200, 90, 90, 0.12)',
    revenue: '#3D9970',
    revenueLight: 'rgba(61, 153, 112, 0.10)',
    expense: '#C85A5A',
    info: '#4A90C9',
    text: '#1A2035',
    textSecondary: '#4A5770',
    textMuted: '#5D6880',
    inputBackground: '#F0F2F6',
    scrollbar: 'rgba(26, 32, 53, 0.04)',
    scrollbarThumb: 'rgba(26, 32, 53, 0.22)',
    shadow: 'rgba(26, 32, 53, 0.08)',
    overlay: 'rgba(26, 32, 53, 0.35)',
    calendarToday: 'rgba(91, 126, 214, 0.10)',
  },
  fonts: {
    body: "'Geist', system-ui, -apple-system, 'Segoe UI', sans-serif",
    mono: "'Geist Mono', 'JetBrains Mono', 'Fira Code', monospace",
  },
  highlights: {
    yellow: '#fde047',
    green: '#86efac',
    pink: '#f9a8d4',
    blue: '#7dd3fc',
    orange: '#fdba74',
  },
};

export type Theme = typeof baseDarkTheme;

/** As duas bases pelo nome que o `extends` de um tema usa. */
export const THEME_BASES: Record<'dark' | 'light', Theme> = {
  dark: baseDarkTheme,
  light: baseLightTheme,
};
