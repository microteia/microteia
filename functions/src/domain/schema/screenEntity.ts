// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/screenEntity.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/screenEntity.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import type { CustomFieldType, FieldDefinition, FieldOrigin } from '../entities/entitySchemas';
import type { EntityKey, EntityMetadata, NativeFieldSpec, NativeFieldType } from './entityRegistry';
import { BUILTIN_ENTITY_KEYS, ENTITY_REGISTRY, SCHEMA_VERSION } from './entityRegistry';
import { LOOKUP_REGISTRY_LIST } from './lookupRegistry';
import type { FieldRulePreset, FieldRulePresetCatalog } from './fieldRulePresets';
import { buildFieldRulePresetCatalog } from './fieldRulePresets';
import type { RecordKeySpec } from './recordKeys';
import { RECORD_KEYS_COLLECTION } from './recordKeys';
import { AGENT_GRANTS_COLLECTION } from './agent/agentGrant';
import { AGGREGATE_BACKFILL_COLLECTION } from './aggregateBackfill';
import { RECORD_KEY_ADOPTION_COLLECTION } from './recordKeyAdoption';
import { WORKFLOW_CLOCK_COLLECTION, WORKFLOW_TRIGGER_MARKS_COLLECTION } from './workflowClock';

import type { AuditAction } from '../entities/AuditLog';
import type { LocalizedMessage } from './i18n/localizedMessage';
/**
 * A tela como o schema a enxerga. O `id` é, por definição, o nome da COLEÇÃO no Firestore — para as
 * fixas ('persons') tanto quanto para as do Form Design ('medico') e as de extensão
 * ('vendas__produto').
 *
 * `collection` é a exceção que confirma a regra: a coleção deixa de ser a IDENTIDADE da tela e passa
 * a ser uma propriedade dela, para que uma tela (tipicamente de extensão) possa declarar o esquema de
 * uma coleção que não leva o seu nome. Ausente = a coleção é o `id`, como sempre.
 */
export interface SchemaScreen {
  id: string;
  collection?: string;
  titleSingular: string;
  titlePlural?: string;
  titleFieldKey: string;
  fields: FieldDefinition[];
  tagCollection?: string | null;
  /** Prefixo declarado dos eventos da coleção. Ausente = o nome da coleção. */
  eventPrefix?: string | null;
  /**
   * Quais ações desta coleção geram registro de auditoria. Ausente = todas (`CREATE`, `UPDATE`,
   * `DELETE`), que é o padrão certo para o que uma pessoa cadastra.
   *
   * Existe porque há coleção cujo registro NASCE de máquina: uma ingestão que grava por conta própria
   * produziria um log por documento recebido, e afogaria a Auditoria justamente onde ela serve — o
   * gesto humano depois. Isso já esteve escrito no kernel, com o nome da coleção de uma extensão
   * dentro dele; agora é declaração de quem traz a coleção.
   */
  auditActions?: AuditAction[] | null;
  /** As chaves declaradas para a COLEÇÃO. Ver `ScreenDefinition.keys`. */
  keys?: RecordKeySpec[] | null;
  /**
   * O registro tem a aba Documentos. Está no schema, e não só na tela, porque o agente que anexa
   * um arquivo precisa da mesma resposta que a tela dá — sem ela, anexaria a um registro cuja aba
   * ninguém vê.
   */
  hasDocuments?: boolean;
}

/** A lista de opções como o schema a enxerga. `collection` é o nome da coleção sob o tenant. */
export interface SchemaLookup {
  collection: string;
  /** REFERÊNCIA de mensagem, ou o rótulo que o escritório digitou; `labelParams` interpola. */
  label: string;
  labelParams?: Record<string, string>;
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
  /**
   * As máscaras, formatações e validações prontas visíveis ao tenant: as do núcleo unidas às
   * declaradas por extensões instaladas. É o que faz `format.preset: 'cpf'` significar a mesma coisa
   * no formulário e na gravação por automação — sem que o kernel conheça a palavra "CPF".
   */
  fieldRulePresets: FieldRulePresetCatalog;
  version: number;
}

const BUILTIN_LOOKUPS: SchemaLookup[] = LOOKUP_REGISTRY_LIST.map((lookup) => ({
  collection: lookup.collection,
  label: '@core.data/lookup.qualified',
  labelParams: { screen: lookup.screenLabel, entity: lookup.entityLabel },
}));

const BUILTIN_TAG_LISTS: SchemaTagList[] = Object.values(ENTITY_REGISTRY)
  .filter((entity) => !!entity.tagCollection)
  .map((entity) => ({
    collection: entity.tagCollection as string,
    label: '@core.records/tag-list.of',
    labelParams: { name: entity.labelPlural },
  }));

const screenCollection = (screen: SchemaScreen): string => screen.collection ?? screen.id;

/**
 * Duas telas podem descrever a MESMA coleção: a que a possui pelo nome
 * (`screenDefinitions/cases`, onde vivem os ajustes do escritório) e uma tela de extensão que
 * declara o esquema dela. As duas declarações se somam por chave de campo, e a da tela DONA entra
 * por último — o ajuste do escritório prevalece sobre o que o pacote declara. Rótulos, campo-título
 * e etiquetas também vêm da dona quando ela existe; na falta dela, da declaração que sobrou. É o que
 * mantém a coleção descrita depois que a entidade sai do kernel.
 */
const mergeSchemaScreens = (base: SchemaScreen, next: SchemaScreen, collection: string): SchemaScreen => {
  // A tela DONA do nome dá rótulos e campo-título; a outra só acrescenta campos — assim uma
  // segunda tela sobre a mesma coleção não renomeia a entidade.
  const owner = next.id === collection ? next : base;
  const byKey = new Map(base.fields.map((field) => [field.key, field]));
  for (const field of next.fields) byKey.set(field.key, field);
  // As chaves se somam por NOME, pela mesma razão dos campos: enquanto a entidade do kernel e a
  // extensão que a descreve convivem, as duas declarações valem, e a dona do nome é quem desempata.
  const byKeyName = new Map((base.keys ?? []).map((key) => [key.name, key]));
  for (const key of next.keys ?? []) byKeyName.set(key.name, key);
  const keys = [...byKeyName.values()];
  return {
    ...owner,
    collection,
    fields: [...byKey.values()],
    ...(keys.length > 0 ? { keys } : {}),
    tagCollection: owner.tagCollection ?? base.tagCollection ?? next.tagCollection,
    // O prefixo dos eventos é da COLEÇÃO, não da tela que o declarou: quem declara é a extensão que
    // trouxe a entidade para fora do kernel, enquanto a dona do nome é um documento de baseline que
    // nada sabe de eventos. Deixar a dona prevalecer aqui renomearia os eventos do escritório.
    eventPrefix: owner.eventPrefix ?? base.eventPrefix ?? next.eventPrefix,
    // Pela MESMA razão do prefixo de evento: quem sabe que a coleção é escrita por máquina é a
    // extensão que a trouxe, não o documento de baseline que leva o nome dela.
    auditActions: owner.auditActions ?? base.auditActions ?? next.auditActions,
  };
};

const indexScreens = (screens: Iterable<SchemaScreen>): Map<string, SchemaScreen> => {
  const map = new Map<string, SchemaScreen>();
  for (const screen of screens) {
    const collection = screenCollection(screen);
    const existing = map.get(collection);
    map.set(
      collection,
      existing ? mergeSchemaScreens(existing, screen, collection) : { ...screen, collection },
    );
  }
  return map;
};

export const createSchemaContext = (
  screens: Iterable<SchemaScreen> = [],
  tenantLookups: Iterable<SchemaLookup> = [],
  tenantTagLists: Iterable<SchemaTagList> = [],
  tenantFieldRulePresets: Iterable<FieldRulePreset> = [],
): SchemaContext => ({
  registry: ENTITY_REGISTRY,
  screens: indexScreens(screens),
  lookups: new Map(
    [...BUILTIN_LOOKUPS, ...tenantLookups].map((lookup) => [lookup.collection, lookup]),
  ),
  tagLists: new Map(
    [...BUILTIN_TAG_LISTS, ...tenantTagLists].map((tagList) => [tagList.collection, tagList]),
  ),
  fieldRulePresets: buildFieldRulePresetCatalog(tenantFieldRulePresets),
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
  // Hora é STRING `HH:mm`, não instante: um horário sem dia não tem fuso, e gravá-lo como data
  // faria o mesmo "09:00" mudar de valor conforme quem lê. Ver "Um DIA vira instante ao MEIO-DIA".
  time: 'string',
  checkbox: 'boolean',
  // O que se grava de um arquivo é a URL de download — o campo é escalar como qualquer texto.
  file: 'string',
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
      // O ÍCONE basta para o campo virar linha do card: é o que a declaração de `listIcon` promete,
      // e exigir junto o "exibir na listagem" fazia a declaração da extensão virar um silêncio.
      ...(field.showInList || undefinedIfNull(field.listIcon)
        ? {
            list: {
              order: undefinedIfNull(field.listOrder) ?? field.order,
              ...(undefinedIfNull(field.listIcon) ? { icon: field.listIcon as string } : {}),
            },
          }
        : {}),
      ...(field.filterable ? { filter: true } : {}),
      // `hiddenInForm` vira `ui.form: false`, o mesmo sinal que o registro usa para os campos que
      // nunca vão ao formulário — um caminho só para as duas origens.
      ...(field.hiddenInForm ? { form: false } : {}),
    },
  };
  if (field.required) spec.required = true;
  if (field.multi) spec.multi = true;
  if (undefinedIfNull(field.refEntity)) spec.refEntity = field.refEntity as string;
  if (undefinedIfNull(field.refDenormKey)) spec.refDenormKey = field.refDenormKey as string;
  if (undefinedIfNull(field.lookupCollection)) spec.lookupCollection = field.lookupCollection as string;
  if (field.options) spec.options = field.options;
  if (field.optionsAllowUserAdd) spec.optionsAllowUserAdd = true;
  if (field.optionsColored) spec.optionsColored = true;
  if (field.defaultValue !== undefined) spec.defaultValue = field.defaultValue;
  if (undefinedIfNull(field.autoValue)) spec.autoValue = field.autoValue as { pattern: string };
  if (undefinedIfNull(field.rules)) spec.rules = field.rules as NonNullable<FieldDefinition['rules']>;
  if (undefinedIfNull(field.logic)) spec.logic = field.logic as NonNullable<FieldDefinition['logic']>;
  if (undefinedIfNull(field.aggregation)) {
    spec.aggregation = field.aggregation as NonNullable<FieldDefinition['aggregation']>;
  }
  if (undefinedIfNull(field.file)) spec.file = field.file as NonNullable<FieldDefinition['file']>;
  if (field.unique === true) spec.unique = true;
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
  refDenormKey: spec.refDenormKey ?? null,
  multi: spec.multi ?? (spec.type === 'stringArray' ? true : undefined),
  optionsAllowUserAdd: spec.optionsAllowUserAdd,
  optionsColored: spec.optionsColored,
  options: spec.options,
  defaultValue: spec.defaultValue,
  autoValue: spec.autoValue ?? null,
  rules: spec.rules ?? null,
  logic: spec.logic ?? null,
  aggregation: spec.aggregation ?? null,
  file: spec.file ?? null,
  showInList: spec.ui?.list !== undefined,
  listIcon: spec.ui?.list?.icon ?? null,
  listOrder: spec.ui?.list?.order ?? null,
  filterable: spec.ui?.filter === true,
  unique: spec.unique === true,
  hiddenInForm: spec.ui?.form === false,
});

// ─── Resolução de campos e entidades ──────────────────────────────────────────

/**
 * Insere `spec` na posição de `path`, substituindo o campo de mesma chave. Caminhos pontilhados
 * descem em `objectFields` — é assim que um ajuste do usuário sobre `address.city` sobrescreve o
 * campo aninhado declarado em código, sem achatar a estrutura do documento.
 *
 * O ramo intermediário é CRIADO quando não existe. Antes, descer só funcionava sobre um objeto que
 * o `entityRegistry` já declarasse: uma tela que declarasse `address.zipCode` do zero gravava um
 * campo de chave literal "address.zipCode" na raiz do documento, e o caminho não resolvia. Com a
 * entidade fora do kernel, ninguém mais declara o ramo — quem declara a folha declara o caminho.
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
  // O rótulo do ramo criado é a própria chave: o formulário agrupa pelo `section` de cada folha, e
  // nenhuma tela exibe o objeto em si.
  const branch: NativeFieldSpec = parent?.objectFields
    ? parent
    : { key: head, label: head, type: 'object', objectFields: [] };

  const next = index === -1 ? [...fields, branch] : [...fields];
  const at = index === -1 ? next.length - 1 : index;
  next[at] = { ...branch, objectFields: upsertFieldAtPath(branch.objectFields ?? [], rest, spec) };
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

/**
 * O açúcar `field.unique` desaçucarado: uma chave `unique` de um campo só, no escopo do escritório.
 *
 * O NOME é derivado da chave do campo, e é o que torna o açúcar reversível — desligar o `unique` e
 * religá-lo volta à mesma chave, com a mesma reserva, em vez de criar uma segunda. Uma chave
 * declarada explicitamente com este nome PREVALECE: quem escreveu a lista sabe mais do que o atalho.
 */
export const fieldUniqueKeyName = (fieldKey: string): string => `field:${fieldKey}`;

const desugarFieldKeys = (fields: readonly NativeFieldSpec[], prefix = ''): RecordKeySpec[] =>
  fields.flatMap((spec) => {
    const key = `${prefix}${spec.key}`;
    if (spec.type === 'object' && spec.objectFields) return desugarFieldKeys(spec.objectFields, `${key}.`);
    if (spec.unique !== true) return [];
    return [{ name: fieldUniqueKeyName(key), kind: 'unique' as const, fields: [key] }];
  });

/**
 * Lista canônica de chaves de uma coleção — a contrapartida de `resolveEntityFields`, e pela mesma
 * razão: o registro declara, a tela do tenant soma, e o resto da plataforma lê de um lugar só.
 *
 * A ordem de precedência é a do próprio problema: o açúcar é o mais fraco (é um atalho), a
 * declaração explícita da tela vence, e a do registro é a base. Duas chaves com o mesmo nome são a
 * mesma chave — é o nome que endereça a reserva já gravada.
 */
export const resolveEntityKeys = (
  ctx: SchemaContext,
  collection: string,
  resolvedFields?: readonly NativeFieldSpec[],
): RecordKeySpec[] => {
  const byName = new Map<string, RecordKeySpec>();
  for (const key of ctx.registry[collection]?.keys ?? []) byName.set(key.name, key);
  // O açúcar sai dos campos RESOLVIDOS — registro e tela já fundidos —, e não da declaração da tela:
  // um campo do registro marcado como único vale igual, e um campo aninhado é endereçado pelo
  // caminho pontilhado, que é como todo o resto da plataforma o endereça.
  const fields = resolvedFields ?? resolveEntityFields(ctx, collection);
  for (const key of desugarFieldKeys(fields)) byName.set(key.name, key);
  const owner = ctx.screens.get(collection);
  if (owner) {
    for (const key of owner.keys ?? []) byName.set(key.name, key);
  }
  return [...byName.values()];
};

const screenEntityMetadata = (
  screen: SchemaScreen,
  fields: NativeFieldSpec[],
  keys: RecordKeySpec[],
): EntityMetadata => ({
  key: screenCollection(screen),
  collection: screenCollection(screen),
  ...(screen.tagCollection ? { tagCollection: screen.tagCollection } : {}),
  ...(screen.auditActions ? { auditActions: screen.auditActions } : {}),
  eventPrefix: screen.eventPrefix ?? screenCollection(screen),
  labelSingular: screen.titleSingular,
  labelPlural: screen.titlePlural ?? screen.titleSingular,
  displayNameFields: [screen.titleFieldKey],
  referenceDenormFields: [screen.titleFieldKey],
  fields,
  fks: [],
  supportsCustomFields: true,
  referenceable: true,
  ...(keys.length > 0 ? { keys } : {}),
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
  const keys = resolveEntityKeys(ctx, collection, fields);
  if (!entity) return screenEntityMetadata(screen as SchemaScreen, fields, keys);
  if (!screen) return entity;

  // Só a tela que leva o nome da coleção renomeia a entidade fixa (ver `mergeSchemaScreens`).
  const ownsName = screen.id === collection;

  return {
    ...entity,
    fields,
    labelSingular: ownsName ? screen.titleSingular : entity.labelSingular,
    labelPlural: ownsName ? (screen.titlePlural ?? entity.labelPlural) : entity.labelPlural,
    // A tela do tenant pode redirecionar as etiquetas da entidade fixa para outra coleção — é assim
    // que duas telas passam a compartilhar as mesmas etiquetas.
    ...(screen.tagCollection ? { tagCollection: screen.tagCollection } : {}),
    ...(screen.auditActions ? { auditActions: screen.auditActions } : {}),
    ...(keys.length > 0 ? { keys } : {}),
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
  WORKFLOW_CLOCK_COLLECTION,
  WORKFLOW_TRIGGER_MARKS_COLLECTION,
  'scripts',
  'actions',
  // Sem código que a leia desde 18/09/2026 — foi a instalação de antes de `installed_extensions`.
  // Continua reservada porque os documentos de então continuam nos escritórios, e liberar o nome
  // deixaria uma tela nova nascer por cima deles.
  'plugin_installations',
  'roles',
  'extensions',
  'installed_extensions',
  'extension_migrations',
  'extension_history',
  AGGREGATE_BACKFILL_COLLECTION,
  RECORD_KEY_ADOPTION_COLLECTION,
  'notes',
  'documents',
  'tags',
  'lookupDefinitions',
  'reports',
  'tagDefinitions',
  'secrets',
  'settings',
  AGENT_GRANTS_COLLECTION,
  RECORD_KEYS_COLLECTION,
  ...LOOKUP_REGISTRY_LIST.map((lookup) => lookup.collection),
]);

/** Firestore aceita quase tudo como nome de coleção; aqui o conjunto é estreitado de propósito. */
const COLLECTION_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*$/;

const collectionNameIssue = (name: string, whatKey: string): LocalizedMessage | undefined => {
  const trimmed = name.trim();
  if (!trimmed) {
    return {
      message: '@core.records/collection.key.required',
      messageParams: { what: whatKey },
    };
  }
  if (!COLLECTION_NAME_PATTERN.test(trimmed)) {
    return { message: '@core.records/collection.key.pattern' };
  }
  if (RESERVED_COLLECTIONS.has(trimmed)) {
    return {
      message: '@core.records/collection.key.reserved',
      messageParams: { name: trimmed },
    };
  }
  return undefined;
};

/** O nome já reivindicado por outra coleção do tenant, seja ela tela, lista ou etiquetas. */
const takenBy = (
  name: string,
  ctx: SchemaContext | undefined,
  ignore: 'screens' | 'lookups' | 'tagLists',
): string | undefined => {
  if (!ctx) return undefined;
  if (ignore !== 'screens' && ctx.screens.has(name)) return '@core.records/collection.taken-by.screens';
  if (ignore !== 'lookups' && ctx.lookups.has(name)) return '@core.records/collection.taken-by.lookups';
  if (ignore !== 'tagLists' && ctx.tagLists.has(name)) return '@core.records/collection.taken-by.tag-lists';
  return undefined;
};

export const screenIdIssue = (id: string, ctx?: SchemaContext): LocalizedMessage | undefined => {
  const issue = collectionNameIssue(id, '@core.records/collection.what.screen');
  if (issue) return issue;
  const taken = takenBy(id.trim(), ctx, 'screens');
  return taken
    ? {
        message: '@core.records/collection.name-taken',
        messageParams: { name: id.trim(), taken },
      }
    : undefined;
};

/**
 * Uma lista e uma tela disputam o MESMO espaço de nomes: as duas viram coleção sob o tenant, e as
 * duas passam pelo mesmo `match` curinga das rules. Por isso a validação é simétrica — nenhuma das
 * duas pode reivindicar um nome que a outra já usa.
 */
export const lookupIdIssue = (collection: string, ctx?: SchemaContext): LocalizedMessage | undefined => {
  const issue = collectionNameIssue(collection, '@core.records/collection.what.lookup');
  if (issue) return issue;
  const taken = takenBy(collection.trim(), ctx, 'lookups');
  return taken
    ? {
        message: '@core.records/collection.name-taken',
        messageParams: { name: collection.trim(), taken },
      }
    : undefined;
};

export const tagListIdIssue = (collection: string, ctx?: SchemaContext): LocalizedMessage | undefined => {
  const issue = collectionNameIssue(collection, '@core.records/collection.what.tags');
  if (issue) return issue;
  const taken = takenBy(collection.trim(), ctx, 'tagLists');
  return taken
    ? {
        message: '@core.records/collection.name-taken',
        messageParams: { name: collection.trim(), taken },
      }
    : undefined;
};

/** Nome sugerido para a lista de um campo: estável, legível e sem colidir com o camelCase do kernel. */
export const derivedLookupCollection = (screenId: string, fieldKey: string): string =>
  `${screenId}_${fieldKey.replace(/\./g, '_')}`;

/** Nome sugerido para as etiquetas de uma tela, na mesma convenção. */
export const derivedTagCollection = (screenId: string): string => `${screenId}_tags`;

/**
 * O documento MÍNIMO de uma tela fixa, para quando alguém precisa gravar algo nela e ela ainda não
 * existe em `screenDefinitions` — uma tela do kernel só ganha documento no primeiro ajuste (ver
 * `FieldDefinition.origin`). Traz os rótulos do registro e `sidebarOrder`, sem o qual o documento
 * ficaria de fora do `getAll` (que ordena por esse campo). Os campos nativos continuam vindo do
 * registro via `resolveScreenFields`; `fields` aqui é só o que o tenant acrescentou.
 */
export const builtinScreenBaseline = (collection: string): {
  origin: FieldOrigin;
  titleSingular: string;
  titlePlural: string;
  icon: string;
  fields: FieldDefinition[];
  titleFieldKey: string;
  hasNotes: boolean;
  hasDocuments: boolean;
  hasTags: boolean;
  listActions: never[];
  viewActionIds: string[];
  cardActionIds: string[];
  parentEntity: null;
  parentFieldKey: null;
  sidebarOrder: number;
  enabled: boolean;
} => {
  const entity = ENTITY_REGISTRY[collection as EntityKey] as EntityMetadata | undefined;
  return {
    origin: 'builtin',
    titleSingular: entity?.labelSingular ?? collection,
    titlePlural: entity?.labelPlural ?? collection,
    icon: 'apps',
    fields: [],
    titleFieldKey: '',
    hasNotes: false,
    hasDocuments: false,
    hasTags: false,
    listActions: [],
    viewActionIds: [],
    cardActionIds: [],
    parentEntity: null,
    parentFieldKey: null,
    sidebarOrder: 0,
    enabled: true,
  };
};
