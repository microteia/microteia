import type { Contribution } from '../domain/schema/plugin/contribution';
import type { ExtensionPointDefinition } from '../domain/schema/plugin/extensionPoint';

export const CAPABILITY_PROVIDER_POINT = 'capability.provider';

export const CAPABILITY_API_VERSION = '1.0.0';

/**
 * O manifest DECLARA a capability em `provides` (é o que o Marketplace lista e o que satisfaz o
 * `consumes` de outro plugin); a contribuição CARREGA a implementação. A separação é a mesma de
 * sempre: metadata serializável de um lado, código do outro.
 */
export interface CapabilityProviderMetadata {
  capability: string;
  version: string;
  /** Chave pela qual a configuração do escritório escolhe este provedor (ex.: 'openai'). */
  providerKey: string;
  label: string;
}

export const CAPABILITY_EXTENSION_POINTS: ExtensionPointDefinition[] = [
  {
    id: CAPABILITY_PROVIDER_POINT,
    apiVersion: CAPABILITY_API_VERSION,
    title: 'Provedor de uma capacidade',
    description:
      'Fornece a implementação de uma Capability (IA, mensageria, pagamentos). Vários plugins podem fornecer a mesma, e o escritório escolhe qual usar.',
    ownerPluginId: 'core.capabilities',
    allowedImplKinds: ['code'],
    implRequired: true,
    multiple: true,
  },
];

export const capabilityProvider = (
  metadata: CapabilityProviderMetadata,
  implKey: string,
): Contribution => ({
  point: CAPABILITY_PROVIDER_POINT,
  id: `${metadata.capability}-${metadata.providerKey}`.replace(/[^a-z0-9-]/g, '-'),
  apiVersion: CAPABILITY_API_VERSION,
  metadata: { ...metadata } as unknown as Record<string, unknown>,
  impl: { kind: 'code', key: implKey },
});
