import type { PluginRecord } from '../../kernel';
import { messageBundleContribution } from '../../domain/schema/i18n/extensionPoints';
import { coreMessage, CORE_DATA_MESSAGES } from '../coreMessages';
import {
  DATA_EXTENSION_POINTS,
  ENTITY_CONTRIBUTIONS,
  FIELD_RULE_PRESET_CONTRIBUTIONS,
  LOOKUP_CONTRIBUTIONS,
  LOOKUP_PROVIDER_CONTRIBUTIONS,
} from '../../domain/schema/dataExtensionPoints';
import { TIME_EXTENSION_POINTS } from '../../domain/schema/time/extensionPoints';

/**
 * Expõe ao Kernel as entidades nativas e os lookups da Microteia. Os dados em si continuam morando
 * no schema (camada de domínio); aqui eles viram contribuições consultáveis. Declarar o ponto e as
 * contribuições no mesmo plugin é permitido — um plugin pode contribuir para um ponto que ele mesmo
 * declara.
 */
export const coreDataPlugin: PluginRecord = {
  trusted: true,
  manifest: {
    id: 'core.data',
    version: '1.0.0',
    kernel: '^2.0.0',
    // eslint-disable-next-line no-restricted-syntax -- metadado do plugin do NÚCLEO: não é renderizado.
    name: 'Entities and Lists',
    description:
      // eslint-disable-next-line no-restricted-syntax -- metadado do plugin do NÚCLEO: não é renderizado.
      'Declares the data extension points and exposes the native entities, lookups, ready-made masks/formats/validations and external data lookups.',
    extensionPoints: [...DATA_EXTENSION_POINTS, ...TIME_EXTENSION_POINTS],
    contributes: [
      messageBundleContribution(coreMessage('core.data', CORE_DATA_MESSAGES)),
      ...ENTITY_CONTRIBUTIONS,
      ...LOOKUP_CONTRIBUTIONS,
      ...FIELD_RULE_PRESET_CONTRIBUTIONS,
      ...LOOKUP_PROVIDER_CONTRIBUTIONS,
    ],
  },
};
