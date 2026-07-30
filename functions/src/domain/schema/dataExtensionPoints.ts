// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/dataExtensionPoints.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

import type { Contribution } from './plugin/contribution';
import type { ExtensionPointDefinition } from './plugin/extensionPoint';
import type { EntityMetadata } from './entityRegistry';
import { ENTITY_REGISTRY_LIST } from './entityRegistry';
import type { LookupMetadata } from './lookupRegistry';
import { LOOKUP_REGISTRY_LIST } from './lookupRegistry';
import type { FieldRulePreset } from './fieldRulePresets';
import { CORE_FIELD_RULE_PRESETS } from './fieldRulePresets';
import type { LookupProviderSpec } from './lookupProviderSpec';
import { CORE_LOOKUP_PROVIDERS, isValidLookupProvider } from './lookupProviderSpec';

export const DATA_ENTITY_POINT = 'data.entity';
export const DATA_LOOKUP_POINT = 'data.lookup';
export const DATA_SERVICE_POINT = 'data.service';
export const DATA_FIELD_RULE_PRESET_POINT = 'data.field.preset';
export const DATA_EXTERNAL_LOOKUP_POINT = 'data.external.lookup';

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
  {
    id: DATA_FIELD_RULE_PRESET_POINT,
    apiVersion: DATA_API_VERSION,
    title: 'Máscara, formatação e validação prontas',
    description:
      'Declara um preset de campo (máscara por template, pipeline de formatação, validação por expressão ou regex). Sem código: a mesma declaração vale no formulário e na gravação por automação.',
    ownerPluginId: 'core.data',
    allowedImplKinds: [],
    implRequired: false,
    multiple: true,
  },
  {
    id: DATA_EXTERNAL_LOOKUP_POINT,
    apiVersion: DATA_API_VERSION,
    title: 'Busca de dados externos',
    description:
      'Declara um provedor para "Ao alterar, buscar dados externos": a requisição inteira é dado (URL, quando disparar, mapa da resposta). Sem código — o kernel executa e impõe https, timeout e ausência de credencial.',
    ownerPluginId: 'core.data',
    allowedImplKinds: [],
    implRequired: false,
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

export const fieldRulePresetContribution = (preset: FieldRulePreset): Contribution => ({
  point: DATA_FIELD_RULE_PRESET_POINT,
  id: slugId(preset.key),
  apiVersion: DATA_API_VERSION,
  metadata: preset as unknown as Record<string, unknown>,
});

/** Lê de volta o preset de uma contribuição, descartando metadata malformada de terceiro. */
export const fieldRulePresetOf = (contribution: Contribution): FieldRulePreset | undefined => {
  const metadata = contribution.metadata as Partial<FieldRulePreset> | undefined;
  if (!metadata || typeof metadata.key !== 'string' || metadata.key.trim() === '') return undefined;
  if (typeof metadata.label !== 'string' || metadata.label.trim() === '') return undefined;
  return metadata as FieldRulePreset;
};

export const lookupProviderContribution = (provider: LookupProviderSpec): Contribution => ({
  point: DATA_EXTERNAL_LOOKUP_POINT,
  id: slugId(provider.key),
  apiVersion: DATA_API_VERSION,
  metadata: provider as unknown as Record<string, unknown>,
});

/** Lê de volta o provedor de uma contribuição, descartando declaração malformada ou com URL proibida. */
export const lookupProviderOf = (contribution: Contribution): LookupProviderSpec | undefined => {
  const metadata = contribution.metadata as unknown as LookupProviderSpec | undefined;
  return isValidLookupProvider(metadata) ? metadata : undefined;
};

export const ENTITY_CONTRIBUTIONS: Contribution[] = ENTITY_REGISTRY_LIST.map(entityContribution);

export const LOOKUP_CONTRIBUTIONS: Contribution[] = LOOKUP_REGISTRY_LIST.map(lookupContribution);

export const FIELD_RULE_PRESET_CONTRIBUTIONS: Contribution[] =
  CORE_FIELD_RULE_PRESETS.map(fieldRulePresetContribution);

export const LOOKUP_PROVIDER_CONTRIBUTIONS: Contribution[] =
  CORE_LOOKUP_PROVIDERS.map(lookupProviderContribution);
