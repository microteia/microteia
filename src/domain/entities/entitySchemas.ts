// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/entities/entitySchemas.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Tipos de Campos Customizados ─────────────────────────────────────────────

export type CustomFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'currency'
  | 'date'
  | 'checkbox'
  | 'select'
  | 'masked'
  | 'reference'
  | 'markdown';

export type CustomFieldMask = 'cpf' | 'cnpj' | 'phone' | 'cep';

export interface CustomFieldOption {
  key: string;
  label: string;
  isStatic?: boolean;
  color?: string;
}

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
  placeholder?: string | null;
  showInList?: boolean;
  listLabel?: string | null;
  filterable?: boolean;
}

// ─── Definição de Tela ────────────────────────────────────────────────────────

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

// ─── Schema de Foreign Keys ───────────────────────────────────────────────────

export interface FkFieldSpec {
  targetCollection: string;
  multi?: boolean;
  denormalizedFields?: string[];
}

/**
 * Schema de Foreign Keys para entidades fixas.
 * Define quais campos são FKs e quais dados devem ser denormalizados ao fazer lookup.
 */
export const ENTITY_FK_SCHEMA: Record<string, Record<string, FkFieldSpec>> = {
  persons: {
    tagIds: { targetCollection: 'personTags', multi: true },
  },
  cases: {
    contractId: {
      targetCollection: 'contracts',
      denormalizedFields: ['number', 'title', 'type', 'status']
    },
    responsibleLawyerId: {
      targetCollection: 'members',
      denormalizedFields: ['name', 'email']
    },
    activePoleIds: { targetCollection: 'persons', multi: true },
    passivePoleIds: { targetCollection: 'persons', multi: true },
    tagIds: { targetCollection: 'caseTags', multi: true },
  },
  deadlines: {
    caseId: {
      targetCollection: 'cases',
      denormalizedFields: ['caseNumber', 'title', 'area']
    },
    responsibleLawyerId: {
      targetCollection: 'members',
      denormalizedFields: ['name', 'email']
    },
  },
  financials: {
    caseId: {
      targetCollection: 'cases',
      denormalizedFields: ['caseNumber', 'title']
    },
    personId: {
      targetCollection: 'persons',
      denormalizedFields: ['name', 'type']
    },
    contractId: {
      targetCollection: 'contracts',
      denormalizedFields: ['number', 'title']
    },
    tagIds: { targetCollection: 'financialTags', multi: true },
  },
  contracts: {
    clientId: {
      targetCollection: 'persons',
      denormalizedFields: ['name', 'type', 'email']
    },
    responsibleId: {
      targetCollection: 'members',
      denormalizedFields: ['name', 'email']
    },
    contractorIds: { targetCollection: 'persons', multi: true },
    contracteeIds: { targetCollection: 'persons', multi: true },
    witnessIds: { targetCollection: 'persons', multi: true },
    contractorLawyerIds: { targetCollection: 'persons', multi: true },
    contracteeLawyerIds: { targetCollection: 'persons', multi: true },
    tagIds: { targetCollection: 'contractTags', multi: true },
  },
};

// ─── Coleções e Entidades ─────────────────────────────────────────────────────

/**
 * Entidades fixas que suportam campos customizados (customValues).
 */
export const CUSTOM_FIELD_ENABLED_ENTITIES = new Set([
  'persons',
  'cases',
  'deadlines',
  'financials',
  'contracts',
]);

/**
 * Entidades builtin que podem ser referenciadas em campos do tipo "reference".
 */
export const BUILTIN_REF_ENTITIES = new Set([
  'persons',
  'cases',
  'contracts',
  'deadlines',
  'financials',
  'members',
]);

/**
 * Resolve a coleção de destino para um refEntity.
 * Se for uma entidade builtin, retorna o nome da coleção.
 * Caso contrário, retorna 'customRecords' (para telas customizadas).
 */
export const resolveRefEntityCollection = (refEntity: string): string =>
  BUILTIN_REF_ENTITIES.has(refEntity) ? refEntity : 'customRecords';
