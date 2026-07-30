// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/screenEntity.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/screenEntity.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import type { CustomFieldType, FieldDefinition } from '../entities/entitySchemas';
import type { EntityKey, EntityMetadata, NativeFieldSpec, NativeFieldType } from './entityRegistry';
import { BUILTIN_ENTITY_KEYS, ENTITY_REGISTRY, SCHEMA_VERSION } from './entityRegistry';
import { LOOKUP_REGISTRY_LIST } from './lookupRegistry';

/**
 * A tela como o schema a enxerga. O `id` é, por definição, o nome da COLEÇÃO no Firestore — para as
 * fixas ('persons') tanto quanto para as do Form Design ('medico') e as de extensão
 * ('vendas__produto').
 */
export interface SchemaScreen {
  id: string;
  titleSingular: string;
  titlePlural?: string;
  titleFieldKey: string;
  fields: FieldDefinition[];
  tagCollection?: string | null;
}

/** A lista de opções como o schema a enxerga. `collection` é o nome da coleção sob o tenant. */
export interface SchemaLookup {
  collection: string;
  label: string;
}

/** Uma coleção de etiquetas declarada pelo tenant. Mesma forma da lista, papel diferente. */
export type SchemaTagList = SchemaLookup;

export interface SchemaContext {
  registry: Record<EntityKey, EntityMetadata>;
  screens: ReadonlyMap<string, SchemaScreen>;
  /**
   * Toda lista de opções visível ao tenant: as declaradas em código (`LOOKUP_REGISTRY`) unidas às
   * declaradas no Firestore (`lookupDefinitions`). É um mapa só de propósito — a partir daqui nada
   * mais pergunta de onde a lista veio.
   */
  lookups: ReadonlyMap<string, SchemaLookup>;
  /**
   * As coleções de etiquetas — as do kernel (`caseTags`, declaradas no registro) unidas às do
   * tenant. Servem ao mesmo espaço de nomes das telas e das listas: as três viram coleção sob o
   * tenant e passam pelo MESMO `match` curinga das rules, então nenhuma pode reivindicar um nome
   * que outra já usa.
   */
  tagLists: ReadonlyMap<string, SchemaTagList>;
  version: number;
}

const BUILTIN_LOOKUPS: SchemaLookup[] = LOOKUP_REGISTRY_LIST.map((lookup) => ({
  collection: lookup.collection,
  label: `${lookup.screenLabel}: ${lookup.entityLabel}`,
}));

const BUILTIN_TAG_LISTS: SchemaTagList[] = Object.values(ENTITY_REGISTRY)
  .filter((entity) => !!entity.tagCollection)
  .map((entity) => ({
    collection: entity.tagCollection as string,
    label: `Etiquetas: ${entity.labelPlural}`,
  }));

export const createSchemaContext = (
  screens: Iterable<SchemaScreen> = [],
  tenantLookups: Iterable<SchemaLookup> = [],
  tenantTagLists: Iterable<SchemaTagList> = [],
): SchemaContext => ({
  registry: ENTITY_REGISTRY,
  screens: new Map([...screens].map((screen) => [screen.id, screen])),
  lookups: new Map(
    [...BUILTIN_LOOKUPS, ...tenantLookups].map((lookup) => [lookup.collection, lookup]),
  ),
  tagLists: new Map(
    [...BUILTIN_TAG_LISTS, ...tenantTagLists].map((tagList) => [tagList.collection, tagList]),
  ),
  version: SCHEMA_VERSION,
});

// ─── Conversão FieldDefinition (autoria) ⇄ NativeFieldSpec (canônico) ─────────

export const CUSTOM_FIELD_SCALAR_TYPES: Record<Exclude<CustomFieldType, 'reference'>, NativeFieldType> = {
  text: 'string',
  textarea: 'string',
  masked: 'string',
  markdown: 'string',
  select: 'string',
  number: 'number',
  currency: 'number',
  date: 'date',
  checkbox: 'boolean',
};

const undefinedIfNull = <T>(value: T | null | undefined): T | undefined =>
  value === null || value === undefined ? undefined : value;

const nativeTypeOf = (field: FieldDefinition): NativeFieldType => {
  if (field.type === 'reference') return field.multi ? 'stringArray' : 'string';
  if (field.multi && field.type === 'select') return 'stringArray';
  return CUSTOM_FIELD_SCALAR_TYPES[field.type] ?? 'string';
};

/** Traduz a forma de autoria para a forma canônica que toda a camada de schema consome. */
export const fieldDefinitionToNativeSpec = (field: FieldDefinition): NativeFieldSpec => {
  const spec: NativeFieldSpec = {
    key: field.key,
    label: field.label,
    type: nativeTypeOf(field),
    origin: field.origin,
    ui: {
      control: field.type,
      order: field.order,
      ...(undefinedIfNull(field.mask) ? { mask: field.mask as NonNullable<FieldDefinition['mask']> } : {}),
      ...(undefinedIfNull(field.section) ? { section: field.section as string } : {}),
      ...(undefinedIfNull(field.placeholder) ? { placeholder: field.placeholder as string } : {}),
      ...(field.showInList ? { list: { order: field.order } } : {}),
      // `hiddenInForm` vira `ui.form: false`, o mesmo sinal que o registro usa para os campos que
      // nunca vão ao formulário — um caminho só para as duas origens.
      ...(field.hiddenInForm ? { form: false } : {}),
    },
  };
  if (field.required) spec.required = true;
  if (field.multi) spec.multi = true;
  if (undefinedIfNull(field.refEntity)) spec.refEntity = field.refEntity as string;
  if (undefinedIfNull(field.lookupCollection)) spec.lookupCollection = field.lookupCollection as string;
  if (field.options) spec.options = field.options;
  if (field.optionsAllowUserAdd) spec.optionsAllowUserAdd = true;
  if (field.optionsColored) spec.optionsColored = true;
  if (undefinedIfNull(field.rules)) spec.rules = field.rules as NonNullable<FieldDefinition['rules']>;
  if (undefinedIfNull(field.logic)) spec.logic = field.logic as NonNullable<FieldDefinition['logic']>;
  if (undefinedIfNull(field.aggregation)) {
    spec.aggregation = field.aggregation as NonNullable<FieldDefinition['aggregation']>;
  }
  return spec;
};

const controlFor = (spec: NativeFieldSpec): CustomFieldType => {
  if (spec.ui?.control) return spec.ui.control;
  if (spec.refEntity) return 'reference';
  if (spec.lookupCollection) return 'select';
  switch (spec.type) {
    case 'date': return 'date';
    case 'number': return 'number';
    case 'boolean': return 'checkbox';
    case 'stringArray': return 'select';
    default: return 'text';
  }
};

/**
 * Traduz a forma canônica de volta para a de autoria. `key` vem de fora porque campos aninhados em
 * `objectFields` são endereçados por caminho pontilhado ('address.city').
 */
export const nativeSpecToFieldDefinition = (
  spec: NativeFieldSpec,
  key: string,
  order: number,
): FieldDefinition => ({
  key,
  label: spec.label,
  type: controlFor(spec),
  required: spec.required ?? false,
  order,
  origin: spec.origin ?? 'builtin',
  section: spec.ui?.section ?? null,
  placeholder: spec.ui?.placeholder ?? null,
  mask: spec.ui?.mask ?? null,
  lookupCollection: spec.lookupCollection ?? null,
  refEntity: spec.refEntity ?? null,
  multi: spec.multi ?? (spec.type === 'stringArray' ? true : undefined),
  optionsAllowUserAdd: spec.optionsAllowUserAdd,
  optionsColored: spec.optionsColored,
  options: spec.options,
  rules: spec.rules ?? null,
  logic: spec.logic ?? null,
  aggregation: spec.aggregation ?? null,
  showInList: spec.ui?.list !== undefined,
  hiddenInForm: spec.ui?.form === false,
});

// ─── Resolução de campos e entidades ──────────────────────────────────────────

/**
 * Insere `spec` na posição de `path`, substituindo o campo de mesma chave. Caminhos pontilhados
 * descem em `objectFields` — é assim que um ajuste do usuário sobre `address.city` sobrescreve o
 * campo aninhado declarado em código, sem achatar a estrutura do documento.
 */
const upsertFieldAtPath = (
  fields: NativeFieldSpec[],
  path: string[],
  spec: NativeFieldSpec,
): NativeFieldSpec[] => {
  const [head, ...rest] = path;

  if (rest.length === 0) {
    const index = fields.findIndex((field) => field.key === head);
    if (index === -1) return [...fields, { ...spec, key: head }];
    const next = [...fields];
    next[index] = { ...spec, key: head };
    return next;
  }

  const index = fields.findIndex((field) => field.key === head);
  const parent = index === -1 ? undefined : fields[index];
  if (!parent?.objectFields) return [...fields, { ...spec, key: path.join('.') }];

  const next = [...fields];
  next[index] = { ...parent, objectFields: upsertFieldAtPath(parent.objectFields, rest, spec) };
  return next;
};

/**
 * Lista canônica de campos de uma coleção: o que `entityRegistry.ts` declara, sobrescrito pelo que
 * a `ScreenDefinition` do tenant declara. Um campo `builtin` presente em `screen.fields` é uma
 * declaração COMPLETA, materializada pelo Form Design no primeiro ajuste — daí a substituição
 * inteira, e não a mesclagem propriedade a propriedade.
 */
export const resolveEntityFields = (ctx: SchemaContext, collection: string): NativeFieldSpec[] => {
  const entity = ctx.registry[collection];
  const screen = ctx.screens.get(collection);
  if (!screen) return entity?.fields ?? [];

  let fields: NativeFieldSpec[] = entity?.fields ?? [];
  for (const field of screen.fields) {
    fields = upsertFieldAtPath(fields, field.key.split('.'), fieldDefinitionToNativeSpec(field));
  }
  return fields;
};

const screenEntityMetadata = (screen: SchemaScreen, fields: NativeFieldSpec[]): EntityMetadata => ({
  key: screen.id,
  collection: screen.id,
  ...(screen.tagCollection ? { tagCollection: screen.tagCollection } : {}),
  eventPrefix: screen.id,
  labelSingular: screen.titleSingular,
  labelPlural: screen.titlePlural ?? screen.titleSingular,
  displayNameFields: [screen.titleFieldKey],
  referenceDenormFields: [screen.titleFieldKey],
  fields,
  fks: [],
  supportsCustomFields: true,
  referenceable: true,
});

/**
 * Resolve QUALQUER coleção para uma entidade: a declarada em `entityRegistry.ts` quando existe,
 * senão uma sintetizada a partir da tela do tenant. É o ponto único que faz uma tela do Form Design
 * ser indistinguível de uma fixa para o resto da plataforma.
 */
export const resolveEntity = (ctx: SchemaContext, collection: string): EntityMetadata | undefined => {
  const entity = ctx.registry[collection];
  const screen = ctx.screens.get(collection);
  if (!entity && !screen) return undefined;

  const fields = resolveEntityFields(ctx, collection);
  if (!entity) return screenEntityMetadata(screen as SchemaScreen, fields);
  if (!screen) return entity;

  return {
    ...entity,
    fields,
    labelSingular: screen.titleSingular,
    labelPlural: screen.titlePlural ?? entity.labelPlural,
    // A tela do tenant pode redirecionar as etiquetas da entidade fixa para outra coleção — é assim
    // que Processos e uma tela nova passam a compartilhar as mesmas etiquetas.
    ...(screen.tagCollection ? { tagCollection: screen.tagCollection } : {}),
  };
};

export const isEntityCollection = (ctx: SchemaContext, collection: string): boolean =>
  collection in ctx.registry || ctx.screens.has(collection);

/**
 * A lista de opções pelo caminho único: fixa do kernel ou declarada pelo tenant, dá no mesmo. Quem
 * precisa dessa resposta é a camada de schema (gravação e consulta por automação); o
 * `isLookupCollection` de `lookupRegistry.ts` continua existindo para os pontos sem `ctx`, como o
 * gatilho de eventos, que roda em toda escrita e não pode pagar uma leitura.
 */
export const isLookupTable = (ctx: SchemaContext, collection: string): boolean =>
  ctx.lookups.has(collection);

// ─── Nomes de coleção reservados ──────────────────────────────────────────────

/**
 * Coleções sob `tenants/{tenantId}` que uma tela do Form Design NÃO pode reivindicar como nome, por
 * já pertencerem ao sistema. Inclui as entidades fixas: elas têm regra NOMEADA no `firestore.rules`,
 * às vezes mais estrita que a genérica (Processos exige advogado ou admin para gravar), e o curinga
 * não pode alcançá-las sob pena de afrouxar o acesso.
 *
 * Espelhada por `isReservedCollection` no `firestore.rules` — as duas pontas são comparadas pelo
 * teste `screenEntity.test.ts`.
 */
export const RESERVED_COLLECTIONS: ReadonlySet<string> = new Set<string>([
  ...BUILTIN_ENTITY_KEYS,
  'aiConnections',
  'screenDefinitions',
  'workflow_definitions',
  'workflow_events',
  'workflow_executions',
  'scripts',
  'actions',
  'plugin_installations',
  'extensions',
  'installed_extensions',
  'personTags',
  'caseTags',
  'contractTags',
  'financialTags',
  'notes',
  'documents',
  'tags',
  'lookupDefinitions',
  'tagDefinitions',
  'secrets',
  ...LOOKUP_REGISTRY_LIST.map((lookup) => lookup.collection),
]);

/** Firestore aceita quase tudo como nome de coleção; aqui o conjunto é estreitado de propósito. */
const COLLECTION_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*$/;

const collectionNameIssue = (name: string, what: string): string | undefined => {
  const trimmed = name.trim();
  if (!trimmed) return `Informe a chave ${what}`;
  if (!COLLECTION_NAME_PATTERN.test(trimmed)) {
    return 'A chave deve começar por letra e conter apenas letras, números e "_"';
  }
  if (RESERVED_COLLECTIONS.has(trimmed)) return `"${trimmed}" é um nome reservado pelo sistema`;
  return undefined;
};

/** O nome já reivindicado por outra coleção do tenant, seja ela tela, lista ou etiquetas. */
const takenBy = (
  name: string,
  ctx: SchemaContext | undefined,
  ignore: 'screens' | 'lookups' | 'tagLists',
): string | undefined => {
  if (!ctx) return undefined;
  if (ignore !== 'screens' && ctx.screens.has(name)) return 'uma tela';
  if (ignore !== 'lookups' && ctx.lookups.has(name)) return 'uma lista de opções';
  if (ignore !== 'tagLists' && ctx.tagLists.has(name)) return 'um conjunto de etiquetas';
  return undefined;
};

export const screenIdIssue = (id: string, ctx?: SchemaContext): string | undefined => {
  const issue = collectionNameIssue(id, 'da tela');
  if (issue) return issue;
  const taken = takenBy(id.trim(), ctx, 'screens');
  return taken ? `"${id.trim()}" já é o nome de ${taken}` : undefined;
};

/**
 * Uma lista e uma tela disputam o MESMO espaço de nomes: as duas viram coleção sob o tenant, e as
 * duas passam pelo mesmo `match` curinga das rules. Por isso a validação é simétrica — nenhuma das
 * duas pode reivindicar um nome que a outra já usa.
 */
export const lookupIdIssue = (collection: string, ctx?: SchemaContext): string | undefined => {
  const issue = collectionNameIssue(collection, 'da lista');
  if (issue) return issue;
  const taken = takenBy(collection.trim(), ctx, 'lookups');
  return taken ? `"${collection.trim()}" já é o nome de ${taken}` : undefined;
};

export const tagListIdIssue = (collection: string, ctx?: SchemaContext): string | undefined => {
  const issue = collectionNameIssue(collection, 'das etiquetas');
  if (issue) return issue;
  const taken = takenBy(collection.trim(), ctx, 'tagLists');
  return taken ? `"${collection.trim()}" já é o nome de ${taken}` : undefined;
};

/** Nome sugerido para a lista de um campo: estável, legível e sem colidir com o camelCase do kernel. */
export const derivedLookupCollection = (screenId: string, fieldKey: string): string =>
  `${screenId}_${fieldKey.replace(/\./g, '_')}`;

/** Nome sugerido para as etiquetas de uma tela, na mesma convenção. */
export const derivedTagCollection = (screenId: string): string => `${screenId}_tags`;
