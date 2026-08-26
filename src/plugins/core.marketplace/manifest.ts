import type { PluginRecord } from '../../kernel';
import { lazyView, menuItem, page } from '../contributionBuilders';
import { messageBundleContribution } from '../../domain/schema/i18n/extensionPoints';
import { PERMISSION_EXTENSIONS_MANAGE } from '../../domain/schema/access';
import { USER_MENU_SURFACE } from '../../domain/schema/ui/uiExtensionPoints';
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
    kernel: '^2.0.0',
    // eslint-disable-next-line no-restricted-syntax -- metadado do plugin do NÚCLEO: não é renderizado.
    name: 'Extensions',
    dependencies: { 'core.ui': '^1.0.0' },
    contributes: [
      messageBundleContribution(coreMessage('core.marketplace', CORE_MARKETPLACE_MESSAGES)),
      page({ key: 'marketplace', title: '@core.marketplace/page.marketplace', icon: 'store' }, 'MarketplaceView'),
      page({ key: 'plugin-author', title: '@core.marketplace/page.plugin-author', icon: 'magic' }, 'PluginAuthorView'),
      page({ key: '', keyPrefix: 'plugin-author:', title: '@core.marketplace/page.plugin-author-edit', icon: 'magic' }, 'PluginAuthorView'),
      menuItem({
        surface: USER_MENU_SURFACE,
        key: 'marketplace',
        title: '@core.marketplace/page.marketplace',
        icon: 'store',
        order: 80,
        requiredPermissions: [PERMISSION_EXTENSIONS_MANAGE],
        action: { kind: 'openTab', tabKey: 'marketplace' },
      }),
    ],
  },
};
