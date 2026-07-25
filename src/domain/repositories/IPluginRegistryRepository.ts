import type { MarketplacePlugin } from '../entities/MarketplacePlugin';

/**
 * O registro global de plugins publicados — coleção-raiz `plugin_registry`: qualquer autenticado LÊ;
 * só a equipe global (SYSTEM) PUBLICA. É o que permite adicionar um plugin sem um deploy do frontend.
 */
export interface PublishedPlugin extends MarketplacePlugin {
  publishedAt: Date;
  publishedBy: string;
}

export interface IPluginRegistryRepository {
  subscribe(onUpdate: (plugins: PublishedPlugin[]) => void): () => void;
  getAll(): Promise<PublishedPlugin[]>;
  publish(plugin: MarketplacePlugin, publishedBy: string): Promise<void>;
  unpublish(pluginId: string): Promise<void>;
}
