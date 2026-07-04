import type { DefaultTheme } from 'styled-components';

/**
 * Resolve uma cor que pode ser um hex literal (#fff) ou uma chave do tema (primary, danger, etc.).
 * Retorna undefined se colorValue for undefined/null.
 */
export const resolveColor = (colorValue: string | undefined, theme: DefaultTheme, forceColor: boolean = true): string | undefined => {
  if (!colorValue) return forceColor ?  theme.colors.textSecondary : undefined;
  return colorValue.startsWith('#') ? colorValue : (theme.colors as Record<string, string>)[colorValue] ?? (forceColor ? theme.colors.textSecondary : undefined);
};

/**
 * Busca a cor de uma entidade em uma lista de configs e resolve (hex ou token do tema).
 * @param configs Lista de configurações com `key` e `color`
 * @param key Chave da entidade a buscar
 * @param theme Tema do styled-components
 * @param fallback Cor de fallback se não encontrar (padrão: theme.colors.textSecondary)
 * @returns Cor resolvida (hex ou do tema)
 */
export const getConfigColor = <T extends { key: string; color?: string }>(
  configs: T[],
  key: string,
  theme: DefaultTheme,
  fallback?: string
): string => {
  const config = configs.find((c) => c.key === key);
  return resolveColor(config?.color, theme) ?? fallback ?? theme.colors.textSecondary;
};

/**
 * Cor padrão usada como pré-seleção em paletas de cor (etiquetas, opções de campos customizados).
 * Usa "Azul" se existir no tema, senão a primeira cor da paleta.
 */
export const getDefaultTagColor = (theme: DefaultTheme): string => {
  const tagColors = theme.tagColors;
  return tagColors.find((c) => c.label === 'Azul')?.value ?? tagColors[0].value;
};

/**
 * Resolve a cor de uma opção de campo customizado apenas quando o campo tem "Opções com cor"
 * habilitado; caso contrário retorna undefined para preservar o comportamento sem cor.
 */
export const resolveFieldOptionColor = (
  color: string | undefined,
  optionsColored: boolean | undefined,
  theme: DefaultTheme,
): string | undefined => (optionsColored ? resolveColor(color, theme) : undefined);
