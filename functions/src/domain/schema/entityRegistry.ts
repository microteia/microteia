// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/entityRegistry.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

import type {
  CustomFieldMask,
  CustomFieldOption,
  CustomFieldType,
  FieldAggregation,
  FieldLogic,
  FieldOrigin,
  FieldRules,
} from './fieldRules';

export const SCHEMA_VERSION = 1;

/**
 * Chave de entidade. Aberta para `string` a partir da Etapa 4b: o conjunto de entidades passou a
 * ser dado (contribuições `data.entity`), não uma união fechada no tipo. A validação de que uma
 * chave existe é de runtime, contra o registro — `getEntityByCollection`/`ctx.registry`.
 */
export type EntityKey = string;

/** As entidades nativas do Microteia. Mantida como união só para documentar o conjunto fixo. */
export type BuiltinEntityKey = 'members' | 'tenant';

export const BUILTIN_ENTITY_KEYS: readonly BuiltinEntityKey[] = ['members', 'tenant'] as const;

export type NativeFieldType = 'string' | 'number' | 'boolean' | 'date' | 'stringArray' | 'object';

// Apenas regras de APRESENTAÇÃO (como o campo é exibido/renderizado). Regras de negócio
// (required, options, optionsAllowUserAdd, rules, logic, multi...) ficam no NativeFieldSpec.
export interface FieldUiSpec {
  control?: CustomFieldType;
  mask?: CustomFieldMask;
  section?: string;
  order?: number;
  placeholder?: string;
  form?: boolean;
  list?: { icon?: string; order?: number };
  /** O campo vira filtro na listagem — o mesmo `filterable` da forma de autoria. */
  filter?: boolean;
}

/**
 * Forma CANÔNICA de um campo dentro da camada de schema, seja ele declarado em código (aqui),
 * num pacote de extensão ou no Form Design. `FieldDefinition` é a forma de autoria/UI e converte
 * para esta em `screenEntity.ts`.
 */
export interface NativeFieldSpec {
  key: string;
  label: string;
  type: NativeFieldType;
  lookupCollection?: string;
  objectFields?: NativeFieldSpec[];
  refEntity?: string;
  /** Nome de navegação do registro apontado — o `denormKey` das relações do registro. */
  refDenormKey?: string;
  multi?: boolean;
  list?: boolean;
  required?: boolean;
  options?: CustomFieldOption[];
  optionsAllowUserAdd?: boolean;
  optionsColored?: boolean;
  /**
   * Valor de partida de um registro novo. Ver `FieldDefinition.defaultValue`. O tipo é escrito por
   * extenso (e não como `CustomFieldValue`) porque quem o declara importa deste arquivo — a seta
   * contrária fecharia o ciclo.
   */
  defaultValue?: string | string[] | number | boolean | null;
  /** Código gerado de um registro novo. Ver `FieldDefinition.autoValue`. */
  autoValue?: { pattern: string };
  rules?: FieldRules;
  logic?: FieldLogic;
  aggregation?: FieldAggregation;
  /** Ausente nos campos deste registro, onde é sempre `builtin` por definição. */
  origin?: FieldOrigin;
  ui?: FieldUiSpec;
}

export interface FkSpec {
  key: string;
  label: string;
  targetCollection: string;
  denormKey: string;
  multi?: boolean;
  denormalizedFields?: string[];
  required?: boolean;
  ui?: FieldUiSpec;
}

export interface EntityMetadata {
  /** Coleção de etiquetas da entidade, quando ela as tem. Ausente = tela sem etiquetas. */
  tagCollection?: string;
  key: EntityKey;
  collection: string;
  /**
   * Prefixo dos eventos de workflow. Nas entidades deste registro é o nome declarado no singular
   * (`person.saved`); numa entidade vinda de tela é o próprio nome da coleção (`medico.saved`).
   */
  eventPrefix?: string;
  labelSingular: string;
  labelPlural: string;
  displayNameFields: string[];
  referenceDenormFields: string[];
  fields: NativeFieldSpec[];
  fks: FkSpec[];
  /** A entidade pode receber uma `ScreenDefinition` — aparece no Form Design. */
  supportsCustomFields: boolean;
  referenceable: boolean;
}


export const ENTITY_REGISTRY: Record<EntityKey, EntityMetadata> = {
  members: {
    key: 'members',
    collection: 'members',
    labelSingular: 'Membro',
    labelPlural: 'Membros',
    displayNameFields: ['name', 'displayName', 'email'],
    referenceDenormFields: ['name', 'email'],
    fields: [
      { key: 'name', label: '@core.data/member.field.name', type: 'string' },
      { key: 'displayName', label: '@core.data/member.field.display-name', type: 'string' },
      { key: 'email', label: '@core.data/member.field.email', type: 'string' },
      { key: 'role', label: '@core.data/member.field.role', type: 'string' },
    ],
    fks: [],
    supportsCustomFields: false,
    referenceable: true,
  },
  /**
   * O ESCRITÓRIO. Está aqui — e não numa extensão, como Pessoa ou Processo — porque o tenant é a
   * entidade do próprio kernel: sem ele não há dado, não há regra e não há a quem instalar coisa
   * alguma. Declará-lo é o que permite ao escritório acrescentar campos ao próprio cadastro pelo
   * Form Design, como já faz com qualquer outra tela.
   *
   * O registro é UM só, e ele não vive numa subcoleção: é o documento `tenants/{tenantId}`. Por isso
   * a entidade não é `referenceable` (não há lista de onde escolher um) e a tela que a apresenta é a
   * aba "Dados do Escritório", que lê e grava esse documento — não uma listagem.
   */
  tenant: {
    key: 'tenant',
    collection: 'tenant',
    labelSingular: '@core.tenant/entity.singular',
    labelPlural: '@core.tenant/entity.plural',
    displayNameFields: ['name'],
    referenceDenormFields: ['name'],
    fields: [
      {
        key: 'name',
        label: '@core.tenant/office.name',
        type: 'string',
        required: true,
        ui: { order: 0, placeholder: '@core.tenant/office.name.placeholder' },
      },
      {
        key: 'email',
        label: '@core.tenant/office.email',
        type: 'string',
        ui: { order: 1, placeholder: '@core.tenant/office.email.placeholder' },
      },
      {
        key: 'phone',
        label: '@core.ui/field.phone',
        type: 'string',
        ui: { order: 2 },
      },
      {
        key: 'address',
        label: '@core.ui/field.address',
        type: 'string',
        ui: { order: 3, placeholder: '@core.tenant/office.address.placeholder' },
      },
    ],
    fks: [],
    supportsCustomFields: true,
    referenceable: false,
  },
};

export const ENTITY_REGISTRY_LIST: EntityMetadata[] = Object.values(ENTITY_REGISTRY);

export const getEntityByCollection = (collection: string): EntityMetadata | undefined =>
  ENTITY_REGISTRY_LIST.find((entity) => entity.collection === collection);

export const getEntityByEventPrefix = (prefix: string): EntityMetadata | undefined =>
  ENTITY_REGISTRY_LIST.find((entity) => entity.eventPrefix === prefix);

export const getEntityDisplayName = (
  entity: EntityMetadata,
  data: Record<string, unknown>,
): string | undefined => {
  for (const fieldKey of entity.displayNameFields) {
    const value = data[fieldKey];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
};
