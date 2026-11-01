import type { AuditAction } from '../entities/AuditLog';
import type { EntityMetadata } from '../schema/entityRegistry';
import type { IScreenDefinitionProvider } from '../repositories/IScreenDefinitionProvider';
import { RESERVED_COLLECTIONS, resolveEntity } from '../schema/screenEntity';
import { PORTAL_TEXTS_COLLECTION } from '../schema/portalCollections';

type EntityData = Record<string, unknown>;

/**
 * Não há rótulo aqui, e é de propósito: quem nomeia a coleção é a tela instalada no momento em que
 * alguém lê o log, e é a tela de Auditoria que o resolve. O que a auditoria grava é a IDENTIDADE
 * (`entityKey`), que sobrevive a uma renomeação.
 */
export interface AuditableEntityConfig {
  entityKey: string;
  getDisplayName: (data: EntityData) => string;
  getEntityLink?: (tenantId: string, docId: string, parentId?: string, data?: EntityData) => string;
  /** Restringe quais ações geram log (ex: Pushes só audita UPDATE/DELETE). Sem isso, audita CREATE/UPDATE/DELETE. */
  auditActions?: AuditAction[];
}

export const truncate = (text: string, max: number): string =>
  text.length > max ? `${text.slice(0, max)}…` : text;

export const asString = (v: unknown, fallback = '@core.admin/audit.entity.unnamed'): string =>
  typeof v === 'string' && v.trim() ? v.trim() : fallback;

const FLAT_ENTITY_CONFIG: Record<string, AuditableEntityConfig> = {
  members: {
    entityKey: 'TenantMember',
    getDisplayName: (d) => asString(d.displayName ?? d.email),
  },
  roles: {
    entityKey: 'Role',
    getDisplayName: (d) => asString(d.name),
  },
  screenDefinitions: {
    entityKey: 'ScreenDefinition',
    getDisplayName: (d) => asString(d.titlePlural ?? d.titleSingular),
    getEntityLink: () => 'screen-builder',
  },
  // O texto que o escritório pôs no lugar do texto de um pacote, no portal — a lei de um município, a
  // ajuda. O log guarda o antes e o depois de cada idioma: é o que mostra o que o convidado leu e quando.
  [PORTAL_TEXTS_COLLECTION]: {
    entityKey: 'PortalText',
    getDisplayName: (d) => asString(d.ref),
    getEntityLink: () => 'tenant-settings:portal-texts',
  },
};

const NESTED_ENTITY_CONFIG: Record<string, Record<string, AuditableEntityConfig>> = {
  __screenRecord__: {
    notes: {
      entityKey: 'RecordNote',
      getDisplayName: (d) => truncate(asString(d.title ?? d.text, 'Nota'), 60),
      getEntityLink: (_tenantId, _docId, parentId, data) =>
        `view-dyn:${asString(data?.collection, '')}:${parentId}`,
    },
    documents: {
      entityKey: 'CustomRecordDocument',
      getDisplayName: (d) => asString(d.name),
      getEntityLink: (_tenantId, _docId, parentId, data) =>
        `view-dyn:${asString(data?.screenKey, '')}:${parentId}`,
    },
  },
  screenDefinitions: {
    tags: {
      entityKey: 'CustomRecordTag',
      getDisplayName: (d) => asString(d.name),
      getEntityLink: (_tenantId, _docId, parentId) => `dyn:${parentId}`,
    },
  },
};

const heuristicName = (d: EntityData): string =>
  asString(d.nome ?? d.name ?? d.titulo ?? d.title, 'Registro');

const declaredName = (d: EntityData, entity: EntityMetadata | undefined): string | undefined => {
  for (const key of entity?.displayNameFields ?? []) {
    const value = d[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
};

/**
 * Registro de uma tela declarada (Form Design ou extensão): quem é a entidade só se sabe em runtime.
 * A identidade vem da MESMA resolução que a tela e a automação usam — título no singular e no plural,
 * campos que dão nome ao registro —, e é por isso que a auditoria diz "Contrato" no dia em que
 * Contrato deixa de ser do kernel. Sem declaração (tela desinstalada, coleção órfã) sobra o rótulo
 * genérico.
 *
 * A chave gravada é a COLEÇÃO, não o título: é o que o filtro e o link do log usam, e ela sobrevive
 * a uma renomeação da tela — o rótulo é resolvido de novo a cada exibição.
 */
const screenRecordConfig = (collection: string, entity?: EntityMetadata): AuditableEntityConfig => ({
  entityKey: collection,
  getDisplayName: (d) => declaredName(d, entity) ?? heuristicName(d),
  getEntityLink: (_tenantId, docId) => `view-dyn:${collection}:${docId}`,
  // Quais ações auditar é DECLARAÇÃO da tela, e chega aqui pela mesma resolução que dá o nome. Este
  // arquivo já teve o nome de uma coleção de extensão escrito dentro dele, com a lista de ações ao
  // lado; era a única forma de dizer "não audite a inclusão" e custava o kernel conhecer a extensão.
  ...(entity?.auditActions ? { auditActions: entity.auditActions } : {}),
});

/** As subcoleções que ganham identidade própria: `contracts#notes` em vez de só `contracts`. */
const NESTED_SCREEN_PARTS = new Set(['notes', 'documents']);

/**
 * A nota e o documento pertencem ao registro, e a chave do log diz isso — `contracts#notes`. O nome
 * ("Nota de Contrato") é montado na exibição, a partir da tela que descreve o pai hoje.
 */
const screenNestedConfig = (
  base: AuditableEntityConfig,
  parentCollection: string,
  subCollection: string,
  entity?: EntityMetadata,
): AuditableEntityConfig => {
  if (!entity || !NESTED_SCREEN_PARTS.has(subCollection)) return base;
  return { ...base, entityKey: `${parentCollection}#${subCollection}` };
};

const isScreenCollection = (collection: string): boolean =>
  !RESERVED_COLLECTIONS.has(collection) && !FLAT_ENTITY_CONFIG[collection];

export const getFlatEntityConfig = (collection: string, entity?: EntityMetadata): AuditableEntityConfig | null => {
  const config = FLAT_ENTITY_CONFIG[collection];
  if (config) return config;
  return isScreenCollection(collection) ? screenRecordConfig(collection, entity) : null;
};

/**
 * A configuração da coleção com a identidade que o TENANT declara. Só busca as telas quando a
 * coleção não é uma das fixas — nas fixas o nome está no código e nada precisa ser lido.
 */
export const resolveFlatEntityConfig = async (
  provider: IScreenDefinitionProvider,
  tenantId: string,
  collection: string,
): Promise<AuditableEntityConfig | null> => {
  const config = FLAT_ENTITY_CONFIG[collection];
  if (config) return config;
  if (!isScreenCollection(collection)) return null;
  const ctx = await provider.getSchemaContext(tenantId);
  return screenRecordConfig(collection, resolveEntity(ctx, collection));
};

export const resolveNestedEntityConfig = async (
  provider: IScreenDefinitionProvider,
  tenantId: string,
  parentCollection: string,
  subCollection: string,
): Promise<AuditableEntityConfig | null> => {
  const config = NESTED_ENTITY_CONFIG[parentCollection]?.[subCollection];
  if (config) return config;
  if (!isScreenCollection(parentCollection)) return null;
  const base = NESTED_ENTITY_CONFIG.__screenRecord__?.[subCollection];
  if (!base) return null;
  const ctx = await provider.getSchemaContext(tenantId);
  return screenNestedConfig(base, parentCollection, subCollection, resolveEntity(ctx, parentCollection));
};
