import type { ThemeBase } from './themeSpec';

/**
 * As cores que um domínio traz consigo.
 *
 * "Ganho de causa é verde" é vocabulário de Processos, não do núcleo — e enquanto essas cores
 * moravam no tema do kernel, acrescentar um domínio novo exigia um commit no núcleo, e remover um
 * deixava cor órfã para trás. Aqui elas viajam com quem as usa: instalou Processos, `caseStatusWon`
 * existe; desinstalou, some.
 *
 * O pacote tem DOIS níveis, e é a distinção inteira:
 *
 * - `light` e `dark` são o PISO, e valem sob qualquer tema — inclusive um que o escritório escreveu
 *   ontem. Os dois lados são obrigatórios porque a mesma cor não serve aos dois: um cinza que se lê
 *   sobre fundo claro desaparece sobre fundo escuro.
 * - `themes` é o afinamento para os temas que o plugin CONHECE. Declarar `themes.themis` não faz de
 *   Processos um tema: continua sendo Processos definindo as cores DELE, agora dizendo como elas se
 *   leem naquela paleta. Tema que ele não conhece cai no piso, que é o comportamento certo.
 *
 * É por aqui que uma cor de domínio nunca precisa aparecer dentro de um pacote de tema. O token tem
 * UM dono — quem o declara —, e o dono responde por ele em todo contexto. Um tema ainda pode
 * sobrepor qualquer token pela paleta dele; isso é direito de tema, e é o caminho certo para quem
 * quer mexer no que não é seu.
 */
export interface ThemeTokenBundle {
  light: Record<string, string>;
  dark: Record<string, string>;
  /** Valores por `id` de tema. Ausente, vale o piso do lado que aquele tema estende. */
  themes?: Record<string, Record<string, string>>;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const side = (value: unknown): Record<string, string> => {
  if (!isPlainObject(value)) return {};
  const tokens: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string' && entry.trim() !== '') tokens[key] = entry;
  }
  return tokens;
};

const byTheme = (value: unknown): Record<string, Record<string, string>> => {
  if (!isPlainObject(value)) return {};
  const themes: Record<string, Record<string, string>> = {};
  for (const [themeId, tokens] of Object.entries(value)) {
    const resolved = side(tokens);
    if (Object.keys(resolved).length > 0) themes[themeId] = resolved;
  }
  return themes;
};

/** Nunca lança: metadata malformada vira um pacote vazio, e o tema segue sem aquelas cores. */
export const asThemeTokenBundle = (metadata: unknown): ThemeTokenBundle | null => {
  if (!isPlainObject(metadata)) return null;
  const light = side(metadata.light);
  const dark = side(metadata.dark);
  const themes = byTheme(metadata.themes);
  const empty = Object.keys(light).length === 0
    && Object.keys(dark).length === 0
    && Object.keys(themes).length === 0;
  if (empty) return null;
  return Object.keys(themes).length === 0 ? { light, dark } : { light, dark, themes };
};

/**
 * Achata os pacotes para o tema em vigor: primeiro o piso do lado que ele estende, depois o
 * afinamento de quem conhece aquele tema pelo nome.
 *
 * Duas ordens se cruzam aqui, e trocá-las inverteria o resultado:
 *
 * 1. Entre os dois NÍVEIS, o específico sobrepõe o piso — sempre, qualquer que seja o plugin. É o
 *    que faz `themes.themis` valer sobre o `light` do próprio pacote.
 * 2. Dentro do mesmo nível, quem chega PRIMEIRO vence e não é sobrescrito. `bundles` chega na ordem
 *    do `ContributionRegistry` (prioridade desc, empate por pluginId), então o resultado é o mesmo
 *    entre um boot e outro — nunca "quem instalou por último".
 *
 * Dois plugins disputando o mesmo nome de token é problema de quem escolheu o nome, não do
 * mecanismo: um token normalmente carrega o vocabulário de quem o declara (`caseStatusWon`), e quem
 * quiser mexer no que não é seu tem o caminho próprio — contribuir um TEMA, que sobrepõe tudo.
 */
export const resolveThemeTokens = (
  bundles: ThemeTokenBundle[],
  base: ThemeBase,
  themeId?: string,
): Record<string, string> => {
  const floor: Record<string, string> = {};
  const tuned: Record<string, string> = {};

  for (const bundle of bundles) {
    for (const [key, value] of Object.entries(bundle[base])) {
      if (!(key in floor)) floor[key] = value;
    }
    const forTheme = themeId === undefined ? undefined : bundle.themes?.[themeId];
    if (!forTheme) continue;
    for (const [key, value] of Object.entries(forTheme)) {
      if (!(key in tuned)) tuned[key] = value;
    }
  }

  return { ...floor, ...tuned };
};
