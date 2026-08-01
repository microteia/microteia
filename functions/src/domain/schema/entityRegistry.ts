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
export type BuiltinEntityKey =
  | 'deadlines'
  | 'members'
  | 'pushes'
  | 'news';

export const BUILTIN_ENTITY_KEYS: readonly BuiltinEntityKey[] = [
  'deadlines', 'members', 'pushes', 'news',
] as const;

export type WorkflowEntityEventPrefix =
  | 'deadline'
  | 'push';

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


// `color` aceita token do tema (resolvido por resolveColor) — nunca hex literal.
const DEADLINE_PRIORITY_OPTIONS: CustomFieldOption[] = [
  { key: 'Baixa', label: 'Baixa', color: 'success' },
  { key: 'Média', label: 'Média', color: 'warning' },
  { key: 'Alta', label: 'Alta', color: 'secondary' },
  { key: 'Crítica', label: 'Crítica', color: 'danger' },
];

export const ENTITY_REGISTRY: Record<EntityKey, EntityMetadata> = {
  deadlines: {
    key: 'deadlines',
    collection: 'deadlines',
    eventPrefix: 'deadline',
    labelSingular: 'Prazo',
    labelPlural: 'Prazos',
    displayNameFields: ['description'],
    referenceDenormFields: ['type', 'dueDate', 'priority'],
    fields: [
      { key: 'type', label: 'Tipo', type: 'string', lookupCollection: 'deadlineTypes',
        required: true, optionsAllowUserAdd: true,
        ui: { control: 'select', section: 'Identificação', order: 0, placeholder: 'Selecione o tipo...' } },
      { key: 'priority', label: 'Prioridade', type: 'string', required: true,
        options: DEADLINE_PRIORITY_OPTIONS, optionsColored: true,
        ui: { control: 'select', section: 'Identificação', order: 1, placeholder: 'Selecione a prioridade...' } },
      { key: 'dueDate', label: 'Data de vencimento', type: 'date', required: true,
        ui: { section: 'Datas', order: 3, list: { icon: 'calendar', order: 1 } } },
      { key: 'completedAt', label: 'Data de conclusão', type: 'date',
        ui: { section: 'Datas', order: 4, list: { icon: 'calendarCheck', order: 2 } } },
      { key: 'description', label: 'Descrição', type: 'string',
        ui: { control: 'textarea', section: 'Responsável e Detalhes', order: 6, placeholder: 'Detalhes sobre o prazo, documentos necessários, etc.', list: { icon: 'fileText', order: 4 } } },
      { key: 'status', label: 'Status', type: 'string', ui: { form: false } },
      { key: 'notes', label: 'Observações', type: 'string', ui: { form: false } },
    ],
    fks: [
      {
        key: 'caseId',
        label: 'Processo',
        targetCollection: 'cases',
        denormKey: 'case',
        denormalizedFields: ['caseNumber', 'title', 'area'],
        required: true,
        ui: { section: 'Identificação', order: 2, placeholder: 'Selecione o processo...',
              list: { icon: 'folder', order: 0 } },
      },
      {
        key: 'responsibleLawyerId',
        label: 'Advogado responsável',
        targetCollection: 'persons',
        denormKey: 'responsibleLawyer',
        denormalizedFields: ['name', 'type', 'email'],
        ui: { section: 'Responsável e Detalhes', order: 5, placeholder: 'Selecione o responsável...',
              list: { icon: 'scales', order: 3 } },
      },
    ],
    supportsCustomFields: true,
    referenceable: true,
  },
  members: {
    key: 'members',
    collection: 'members',
    labelSingular: 'Membro',
    labelPlural: 'Membros',
    displayNameFields: ['name', 'displayName', 'email'],
    referenceDenormFields: ['name', 'email'],
    fields: [
      { key: 'name', label: 'Nome', type: 'string' },
      { key: 'displayName', label: 'Nome de exibição', type: 'string' },
      { key: 'email', label: 'E-mail', type: 'string' },
      { key: 'role', label: 'Papel', type: 'string' },
    ],
    fks: [],
    supportsCustomFields: false,
    referenceable: true,
  },
  pushes: {
    key: 'pushes',
    collection: 'pushes',
    eventPrefix: 'push',
    labelSingular: 'Push',
    labelPlural: 'Pushes',
    displayNameFields: ['subject', 'processNumber'],
    referenceDenormFields: ['subject', 'processNumber'],
    fields: [
      { key: 'subject', label: 'Assunto', type: 'string' },
      { key: 'from', label: 'Remetente', type: 'string' },
      { key: 'processNumber', label: 'Número do processo', type: 'string' },
      { key: 'court', label: 'Órgão', type: 'string' },
      { key: 'status', label: 'Status', type: 'string' },
      { key: 'receivedAt', label: 'Data de recebimento', type: 'date' },
    ],
    fks: [],
    supportsCustomFields: false,
    referenceable: false,
  },
  news: {
    key: 'news',
    collection: 'news',
    labelSingular: 'Comunicado',
    labelPlural: 'Comunicados',
    displayNameFields: ['title'],
    referenceDenormFields: ['title'],
    fields: [
      { key: 'title', label: 'Título', type: 'string' },
      { key: 'content', label: 'Conteúdo', type: 'string' },
      { key: 'priority', label: 'Prioridade', type: 'string' },
      { key: 'category', label: 'Categoria', type: 'string', lookupCollection: 'newsCategories' },
      { key: 'createdBy', label: 'Criado por', type: 'string' },
      { key: 'publishedAt', label: 'Data de publicação', type: 'date' },
    ],
    fks: [],
    supportsCustomFields: false,
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
