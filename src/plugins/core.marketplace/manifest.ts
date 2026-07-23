import type { PluginRecord } from '../../kernel';
import { lazyView, nav, page } from '../contributionBuilders';

export const coreMarketplacePlugin: PluginRecord = {
  trusted: true,
  implementations: {
    MarketplaceView: lazyView(() => import('../../presentation/pages/Marketplace/Marketplace.view'), 'MarketplaceView'),
    PluginAuthorView: lazyView(() => import('../../presentation/pages/PluginAuthor/PluginAuthor.view'), 'PluginAuthorView'),
  },
  manifest: {
    id: 'core.marketplace',
    version: '1.0.0',
    kernel: '^1.0.0',
    name: 'Extensões',
    dependencies: { 'core.ui': '^1.0.0' },
    contributes: [
      page({ key: 'marketplace', title: 'Extensões', icon: 'store' }, 'MarketplaceView'),
      nav({ key: 'marketplace', label: 'Extensões', icon: 'store', order: 105 }),
      page({ key: 'plugin-author', title: 'Criar extensão', icon: 'magic' }, 'PluginAuthorView'),
    ],
  },
};
