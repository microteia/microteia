import type { PluginRecord } from '../../kernel';
import { CAPABILITY_EXTENSION_POINTS } from '../capabilityExtensionPoints';

export const coreCapabilitiesPlugin: PluginRecord = {
  trusted: true,
  manifest: {
    id: 'core.capabilities',
    version: '1.0.0',
    kernel: '^1.0.0',
    name: 'Capacidades',
    description:
      '@core.marketplace/plugin.capabilities.description',
    extensionPoints: CAPABILITY_EXTENSION_POINTS,
  },
};
