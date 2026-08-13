import type { PluginRecord } from '../../kernel';
import { lazyView, page } from '../contributionBuilders';
import { messageBundleContribution } from '../../domain/schema/i18n/extensionPoints';
import { coreMessage, CORE_MARKETPLACE_MESSAGES } from '../coreMessages';

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
      messageBundleContribution(coreMessage('core.marketplace', CORE_MARKETPLACE_MESSAGES)),
      page({ key: 'marketplace', title: '@core.marketplace/page.marketplace', icon: 'store' }, 'MarketplaceView'),
      page({ key: 'plugin-author', title: '@core.marketplace/page.plugin-author', icon: 'magic' }, 'PluginAuthorView'),
      page({ key: '', keyPrefix: 'plugin-author:', title: '@core.marketplace/page.plugin-author-edit', icon: 'magic' }, 'PluginAuthorView'),
    ],
  },
};
