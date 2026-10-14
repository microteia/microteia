import type { PluginRecord } from '../../kernel';
import { ADMIN_NAV_GROUP, UI_EXTENSION_POINTS } from '../../domain/schema/ui/uiExtensionPoints';
import { navGroup } from '../contributionBuilders';
import { messageBundleContribution } from '../../domain/schema/i18n/extensionPoints';
import { coreMessage, CORE_UI_MESSAGES } from '../coreMessages';

export const coreUiPlugin: PluginRecord = {
  trusted: true,
  manifest: {
    id: 'core.ui',
    version: '1.0.0',
    kernel: '^2.0.0',
    // eslint-disable-next-line no-restricted-syntax -- metadado do plugin do NÚCLEO: não é renderizado.
    name: 'Interface Core',
    // eslint-disable-next-line no-restricted-syntax -- metadado do plugin do NÚCLEO: não é renderizado.
    description: 'Declares the interface extension points: pages, navigation and Command Palette.',
    extensionPoints: UI_EXTENSION_POINTS,
    contributes: [
      messageBundleContribution(coreMessage('core.ui', CORE_UI_MESSAGES)),
      navGroup({ key: ADMIN_NAV_GROUP, label: '@core.ui/nav.group.admin', order: 110 }),
    ],
  },
};
