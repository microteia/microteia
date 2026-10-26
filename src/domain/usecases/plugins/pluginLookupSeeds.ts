import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import { LOOKUP_SEED_MODES, LOOKUP_SEED_SINCE_KERNEL, isLookupSeedMode } from '../../schema/lookupSeed';
import { isLookupCollection } from '../../schema/lookupRegistry';
import { rangeExcludesBelow } from '../../schema/plugin/semver';
import type { LocalizedIssue } from './pluginReferences';

/**
 * A semeadura das listas do pacote: o `seed` declarado e o `kernel`.
 *
 * O `kernel` é de GARANTIA, como o de `editWindow`: um kernel anterior ignora `seed: 'required'` e não
 * semeia lista do kernel nenhuma — a extensão instalaria sem as opções de que depende, sem aviso.
 */
export const packageLookupSeedIssues = (pkg: MarketplacePlugin): LocalizedIssue[] => {
  const lookups = pkg.lookups ?? [];

  const shape = lookups
    .filter((lookup) => lookup.seed !== undefined && !isLookupSeedMode(lookup.seed))
    .map((lookup): LocalizedIssue => ({
      message: '@core.marketplace/issue.lookup.seed-mode',
      messageParams: { collection: lookup.collection, seed: String(lookup.seed), expected: LOOKUP_SEED_MODES.join(', ') },
    }));

  const needsKernel = lookups.find((lookup) =>
    (lookup.options?.length ?? 0) > 0 && (lookup.seed === 'required' || isLookupCollection(lookup.collection)));
  const kernel = needsKernel && !rangeExcludesBelow(pkg.manifest.kernel ?? '', LOOKUP_SEED_SINCE_KERNEL)
    ? [{
      message: '@core.marketplace/issue.lookup.seed-kernel',
      messageParams: { collection: needsKernel.collection, minimum: LOOKUP_SEED_SINCE_KERNEL },
    }]
    : [];

  return [...shape, ...kernel];
};
