// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/entities/entitySchemas.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import { ENTITY_REGISTRY_LIST } from '../schema/entityRegistry';
import type {
  CustomFieldMask,
  CustomFieldOption,
  CustomFieldType,
  FieldAggregation,
  FieldLogic,
  FieldRules,
} from '../schema/fieldRules';

// ─── Tipos de Campos Customizados ─────────────────────────────────────────────

export type { CustomFieldType, CustomFieldMask, CustomFieldOption } from '../schema/fieldRules';

export type CustomFieldValue = string | string[] | number | boolean | null;

// ─── Definição de Campo ───────────────────────────────────────────────────────

export interface FieldDefinition {
  key: string;
  label: string;
  type: CustomFieldType;
  required: boolean;
  order: number;
  section?: string | null;
  options?: CustomFieldOption[];
  optionsAllowUserAdd?: boolean;
  optionsColored?: boolean;
  multi?: boolean;
  mask?: CustomFieldMask | null;
  refEntity?: string | null;
  lookupCollection?: string | null;
  placeholder?: string | null;
  showInList?: boolean;
  listLabel?: string | null;
  filterable?: boolean;
  rules?: FieldRules | null;
  logic?: FieldLogic | null;
  aggregation?: FieldAggregation | null;
}

// ─── Definição de Tela ────────────────────────────────────────────────────────

export type ScreenListAction = 'copyLink' | 'clone' | 'manageTags' | 'delete';

export interface ScreenDefinition {
  id: string;
  tenantId: string;
  builtin: boolean;
  titleSingular: string;
  titlePlural: string;
  icon: string;
  fields: FieldDefinition[];
  titleFieldKey: string;
  hasNotes: boolean;
  hasDocuments: boolean;
  hasTags: boolean;
  listActions: ScreenListAction[];
  /** Ids de `ActionDefinition` exibidos no cabeçalho da tela de detalhe. */
  viewActionIds: string[];
  /** Ids de `ActionDefinition` exibidos no card da listagem. */
  cardActionIds: string[];
  /**
   * Quando presente, a tela é FILHA de outra: sai do menu lateral e da busca ⌘K, e seus registros
   * aparecem como uma aba do registro-pai. Aceita a chave de uma tela fixa ('cases', 'contracts'…)
   * ou o id de uma tela dinâmica.
   */
  parentEntity?: string | null;
  /** Campo `reference` desta tela que guarda o id do registro-pai. */
  parentFieldKey?: string | null;
  sidebarOrder: number;
  enabled: boolean;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy?: string;
  updatedByName?: string;
  updatedByPhotoURL?: string;
  deletedBy?: string;
  deletedByName?: string;
  deletedByPhotoURL?: string;
}

// ─── Schema de Foreign Keys (derivado do ENTITY_REGISTRY) ─────────────────────

export interface FkFieldSpec {
  targetCollection: string;
  multi?: boolean;
  denormalizedFields?: string[];
}

const buildFkSchema = (): Record<string, Record<string, FkFieldSpec>> => {
  const schema: Record<string, Record<string, FkFieldSpec>> = {};
  for (const entity of ENTITY_REGISTRY_LIST) {
    if (entity.fks.length === 0) continue;
    const entitySchema: Record<string, FkFieldSpec> = {};
    for (const fk of entity.fks) {
      const spec: FkFieldSpec = { targetCollection: fk.targetCollection };
      if (fk.multi) spec.multi = true;
      if (fk.denormalizedFields) spec.denormalizedFields = fk.denormalizedFields;
      entitySchema[fk.key] = spec;
    }
    schema[entity.collection] = entitySchema;
  }
  return schema;
};

export const ENTITY_FK_SCHEMA: Record<string, Record<string, FkFieldSpec>> = buildFkSchema();

// ─── Coleções e Entidades (derivadas do ENTITY_REGISTRY) ──────────────────────

export const CUSTOM_FIELD_ENABLED_ENTITIES = new Set(
  ENTITY_REGISTRY_LIST.filter((entity) => entity.supportsCustomFields).map((entity) => entity.collection),
);

export const BUILTIN_REF_ENTITIES = new Set(
  ENTITY_REGISTRY_LIST.filter((entity) => entity.referenceable).map((entity) => entity.collection),
);

/**
 * Resolve a coleção de destino para um refEntity.
 * Se for uma entidade builtin, retorna o nome da coleção.
 * Caso contrário, retorna 'customRecords' (para telas customizadas).
 */
export const resolveRefEntityCollection = (refEntity: string): string =>
  BUILTIN_REF_ENTITIES.has(refEntity) ? refEntity : 'customRecords';
