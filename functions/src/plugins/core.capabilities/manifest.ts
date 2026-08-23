import type { PluginRecord } from '../../kernel';
import { CAPABILITY_EXTENSION_POINTS } from '../capabilityExtensionPoints';

export const coreCapabilitiesPlugin: PluginRecord = {
  trusted: true,
  manifest: {
    id: 'core.capabilities',
    version: '1.0.0',
    kernel: '^2.0.0',
    // eslint-disable-next-line no-restricted-syntax -- metadado do plugin do NÚCLEO: não é renderizado.
    name: 'Capabilities',
    description:
      '@core.marketplace/plugin.capabilities.description',
    extensionPoints: CAPABILITY_EXTENSION_POINTS,
  },
};
