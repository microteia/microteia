import type { PluginRecord } from '../../kernel';
import { UI_EXTENSION_POINTS } from '../../domain/schema/ui/uiExtensionPoints';
import { messageBundleContribution } from '../../domain/schema/i18n/extensionPoints';
import { coreMessage, CORE_UI_MESSAGES } from '../coreMessages';

export const coreUiPlugin: PluginRecord = {
  trusted: true,
  manifest: {
    id: 'core.ui',
    version: '1.0.0',
    kernel: '^1.0.0',
    // eslint-disable-next-line no-restricted-syntax -- metadado do plugin do NÚCLEO: não é renderizado.
    name: 'Interface Core',
    // eslint-disable-next-line no-restricted-syntax -- metadado do plugin do NÚCLEO: não é renderizado.
    description: 'Declares the interface extension points: pages, navigation and Command Palette.',
    extensionPoints: UI_EXTENSION_POINTS,
    contributes: [
      messageBundleContribution(coreMessage('core.ui', CORE_UI_MESSAGES)),
    ],
  },
};
