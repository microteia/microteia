import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import type { PublishedPlugin } from '../../repositories/IPluginRegistryRepository';

export type PluginSource = 'published' | 'builtin';

/**
 * Catálogo mostrado = plugins publicados no registro ∪ exemplos embutidos, deduplicados por id
 * (o publicado vence). Extraído do PluginStore para ser testável sem React nem Firebase.
 */
export const mergeCatalog = (
  published: PublishedPlugin[],
  builtin: MarketplacePlugin[],
): MarketplacePlugin[] => {
  const publishedIds = new Set(published.map((plugin) => plugin.manifest.id));
  const builtinOnly = builtin.filter((plugin) => !publishedIds.has(plugin.manifest.id));
  return [...published, ...builtinOnly];
};

export const pluginSourceOf = (published: PublishedPlugin[], pluginId: string): PluginSource =>
  published.some((plugin) => plugin.manifest.id === pluginId) ? 'published' : 'builtin';
