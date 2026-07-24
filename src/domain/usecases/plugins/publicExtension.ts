import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import { compareSemVer, parseSemVer } from '../../schema/plugin/semver';

/** Extensão "com código" = traz ao menos uma view de código. É o que exige aprovação do SYSTEM. */
export const extensionHasCode = (pkg: MarketplacePlugin): boolean => (pkg.views?.length ?? 0) > 0;

/**
 * Status inicial na publicação: com código entra `pending` (aguarda aprovação do SYSTEM); sem código
 * já entra `approved`. As Rules exigem exatamente essa correspondência de quem não é SYSTEM.
 */
export const initialPublicStatus = (pkg: MarketplacePlugin): 'pending' | 'approved' =>
  extensionHasCode(pkg) ? 'pending' : 'approved';

/** `a` é estritamente maior que `b` em semver? (usado para exigir bump de versão ao republicar). */
export const isVersionGreater = (a: string, b: string): boolean => {
  const pa = parseSemVer(a);
  const pb = parseSemVer(b);
  if (!pa || !pb) return false;
  return compareSemVer(pa, pb) > 0;
};
