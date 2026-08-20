import type { PluginRecord } from '../../kernel';
import {
  DATA_EXTENSION_POINTS,
  ENTITY_CONTRIBUTIONS,
  LOOKUP_CONTRIBUTIONS,
} from '../../domain/schema/dataExtensionPoints';

/**
 * Espelho backend de core.data. As entidades e lookups são os mesmos objetos do schema (arquivo
 * gerado por sync-schemas), então os dois lados enxergam exatamente o mesmo catálogo.
 */
export const coreDataPlugin: PluginRecord = {
  trusted: true,
  manifest: {
    id: 'core.data',
    version: '1.0.0',
    kernel: '^1.0.0',
    // eslint-disable-next-line no-restricted-syntax -- metadado do plugin do NÚCLEO: não é renderizado.
    name: 'Entities and Lists',
    description:
      '@core.data/plugin.data.description',
    extensionPoints: DATA_EXTENSION_POINTS,
    contributes: [...ENTITY_CONTRIBUTIONS, ...LOOKUP_CONTRIBUTIONS],
  },
};
