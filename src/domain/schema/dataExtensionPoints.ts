import type { Contribution } from './plugin/contribution';
import type { ExtensionPointDefinition } from './plugin/extensionPoint';
import type { EntityMetadata } from './entityRegistry';
import { ENTITY_REGISTRY_LIST } from './entityRegistry';
import type { LookupMetadata } from './lookupRegistry';
import { LOOKUP_REGISTRY_LIST } from './lookupRegistry';

export const DATA_ENTITY_POINT = 'data.entity';
export const DATA_LOOKUP_POINT = 'data.lookup';
export const DATA_SERVICE_POINT = 'data.service';

export const DATA_API_VERSION = '1.0.0';

/**
 * As entidades e os lookups são METADATA PURA (sem `impl`) e vivem na camada de domínio, abaixo do
 * Kernel — por isso o schema continua sendo o dono do dado e o consome direto. As contribuições
 * abaixo os EXPÕEM ao Kernel: é o que torna o catálogo de entidades consultável, versionável e,
 * no futuro, publicável no Marketplace. Fonte única: os mesmos objetos do registro.
 */
export const DATA_EXTENSION_POINTS: ExtensionPointDefinition[] = [
  {
    id: DATA_ENTITY_POINT,
    apiVersion: DATA_API_VERSION,
    title: 'Entidade de domínio',
    description: 'Declara uma entidade nativa (coleção, campos, FKs) para o schema e o motor.',
    ownerPluginId: 'core.data',
    allowedImplKinds: [],
    implRequired: false,
    multiple: true,
  },
  {
    id: DATA_LOOKUP_POINT,
    apiVersion: DATA_API_VERSION,
    title: 'Lista de valores (lookup)',
    description: 'Declara uma coleção de lista simples (tipos, categorias, status).',
    ownerPluginId: 'core.data',
    allowedImplKinds: [],
    implRequired: false,
    multiple: true,
  },
  {
    id: DATA_SERVICE_POINT,
    apiVersion: DATA_API_VERSION,
    title: 'Serviço injetável de plugin',
    description:
      'Um plugin registra um serviço próprio (ex.: integração externa), resolvível por chave via useDI().resolveService. O container tipado do núcleo permanece intocado.',
    ownerPluginId: 'core.data',
    allowedImplKinds: ['code'],
    implRequired: true,
    multiple: true,
  },
];

export interface ServiceContributionMetadata {
  serviceKey: string;
  label?: string;
}

export const serviceContribution = (
  serviceKey: string,
  implKey: string,
  label?: string,
): Contribution => ({
  point: DATA_SERVICE_POINT,
  id: slugId(serviceKey),
  apiVersion: DATA_API_VERSION,
  metadata: { serviceKey, label } as unknown as Record<string, unknown>,
  impl: { kind: 'code', key: implKey },
});

const slugId = (value: string): string =>
  value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[^a-zA-Z0-9-]+/g, '-').toLowerCase();

export const entityContribution = (entity: EntityMetadata): Contribution => ({
  point: DATA_ENTITY_POINT,
  id: slugId(entity.key),
  apiVersion: DATA_API_VERSION,
  metadata: entity as unknown as Record<string, unknown>,
});

export const lookupContribution = (lookup: LookupMetadata): Contribution => ({
  point: DATA_LOOKUP_POINT,
  id: slugId(lookup.collection),
  apiVersion: DATA_API_VERSION,
  metadata: lookup as unknown as Record<string, unknown>,
});

export const ENTITY_CONTRIBUTIONS: Contribution[] = ENTITY_REGISTRY_LIST.map(entityContribution);

export const LOOKUP_CONTRIBUTIONS: Contribution[] = LOOKUP_REGISTRY_LIST.map(lookupContribution);
