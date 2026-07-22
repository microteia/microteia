import type { PluginRecord } from '../../kernel';
import { UI_EXTENSION_POINTS } from '../../presentation/shared/uiExtensionPoints';

export const coreUiPlugin: PluginRecord = {
  trusted: true,
  manifest: {
    id: 'core.ui',
    version: '1.0.0',
    kernel: '^1.0.0',
    name: 'Núcleo da Interface',
    description: 'Declara os pontos de extensão de interface: telas, menu e Command Palette.',
    extensionPoints: UI_EXTENSION_POINTS,
  },
};
