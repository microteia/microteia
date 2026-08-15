import type { AuditAction } from '../entities/AuditLog';
import type { EntityMetadata } from '../schema/entityRegistry';
import type { IScreenDefinitionProvider } from '../repositories/IScreenDefinitionProvider';
import { RESERVED_COLLECTIONS, resolveEntity } from '../schema/screenEntity';

type EntityData = Record<string, unknown>;

export interface AuditableEntityConfig {
  entityKey: string;
  /** REFERÊNCIA de mensagem, ou o rótulo que o escritório digitou; os `*Params` interpolam. */
  entityLabel: string;
  entityLabelParams?: Record<string, string>;
  entityLabelPlural: string;
  entityLabelPluralParams?: Record<string, string>;
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
    entityLabel: '@core.admin/audit.entity.tenant-member',
    entityLabelPlural: '@core.admin/audit.entity.tenant-member.plural',
    getDisplayName: (d) => asString(d.displayName ?? d.email),
  },
  personTags: {
    entityKey: 'PersonTag',
    entityLabel: '@core.admin/audit.entity.person-tag',
    entityLabelPlural: '@core.admin/audit.entity.person-tag.plural',
    getDisplayName: (d) => asString(d.name),
  },
  caseTags: {
    entityKey: 'CaseTag',
    entityLabel: '@core.admin/audit.entity.case-tag',
    entityLabelPlural: '@core.admin/audit.entity.case-tag.plural',
    getDisplayName: (d) => asString(d.name),
  },
  pushes: {
    entityKey: 'Push',
    entityLabel: '@core.admin/audit.entity.push',
    entityLabelPlural: '@core.admin/audit.entity.push.plural',
    getDisplayName: (d) => asString(d.subject ?? d.processNumber, 'Push'),
    // Criação é automática (Cloud Function do webhook do Gmail) — só interessa auditar
    // a triagem manual (mudança de status) e a exclusão.
    auditActions: ['UPDATE', 'DELETE'],
  },
  screenDefinitions: {
    entityKey: 'ScreenDefinition',
    entityLabel: '@core.admin/audit.entity.screen-definition',
    entityLabelPlural: '@core.admin/audit.entity.screen-definition.plural',
    getDisplayName: (d) => asString(d.titlePlural ?? d.titleSingular),
    getEntityLink: () => 'screen-builder',
  },
};

const NESTED_ENTITY_CONFIG: Record<string, Record<string, AuditableEntityConfig>> = {
  __screenRecord__: {
    notes: {
      entityKey: 'RecordNote',
      entityLabel: '@core.admin/audit.entity.record-note',
      entityLabelPlural: '@core.admin/audit.entity.record-note.plural',
      getDisplayName: (d) => truncate(asString(d.title ?? d.text, 'Nota'), 60),
      getEntityLink: (_tenantId, _docId, parentId, data) =>
        `view-dyn:${asString(data?.collection, '')}:${parentId}`,
    },
    documents: {
      entityKey: 'CustomRecordDocument',
      entityLabel: '@core.admin/audit.entity.custom-record-document',
      entityLabelPlural: '@core.admin/audit.entity.custom-record-document.plural',
      getDisplayName: (d) => asString(d.name),
      getEntityLink: (_tenantId, _docId, parentId, data) =>
        `view-dyn:${asString(data?.screenKey, '')}:${parentId}`,
    },
  },
  screenDefinitions: {
    tags: {
      entityKey: 'CustomRecordTag',
      entityLabel: '@core.admin/audit.entity.custom-record-tag',
      entityLabelPlural: '@core.admin/audit.entity.custom-record-tag.plural',
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
  entityLabel: entity?.labelSingular ?? '@core.admin/audit.entity.record',
  entityLabelPlural: entity?.labelPlural ?? '@core.admin/audit.entity.record.plural',
  getDisplayName: (d) => declaredName(d, entity) ?? heuristicName(d),
  getEntityLink: (_tenantId, docId) => `view-dyn:${collection}:${docId}`,
});

/** "Nota de Contrato" muda de ordem conforme o idioma, então a composição inteira é a chave. */
const NESTED_SCREEN_LABELS: Record<string, { singular: string; plural: string }> = {
  notes: {
    singular: '@core.admin/audit.entity.note-of',
    plural: '@core.admin/audit.entity.note-of.plural',
  },
  documents: {
    singular: '@core.admin/audit.entity.document-of',
    plural: '@core.admin/audit.entity.document-of.plural',
  },
};

/** A nota e o documento herdam a identidade do registro a que pertencem: "Nota de Contrato". */
const screenNestedConfig = (
  base: AuditableEntityConfig,
  parentCollection: string,
  subCollection: string,
  entity?: EntityMetadata,
): AuditableEntityConfig => {
  const labels = NESTED_SCREEN_LABELS[subCollection];
  if (!entity || !labels) return base;
  return {
    ...base,
    entityKey: `${parentCollection}#${subCollection}`,
    entityLabel: labels.singular,
    entityLabelParams: { name: entity.labelSingular },
    entityLabelPlural: labels.plural,
    entityLabelPluralParams: { name: entity.labelPlural },
  };
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
