export type { ThemeBase, ThemeShape, ThemeSpec, ThemeTagColor } from './themeSpec';
export { asThemeSpec, composeTheme, isValidThemeId } from './themeSpec';

export { AUTOMATIC_THEME, negotiateTheme } from './preference';

export type { ThemeTokenBundle } from './themeTokens';
export { asThemeTokenBundle, resolveThemeTokens } from './themeTokens';

export {
  THEME_API_VERSION,
  THEME_DEFINITION_POINT,
  THEME_EXTENSION_POINTS,
  THEME_TOKENS_POINT,
  themeContribution,
  themeSpecsOf,
  themeTokenBundlesOf,
  themeTokensContribution,
} from './extensionPoints';
