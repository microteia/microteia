import type { ExtensionStats } from '../../entities/ExtensionReputation';
import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import { isScreenIconKey } from '../../schema/ui/screenIconCatalog';
import { isExtensionImage } from './pluginImage';

export const MAX_STARS = 5;

export type StarKind = 'full' | 'half' | 'empty';

/**
 * Quem responde pela autenticidade do publicador:
 * - `first-party` — o pacote é o que viaja no bundle (embutido ou parte do sistema): a procedência
 *   é o próprio código da aplicação;
 * - `verified` — o escritório que publicou foi verificado pela equipe global.
 */
export type PublisherVerification = 'first-party' | 'verified';

const GLYPH_POINTS = ['ui.nav', 'ui.page'];

/** A imagem declarada, quando ela é uma que a tela desenha. */
export const extensionImageOf = (pkg: MarketplacePlugin): string | null =>
  isExtensionImage(pkg.manifest?.image) ? pkg.manifest.image : null;

/**
 * O ícone que identifica a extensão quando ela não traz imagem: o que ela declarou, senão o da
 * primeira entrada de menu ou página que contribui, senão o da primeira tela ou view.
 *
 * Derivar é o que dá identidade às extensões que já existem sem que nenhuma precise ser republicada:
 * o Calendário aparece com o calendário que já desenha no menu. Só chave do catálogo serve — o que
 * não for chave conhecida é pulado, em vez de virar o marcador genérico.
 */
export const extensionGlyphOf = (pkg: MarketplacePlugin): string | null => {
  const candidates: unknown[] = [
    pkg.manifest?.icon,
    ...GLYPH_POINTS.flatMap((point) =>
      (pkg.manifest?.contributes ?? [])
        .filter((contribution) => contribution?.point === point)
        .map((contribution) => contribution?.metadata?.icon),
    ),
    ...(pkg.screens ?? []).map((screen) => screen.icon),
    ...(pkg.views ?? []).map((view) => view.icon),
  ];
  const found = candidates.find((candidate) => isScreenIconKey(candidate));
  return typeof found === 'string' ? found : null;
};

/** A média, ou `null` sem voto nenhum — zero estrelas não é nota, é ausência dela. */
export const ratingAverage = (stats: ExtensionStats | undefined): number | null =>
  stats && stats.ratingCount > 0 ? stats.ratingSum / stats.ratingCount : null;

/** As cinco estrelas de uma média, arredondada à meia estrela mais próxima. */
export const starsOf = (average: number): StarKind[] => {
  const halves = Math.round(Math.min(Math.max(average, 0), MAX_STARS) * 2);
  return Array.from({ length: MAX_STARS }, (_, index) => {
    const remaining = halves - index * 2;
    return remaining >= 2 ? 'full' : remaining === 1 ? 'half' : 'empty';
  });
};

export interface VerificationInput {
  /** Pacote do sistema, ou embutido cuja cópia em uso é a do bundle. */
  firstParty: boolean;
  /** O escritório que publicou no catálogo, quando há publicação. */
  ownerTenantId: string | null;
  verifiedPublishers: ReadonlySet<string>;
}

/**
 * O selo vale para o PUBLICADOR, nunca para o nome que ele escreveu: `ownerName` é texto livre do
 * dono, e um selo que dependesse dele seria falsificável por quem chamasse a si mesmo de Microteia.
 */
export const publisherVerificationOf = (input: VerificationInput): PublisherVerification | null => {
  if (input.firstParty) return 'first-party';
  if (input.ownerTenantId !== null && input.verifiedPublishers.has(input.ownerTenantId)) return 'verified';
  return null;
};

/**
 * Ordena por um número do agregado, maior primeiro. Quem não tem o número vai para o fim — sem voto
 * não é nota zero, e sem contagem não é zero instalação —, e o empate cai no desempate dado, para que
 * a ordem não pule a cada atualização do agregado.
 */
export const compareByMetric = <T>(
  metric: (item: T) => number | null,
  tieBreak: (a: T, b: T) => number,
) => (a: T, b: T): number => {
  const left = metric(a);
  const right = metric(b);
  if (left === right) return tieBreak(a, b);
  if (left === null) return 1;
  if (right === null) return -1;
  return right - left;
};
