import type { PluginRecord } from '../../kernel';
import { CAPABILITY_EXTENSION_POINTS } from '../capabilityExtensionPoints';

export const coreCapabilitiesPlugin: PluginRecord = {
  trusted: true,
  manifest: {
    id: 'core.capabilities',
    version: '1.0.0',
    kernel: '^1.0.0',
    name: 'Capacidades',
    description: 'Declara o ponto de extensão onde plugins fornecem implementações de Capabilities.',
    extensionPoints: CAPABILITY_EXTENSION_POINTS,
  },
};
