import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import type { ThemeSpec } from '../../domain/schema/theme';
import { themeContribution } from '../../domain/schema/theme';

/**
 * As paletas que o sistema já tinha, agora como EXTENSÕES.
 *
 * Nenhuma delas é do núcleo, e é esse o ponto: o kernel guarda duas bases e mais nada, enquanto
 * "Themis", "Kindle" e as demais se instalam e se removem como qualquer pacote. Elas seguem no
 * bundle para que continuem a um clique de distância — e para servirem de MOLDE: baixar uma,
 * trocar `id` e `name`, mexer nas cores e importar de volta é o caminho inteiro para um tema próprio.
 *
 * Cada uma declara apenas o que difere da base que estende, e **só token do kernel**. As cores de
 * domínio que estas paletas traziam — o vinho de "sentença" no Themis, o bordô de "contrato
 * rescindido" — mudaram de lado: quem as declara agora é Processos, Contratos e Pessoas, na entrada
 * `themes` do pacote de tokens de cada um. O token tem UM dono, e o dono responde por ele em todo
 * tema; um pacote de tema que carregasse `casePhaseSentence` estaria opinando sobre vocabulário
 * alheio e passaria a depender da ordem de instalação para ganhar.
 *
 * O direito de sobrepor continua existindo — a paleta de um tema vence qualquer token contribuído —,
 * mas é escape, não o caminho normal. O caminho normal é o dono declarar.
 */
const themePackage = (
  id: string,
  name: string,
  summaryKey: string,
  spec: Omit<ThemeSpec, 'id' | 'name'>,
): MarketplacePlugin => ({
  summary: `@core.theme/${summaryKey}`,
  workflows: [],
  manifest: {
    id: `com.microteia.theme-${id}`,
    version: '1.0.0',
    kernel: '^1.0.0',
    name,
    description:
      `The ${name} theme for Microteia.`,
    icon: 'palette',
    publisher: { name: 'Microteia' },
    dependencies: { 'core.theme': '^1.0.0' },
    contributes: [themeContribution({ id, name, ...spec })],
  },
});

export const indigoThemePlugin = themePackage('indigo', 'Indigo', 'package.indigo.summary', {
  extends: 'dark',
  colors: {
    background: '#0f1117',
    surface: '#1a1d27',
    surfaceHover: '#22263a',
    cardHover: '#22263a',
    border: '#2a2d3e',
    primary: '#6c63ff',
    primaryHover: '#5a52d5',
    primaryLight: 'rgba(108, 99, 255, 0.15)',
    secondary: '#f97316',
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
    revenue: '#16A34A',
    revenueLight: 'rgba(22, 163, 74, 0.12)',
    expense: '#ef4444',
    info: '#38bdf8',
    text: '#e2e8f0',
    textSecondary: '#94a3b8',
    textMuted: '#475569',
    inputBackground: '#12151e',
    scrollbar: '#2a2d3e',
    scrollbarThumb: '#3d4163',
    shadow: 'rgba(0, 0, 0, 0.4)',
    overlay: 'rgba(0, 0, 0, 0.6)',
    calendarToday: 'rgba(108, 99, 255, 0.2)',
  },
  fonts: {
    body: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', monospace",
  },
});

export const indigoLightThemePlugin = themePackage(
  'indigo-light',
  'Indigo Light',
  'package.indigo-light.summary',
  {
    extends: 'light',
    colors: {
      background: '#f1f5f9',
      surface: '#ffffff',
      surfaceHover: '#f8fafc',
      cardHover: '#f8fafc',
      border: '#e2e8f0',
      primary: '#6c63ff',
      primaryHover: '#5a52d5',
      primaryLight: 'rgba(108, 99, 255, 0.15)',
      secondary: '#f97316',
      success: '#22c55e',
      warning: '#f59e0b',
      danger: '#ef4444',
      revenue: '#16A34A',
      revenueLight: 'rgba(22, 163, 74, 0.12)',
      expense: '#ef4444',
      info: '#38bdf8',
      text: '#1e293b',
      textSecondary: '#475569',
      textMuted: '#94a3b8',
      inputBackground: '#f8fafc',
      scrollbar: '#e2e8f0',
      scrollbarThumb: '#cbd5e1',
      shadow: 'rgba(0, 0, 0, 0.08)',
      overlay: 'rgba(0, 0, 0, 0.4)',
      calendarToday: 'rgba(108, 99, 255, 0.1)',
    },
  },
);

export const claudeThemePlugin = themePackage('claude', 'Claude', 'package.claude.summary', {
  extends: 'light',
  colors: {
    background: '#F5F4EE',
    surface: '#FDFCF9',
    surfaceHover: '#F0EDE4',
    cardHover: '#F0EDE4',
    border: '#E5DECE',
    primary: '#DA7756',
    primaryHover: '#C4634A',
    primaryLight: 'rgba(218, 119, 86, 0.12)',
    secondary: '#B5A48B',
    success: '#5A8A6A',
    warning: '#C98A3A',
    danger: '#C0483F',
    revenue: '#5A8A6A',
    revenueLight: 'rgba(90, 138, 106, 0.12)',
    expense: '#C0483F',
    info: '#5C89AD',
    text: '#3D2C1E',
    textSecondary: '#7A6455',
    textMuted: '#A89884',
    inputBackground: '#FAF8F3',
    scrollbar: '#E5DECE',
    scrollbarThumb: '#C4B9A8',
    shadow: 'rgba(61, 44, 30, 0.1)',
    overlay: 'rgba(61, 44, 30, 0.4)',
    calendarToday: 'rgba(218, 119, 86, 0.15)',
  },
  fonts: {
    body: "'Georgia', 'Times New Roman', serif",
    mono: "'JetBrains Mono', 'Fira Code', monospace",
  },
  highlights: {
    yellow: '#fde68a',
    green: '#a7f3d0',
    pink: '#fbcfe8',
    blue: '#bae6fd',
    orange: '#fed7aa',
  },
});

export const teamsThemePlugin = themePackage('teams', 'Teams', 'package.teams.summary', {
  extends: 'dark',
  colors: {
    primary: '#6264A7',
    primaryHover: '#4E507E',
    primaryLight: 'rgba(98, 100, 167, 0.15)',
    secondary: '#5C5C5C',
    calendarToday: 'rgba(98, 100, 167, 0.2)',
  },
});

export const kindleThemePlugin = themePackage('kindle', 'Kindle', 'package.kindle.summary', {
  extends: 'light',
  colors: {
    background: '#F6EDD9',
    surface: '#FBF4E5',
    surfaceHover: '#F0E5CB',
    cardHover: '#EDE0C8',
    border: '#DECCAA',
    primary: '#8B6040',
    primaryHover: '#735035',
    primaryLight: 'rgba(139, 96, 64, 0.12)',
    secondary: '#A08060',
    success: '#4A7C59',
    warning: '#C8923A',
    danger: '#B84040',
    revenue: '#4A7C59',
    revenueLight: 'rgba(74, 124, 89, 0.10)',
    expense: '#B84040',
    info: '#5C7A99',
    text: '#2C1A0E',
    textSecondary: '#6B5040',
    textMuted: '#A08868',
    inputBackground: '#F8F2E4',
    scrollbar: '#DECCAA',
    scrollbarThumb: '#C4A878',
    shadow: 'rgba(44, 26, 14, 0.08)',
    overlay: 'rgba(44, 26, 14, 0.35)',
    calendarToday: 'rgba(139, 96, 64, 0.12)',
  },
  fonts: {
    body: "'Palatino Linotype', 'Palatino', 'Book Antiqua', Georgia, serif",
    mono: "'JetBrains Mono', 'Fira Code', monospace",
  },
  highlights: {
    yellow: 'rgba(202, 138, 4, 0.38)',
    green: 'rgba(74, 124, 89, 0.35)',
    pink: 'rgba(190, 80, 115, 0.28)',
    blue: 'rgba(59, 130, 200, 0.28)',
    orange: 'rgba(180, 80, 30, 0.32)',
  },
});

export const themisThemePlugin = themePackage('themis', 'Themis', 'package.themis.summary', {
  extends: 'light',
  colors: {
    background: '#F6F3EC',
    surface: '#FDFBF6',
    surfaceHover: '#EFEAE0',
    cardHover: '#EFEAE0',
    border: '#E0D8C8',
    primary: '#6D2233',
    primaryHover: '#571B29',
    primaryLight: 'rgba(109, 34, 51, 0.10)',
    secondary: '#B08D3E',
    success: '#2F6B4F',
    warning: '#B07D2B',
    warningLight: 'rgba(176, 125, 43, 0.12)',
    danger: '#C03B2D',
    dangerLight: 'rgba(192, 59, 45, 0.10)',
    revenue: '#2F6B4F',
    revenueLight: 'rgba(47, 107, 79, 0.10)',
    expense: '#C03B2D',
    info: '#3E6B8C',
    text: '#26201A',
    textSecondary: '#6B5D4F',
    textMuted: '#A29383',
    inputBackground: '#FAF7F0',
    scrollbar: '#E0D8C8',
    scrollbarThumb: '#C6B99F',
    shadow: 'rgba(42, 33, 24, 0.08)',
    overlay: 'rgba(42, 33, 24, 0.45)',
    calendarToday: 'rgba(109, 34, 51, 0.10)',
  },
  fonts: {
    body: "'Lora', Georgia, 'Times New Roman', serif",
    mono: "'JetBrains Mono', 'Fira Code', monospace",
  },
  highlights: {
    yellow: 'rgba(202, 138, 4, 0.35)',
    green: 'rgba(47, 107, 79, 0.30)',
    pink: 'rgba(109, 34, 51, 0.22)',
    blue: 'rgba(62, 107, 140, 0.28)',
    orange: 'rgba(176, 125, 43, 0.32)',
  },
});

export const themisNightThemePlugin = themePackage(
  'themis-night',
  'Themis Night',
  'package.themis-night.summary',
  {
    extends: 'dark',
    colors: {
      background: '#191316',
      surface: '#221A1E',
      surfaceHover: '#2C2127',
      cardHover: '#2C2127',
      border: '#3A2C32',
      primary: '#B85C6E',
      primaryHover: '#A44E60',
      primaryLight: 'rgba(184, 92, 110, 0.16)',
      secondary: '#C9A24B',
      success: '#5FA37F',
      warning: '#D2A455',
      warningLight: 'rgba(210, 164, 85, 0.14)',
      danger: '#D96A5B',
      dangerLight: 'rgba(217, 106, 91, 0.14)',
      revenue: '#5FA37F',
      revenueLight: 'rgba(95, 163, 127, 0.14)',
      expense: '#D96A5B',
      info: '#7BA7C9',
      text: '#EFE7DC',
      textSecondary: '#B5A798',
      textMuted: '#7A6D62',
      inputBackground: '#171114',
      scrollbar: '#3A2C32',
      scrollbarThumb: '#55424B',
      shadow: 'rgba(0, 0, 0, 0.45)',
      overlay: 'rgba(0, 0, 0, 0.6)',
      calendarToday: 'rgba(184, 92, 110, 0.18)',
    },
    fonts: {
      body: "'Lora', Georgia, 'Times New Roman', serif",
      mono: "'JetBrains Mono', 'Fira Code', monospace",
    },
    highlights: {
      yellow: 'rgba(201, 162, 75, 0.38)',
      green: 'rgba(95, 163, 127, 0.35)',
      pink: 'rgba(184, 92, 110, 0.35)',
      blue: 'rgba(123, 167, 201, 0.32)',
      orange: 'rgba(210, 164, 85, 0.36)',
    },
  },
);

export const THEME_MARKETPLACE_PLUGINS: MarketplacePlugin[] = [
  indigoThemePlugin,
  indigoLightThemePlugin,
  claudeThemePlugin,
  teamsThemePlugin,
  kindleThemePlugin,
  themisThemePlugin,
  themisNightThemePlugin,
];
