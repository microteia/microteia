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

/**
 * A cor com que NASCE uma opção criada pelo usuário no próprio campo. Uma lista colorida não pode
 * ganhar item sem cor: as opções que vieram declaradas aparecem coloridas e a recém-criada ficava
 * apagada no meio delas.
 *
 * "A lista é colorida" tem duas fontes, e basta uma: o campo declarar `optionsColored` (lista ainda
 * vazia, mas nascida colorida) ou as opções já existentes terem cor (a lista mostra o que é, mesmo
 * que o campo não declare nada). Fora disso devolve `undefined` — inventar cor em lista sem cor
 * mudaria a aparência de quem nunca pediu.
 *
 * A escolha percorre a paleta do tema a partir do azul e para na primeira cor ainda não usada na
 * lista, para que duas opções seguidas não saiam iguais; esgotada a paleta, volta a girar. Cores
 * declaradas como token do tema (`caseStatusWon`) entram na comparação já resolvidas.
 */
export const nextLookupOptionColor = (
  existingColors: readonly (string | undefined)[],
  optionsColored: boolean | undefined,
  theme: DefaultTheme,
): string | undefined => {
  const used = new Set(
    existingColors
      .map((color) => resolveColor(color, theme, false))
      .filter((color): color is string => !!color),
  );
  if (!optionsColored && used.size === 0) return undefined;

  const palette = theme.tagColors;
  const start = Math.max(palette.findIndex((color) => color.label === 'Azul'), 0);
  const rotated = palette.map((_, index) => palette[(start + index) % palette.length]);
  return (rotated.find((color) => !used.has(color.value)) ?? rotated[used.size % palette.length]).value;
};
