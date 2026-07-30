import type { PluginRecord } from '../../kernel';
import {
  DATA_EXTENSION_POINTS,
  ENTITY_CONTRIBUTIONS,
  FIELD_RULE_PRESET_CONTRIBUTIONS,
  LOOKUP_CONTRIBUTIONS,
  LOOKUP_PROVIDER_CONTRIBUTIONS,
} from '../../domain/schema/dataExtensionPoints';

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
    kernel: '^1.0.0',
    name: 'Entidades e Listas',
    description:
      'Declara os pontos de dados e expõe as entidades nativas, os lookups, as máscaras/formatações/validações prontas e as buscas de dados externos do sistema.',
    extensionPoints: DATA_EXTENSION_POINTS,
    contributes: [
      ...ENTITY_CONTRIBUTIONS,
      ...LOOKUP_CONTRIBUTIONS,
      ...FIELD_RULE_PRESET_CONTRIBUTIONS,
      ...LOOKUP_PROVIDER_CONTRIBUTIONS,
    ],
  },
};
