import type { Contribution, QualifiedContribution } from '../plugin/contribution';
import type { ExtensionPointDefinition } from '../plugin/extensionPoint';
import type { ThemeSpec } from './themeSpec';
import { asThemeSpec } from './themeSpec';
import type { ThemeTokenBundle } from './themeTokens';
import { asThemeTokenBundle } from './themeTokens';

export const THEME_DEFINITION_POINT = 'theme.definition';
export const THEME_TOKENS_POINT = 'theme.tokens';

export const THEME_API_VERSION = '1.0.0';

/**
 * Os dois pontos que tiram a aparência do núcleo.
 *
 * `allowedImplKinds: []` nos dois, e é a decisão central — a mesma que vale para tradução. Uma
 * paleta é METADATA PURA: não há código para revisar, então não há gesto de confiança a exigir, e um
 * `.json` que alguém montou à mão instala como qualquer extensão. Se um tema pudesse rodar código,
 * "trocar as cores" passaria a ser um risco de segurança, e a troca deixaria de ser trivial.
 *
 * São DOIS pontos porque são duas perguntas diferentes. `theme.definition` responde "com que
 * aparência o sistema é lido" — é escolha, e só um vence. `theme.tokens` responde "que cores o meu
 * domínio precisa ter em qualquer aparência" — não é escolha, e todos valem ao mesmo tempo. Um
 * ponto só obrigaria cada domínio a publicar um tema inteiro para nomear duas cores suas.
 */
export const THEME_EXTENSION_POINTS: ExtensionPointDefinition[] = [
  {
    id: THEME_DEFINITION_POINT,
    apiVersion: THEME_API_VERSION,
    title: '@core.theme/point.definition.title',
    description: '@core.theme/point.definition.description',
    ownerPluginId: 'core.theme',
    allowedImplKinds: [],
    implRequired: false,
    multiple: true,
  },
  {
    id: THEME_TOKENS_POINT,
    apiVersion: THEME_API_VERSION,
    title: '@core.theme/point.tokens.title',
    description: '@core.theme/point.tokens.description',
    ownerPluginId: 'core.theme',
    allowedImplKinds: [],
    implRequired: false,
    multiple: true,
  },
];

const contributionId = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9.-]+/g, '-');

export const themeContribution = (spec: ThemeSpec, priority?: number): Contribution => ({
  point: THEME_DEFINITION_POINT,
  id: contributionId(spec.id),
  apiVersion: THEME_API_VERSION,
  ...(priority === undefined ? {} : { priority }),
  metadata: spec as unknown as Record<string, unknown>,
});

export const themeTokensContribution = (
  id: string,
  bundle: ThemeTokenBundle,
  priority?: number,
): Contribution => ({
  point: THEME_TOKENS_POINT,
  id: contributionId(id),
  apiVersion: THEME_API_VERSION,
  ...(priority === undefined ? {} : { priority }),
  metadata: bundle as unknown as Record<string, unknown>,
});

/**
 * Os temas de uma lista de contribuições, PRESERVANDO a ordem do registro.
 *
 * Duas regras de posse, e as duas existem porque o `id` de um tema é a chave da preferência de quem
 * o escolheu:
 *
 * 1. **Um id, um tema.** Repetido, vence quem chega primeiro — que é a ordem determinística do
 *    `ContributionRegistry` (prioridade desc, empate por pluginId), e não quem instalou por último.
 * 2. **Id RESERVADO só vale do dono.** `reserved` mapeia id → pluginId que o reivindica. Sem isso,
 *    um pacote instalado no escritório podia declarar `id: 'dark'` e — bastando um pluginId
 *    alfabeticamente anterior — passar na frente do tema do sistema, trocando a aparência de todo
 *    mundo por baixo dos panos. O tema do sistema não se desinstala nem se sobrepõe: quem quer
 *    variar publica um id próprio, e o dele fica AO LADO.
 */
export const themeSpecsOf = (
  contributions: QualifiedContribution[],
  reserved: Readonly<Record<string, string>> = {},
): ThemeSpec[] => {
  const specs: ThemeSpec[] = [];
  const claimed = new Set<string>();
  for (const contribution of contributions) {
    const spec = asThemeSpec(contribution.metadata);
    if (!spec) continue;
    if (claimed.has(spec.id)) continue;
    const owner = reserved[spec.id];
    if (owner !== undefined && owner !== contribution.pluginId) continue;
    claimed.add(spec.id);
    specs.push(spec);
  }
  return specs;
};

/** Os pacotes de tokens, na mesma ordem — é dela que `tokensForBase` depende para desempatar. */
export const themeTokenBundlesOf = (contributions: Contribution[]): ThemeTokenBundle[] => {
  const bundles: ThemeTokenBundle[] = [];
  for (const contribution of contributions) {
    const bundle = asThemeTokenBundle(contribution.metadata);
    if (bundle) bundles.push(bundle);
  }
  return bundles;
};
