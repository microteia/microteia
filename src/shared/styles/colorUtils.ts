import type { DefaultTheme } from 'styled-components';

/**
 * Resolve uma cor que pode ser um hex literal (#fff) ou uma chave do tema (primary, danger, etc.).
 * Retorna undefined se colorValue for undefined/null.
 */
export const resolveColor = (colorValue: string | undefined, theme: DefaultTheme, forceColor: boolean = true): string | undefined => {
  if (!colorValue) return forceColor ?  theme.colors.textSecondary : undefined;
  return colorValue.startsWith('#') ? colorValue : (theme.colors as Record<string, string>)[colorValue] ?? (forceColor ? theme.colors.textSecondary : undefined);
};
