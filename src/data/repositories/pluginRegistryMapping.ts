import { pruneUndefined } from '../utils/pruneUndefined';
import type { PublishedPlugin } from '../../domain/repositories/IPluginRegistryRepository';
import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import { toDateValueOrNow as toDate } from '../utils/toDateValue';

/**
 * Corpo do documento de `plugin_registry` a partir de um pacote — o pacote INTEIRO, não só
 * manifest/summary/workflows (era o bug: `views`, `screens`, `actions`, `scripts` e `overview`
 * ficavam de fora e a extensão publicada chegava sem código/telas a quem instalava). `pruneUndefined`
 * remove as chaves ausentes. Timestamp de publicação é acrescentado pelo repositório.
 */
export const registryDataFromPlugin = (plugin: MarketplacePlugin): Record<string, unknown> =>
  pruneUndefined({
    manifest: plugin.manifest,
    summary: plugin.summary,
    workflows: plugin.workflows,
    screens: plugin.screens,
    actions: plugin.actions,
    scripts: plugin.scripts,
    views: plugin.views,
    overview: plugin.overview,
  });

/** Reconstrói o `PublishedPlugin` a partir do documento — o inverso de `registryDataFromPlugin`. */
export const pluginFromRegistryDoc = (id: string, d: Record<string, unknown>): PublishedPlugin => ({
  manifest: (d.manifest as PublishedPlugin['manifest']) ?? { id, version: '0.0.0', kernel: '*', name: id },
  summary: (d.summary as string | undefined) ?? '',
  workflows: (d.workflows as PublishedPlugin['workflows']) ?? [],
  screens: d.screens as PublishedPlugin['screens'],
  actions: d.actions as PublishedPlugin['actions'],
  scripts: d.scripts as PublishedPlugin['scripts'],
  views: d.views as PublishedPlugin['views'],
  overview: d.overview,
  publishedAt: toDate(d.publishedAt),
  publishedBy: (d.publishedBy as string | undefined) ?? '',
});
