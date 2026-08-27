import type { EntityKey, EntityMetadata, NativeFieldSpec, NativeFieldType } from './entityRegistry';
import { ENTITY_REGISTRY, getEntityByCollection, getEntityByEventPrefix } from './entityRegistry';
import type { PathRoot, SchemaContext } from './pathResolver';
import type { WorkflowParameter } from '../entities/Workflow';
import { isEntityCollection, resolveEntity } from './screenEntity';
import { isLookupCollection as isBuiltinLookupCollection } from './lookupRegistry';

export const WORKFLOW_CALLED_EVENT = 'workflow.called';

export interface WorkflowEventFieldOption {
  path: string;
  label: string;
}

export interface WorkflowEventCatalogEntry {
  name: string;
  /**
   * Referência de mensagem (`@ns/chave`) ou o texto que o escritório digitou. O rótulo de evento é
   * COMPOSTO — "Ao salvar: Processo" —, e a parte variável vem em `labelParams`, porque este módulo
   * é compartilhado com o backend e não pode conhecer catálogo de idioma.
   */
  label: string;
  labelParams?: Record<string, string>;
  fields: WorkflowEventFieldOption[];
  root: PathRoot;
}

/**
 * O rótulo de um evento, resolvido. Vive aqui — e não em cada tela que mostra um gatilho — porque a
 * composição tem mais de uma volta: a referência traz "Ao salvar: {name}", e `name` é por sua vez ou
 * outra referência (entidade nativa), ou o nome que o escritório digitou no Form Design, ou ainda uma
 * terceira referência que se compõe com os parâmetros IRMÃOS ("{item} de {parent}").
 *
 * Quem desce essas voltas é o próprio motor de mensagens — `resolveParam` resolve referência em
 * parâmetro e leva os irmãos para a mensagem aninhada. Resolver `name` à mão aqui, como se fazia,
 * bastava para uma volta e quebrava na segunda: o `{item}` de dentro voltava cru na tela, porque a
 * chamada de fora tinha jogado os irmãos fora.
 */
export const resolveEventCatalogLabel = (
  label: (value: string, params?: Record<string, unknown>) => string,
  entry: Pick<WorkflowEventCatalogEntry, 'label' | 'labelParams'>,
): string => label(entry.label, entry.labelParams);

const ID_FIELD: WorkflowEventFieldOption = { path: 'id', label: '@core.automation/event-field.id' };
const CHANGE_TYPE_FIELD: WorkflowEventFieldOption = { path: 'changeType', label: '@core.automation/event-field.change-type' };
const OLD_FIELD: WorkflowEventFieldOption = { path: 'old', label: '@core.automation/event-field.old' };

const ENTITY_EVENT_ORDER: EntityKey[] = [];

const flattenNativeFields = (
  fields: NativeFieldSpec[],
  pathPrefix = '',
  labelPrefix = '',
): WorkflowEventFieldOption[] =>
  fields.flatMap((field) => {
    const path = `${pathPrefix}${field.key}`;
    const label = `${labelPrefix}${field.label}`;
    if (field.type === 'object' && field.objectFields) {
      return flattenNativeFields(field.objectFields, `${path}.`, `${label}: `);
    }
    return [{ path, label }];
  });

const targetFieldLabel = (collection: string, fieldKey: string): string => {
  if (fieldKey === 'id') return 'Id';
  const target = getEntityByCollection(collection);
  return target?.fields.find((field) => field.key === fieldKey)?.label ?? fieldKey;
};

const entityEventFields = (entity: EntityMetadata): WorkflowEventFieldOption[] => {
  const fields = flattenNativeFields(entity.fields);
  for (const fk of entity.fks) {
    // "(Id)" e "X: Id" são MARCADOR, não prosa: desambiguam qual das duas entradas da mesma
    // referência é o identificador, e se escrevem igual em qualquer idioma. O que traduz é o
    // `fk.label`, que já é referência ou rótulo do escritório.
    // eslint-disable-next-line no-restricted-syntax -- ver acima
    fields.push({ path: fk.key, label: `${fk.label} (Id)` });
    if (!fk.multi) {
      // eslint-disable-next-line no-restricted-syntax -- marcador, ver acima
      fields.push({ path: `${fk.denormKey}.id`, label: `${fk.label}: Id` });
      for (const denormField of fk.denormalizedFields ?? []) {
        fields.push({
          path: `${fk.denormKey}.${denormField}`,
          label: `${fk.label}: ${targetFieldLabel(fk.targetCollection, denormField)}`,
        });
      }
    }
  }
  return fields;
};

type PathRootBase =
  | { kind: 'entity'; entityKey: EntityKey }
  | { kind: 'fields'; fields: NativeFieldSpec[] };

const buildEntry = (
  name: string,
  label: string,
  hasOld: boolean,
  fields: WorkflowEventFieldOption[],
  rootBase: PathRootBase,
  labelParams?: Record<string, string>,
): WorkflowEventCatalogEntry => ({
  name,
  label,
  labelParams,
  fields: [ID_FIELD, ...(hasOld ? [CHANGE_TYPE_FIELD, OLD_FIELD] : []), ...fields],
  root: { ...rootBase, hasOld },
});

const entityEntry = (entity: EntityMetadata, action: 'saved' | 'deleted'): WorkflowEventCatalogEntry =>
  buildEntry(
    `${entity.eventPrefix}.${action}`,
    action === 'saved' ? '@core.automation/event.on-save' : '@core.automation/event.on-delete',
    action === 'saved',
    entityEventFields(entity),
    { kind: 'entity', entityKey: entity.key },
    { name: entity.labelSingular },
  );

const LOOKUP_EVENT_FIELDS: NativeFieldSpec[] = [
  { key: 'key', label: '@core.automation/event-field.key', type: 'string' },
  { key: 'label', label: '@core.automation/event-field.label', type: 'string' },
  { key: 'collection', label: '@core.automation/event-field.collection', type: 'string' },
];

const lookupEntry = (action: 'saved' | 'deleted'): WorkflowEventCatalogEntry =>
  buildEntry(
    `lookup.${action}`,
    action === 'saved' ? '@core.automation/event.on-save' : '@core.automation/event.on-delete',
    action === 'saved',
    flattenNativeFields(LOOKUP_EVENT_FIELDS),
    { kind: 'fields', fields: LOOKUP_EVENT_FIELDS },
    { name: '@core.automation/event.lookup-item' },
  );

/**
 * A lista declarada pelo tenant emite pelo PRÓPRIO nome da coleção, como qualquer coleção que não é
 * reservada. Não carrega o campo `collection` do evento `lookup.*`: ali ele existe justamente porque
 * um evento só serve às 30 listas do kernel; aqui o nome do evento já diz qual lista é.
 */
const DECLARED_LOOKUP_FIELDS: NativeFieldSpec[] = [
  { key: 'key', label: '@core.automation/event-field.key', type: 'string' },
  { key: 'label', label: '@core.automation/event-field.label', type: 'string' },
  { key: 'color', label: '@core.automation/event-field.color', type: 'string' },
];

const declaredLookupEntry = (
  collection: string,
  label: string,
  action: EntityEventAction,
): WorkflowEventCatalogEntry =>
  buildEntry(
    `${collection}.${action}`,
    action === 'saved' ? '@core.automation/event.on-save' : '@core.automation/event.on-delete',
    action === 'saved',
    flattenNativeFields(DECLARED_LOOKUP_FIELDS),
    { kind: 'fields', fields: DECLARED_LOOKUP_FIELDS },
    { name: label },
  );

const NOTE_FIELDS: NativeFieldSpec[] = [
  { key: 'parentId', label: '@core.automation/event-field.parent-id', type: 'string' },
  { key: 'parentType', label: '@core.automation/event-field.parent-type', type: 'string' },
  { key: 'content', label: '@core.automation/event-field.content', type: 'string' },
  { key: 'createdBy', label: '@core.automation/event-field.created-by', type: 'string' },
  { key: 'createdAt', label: '@core.automation/event-field.created-at', type: 'date' },
];

const DOCUMENT_FIELDS: NativeFieldSpec[] = [
  { key: 'parentId', label: '@core.automation/event-field.parent-id', type: 'string' },
  { key: 'parentType', label: '@core.automation/event-field.parent-type', type: 'string' },
  { key: 'fileName', label: '@core.automation/event-field.file-name', type: 'string' },
  { key: 'fileSize', label: '@core.automation/event-field.file-size', type: 'number' },
  { key: 'uploadedBy', label: '@core.automation/event-field.uploaded-by', type: 'string' },
  { key: 'uploadedAt', label: '@core.automation/event-field.uploaded-at', type: 'date' },
];

const parentObjectField = (entity: EntityMetadata): NativeFieldSpec => ({
  key: 'parent',
  label: entity.labelSingular,
  type: 'object',
  objectFields: [
    { key: 'id', label: '@core.automation/event-field.id', type: 'string' },
    ...entity.referenceDenormFields.map(
      (fieldKey) =>
        entity.fields.find((field) => field.key === fieldKey) ?? { key: fieldKey, label: fieldKey, type: 'string' as const },
    ),
  ],
});

const NOTE_PARENTS: EntityKey[] = [];
const DOCUMENT_PARENTS: EntityKey[] = [];

/**
 * O evento de uma nota ou de um documento — "Ao salvar: Nota de Membro". O nome é composto em DOIS
 * níveis, e é o motor de mensagens que os compõe: `name` é ele mesmo uma referência, e os parâmetros
 * IRMÃOS (`item`, `parent`) descem para ela. Este módulo é compartilhado com o backend e não pode
 * conhecer catálogo de idioma, então aqui só se declara a forma.
 *
 * A montagem por concatenação — `${prefix} de ${parent.labelSingular}` — é o que não pode voltar: ela
 * prendia dois textos de interface no código, e a preposição do meio prendia o idioma junto.
 */
const nestedEntries = (
  parents: EntityKey[],
  suffix: 'note' | 'document',
  itemLabel: string,
  baseFields: NativeFieldSpec[],
): WorkflowEventCatalogEntry[] =>
  parents.flatMap((parentKey) => {
    const parent = ENTITY_REGISTRY[parentKey];
    const fields: NativeFieldSpec[] = [...baseFields, parentObjectField(parent)];
    const root: PathRootBase = { kind: 'fields', fields };
    const prefix = `${parent.eventPrefix}_${suffix}`;
    const labelParams = {
      name: '@core.automation/event.nested-item',
      item: itemLabel,
      parent: parent.labelSingular,
    };
    return [
      buildEntry(`${prefix}.saved`, '@core.automation/event.on-save', true, flattenNativeFields(fields), root, labelParams),
      buildEntry(`${prefix}.deleted`, '@core.automation/event.on-delete', false, flattenNativeFields(fields), root, labelParams),
    ];
  });

const orderedEntities = ENTITY_EVENT_ORDER.map((key) => ENTITY_REGISTRY[key]).filter((entity) => entity.eventPrefix);

const workflowCalledEntry: WorkflowEventCatalogEntry = {
  name: WORKFLOW_CALLED_EVENT,
  label: '@core.automation/event.called',
  fields: [],
  root: { kind: 'fields', fields: [], hasOld: false },
};

export const WORKFLOW_EVENT_CATALOG: WorkflowEventCatalogEntry[] = [
  ...orderedEntities.map((entity) => entityEntry(entity, 'saved')),
  lookupEntry('saved'),
  ...orderedEntities.map((entity) => entityEntry(entity, 'deleted')),
  lookupEntry('deleted'),
  ...nestedEntries(NOTE_PARENTS, 'note', '@core.automation/event.note', NOTE_FIELDS),
  ...nestedEntries(DOCUMENT_PARENTS, 'document', '@core.automation/event.document', DOCUMENT_FIELDS),
  workflowCalledEntry,
];

const WORKFLOW_PARAM_TYPE_MAP: Record<Exclude<WorkflowParameter['type'], 'EntityReference' | 'Object'>, NativeFieldType> = {
  String: 'string',
  Number: 'number',
  Date: 'date',
  Boolean: 'boolean',
  select: 'string',
  lookup: 'string',
};

export const isScalarParameterType = (type: WorkflowParameter['type']): boolean =>
  type !== 'EntityReference' && type !== 'Object';

export const workflowParameterToNativeField = (parameter: WorkflowParameter): NativeFieldSpec => {
  if (parameter.type === 'EntityReference') {
    return parameter.entityType
      ? { key: parameter.key, label: parameter.label, type: 'string', refEntity: parameter.entityType, multi: parameter.list }
      : { key: parameter.key, label: parameter.label, type: 'string' };
  }
  if (parameter.type === 'Object') {
    const spec: NativeFieldSpec = {
      key: parameter.key,
      label: parameter.label,
      type: 'object',
      objectFields: (parameter.fields ?? []).map(workflowParameterToNativeField),
    };
    return parameter.list ? { ...spec, list: true } : spec;
  }
  const spec: NativeFieldSpec = { key: parameter.key, label: parameter.label, type: WORKFLOW_PARAM_TYPE_MAP[parameter.type] ?? 'string' };
  if (parameter.type === 'lookup' && parameter.lookupCollection) spec.lookupCollection = parameter.lookupCollection;
  return parameter.list ? { ...spec, list: true } : spec;
};

export const workflowParametersToRoot = (parameters: WorkflowParameter[] = []): PathRoot => ({
  kind: 'fields',
  fields: parameters.map(workflowParameterToNativeField),
  hasOld: false,
});

export const workflowParametersToFieldOptions = (
  parameters: WorkflowParameter[] = [],
  ctx?: SchemaContext,
): WorkflowEventFieldOption[] =>
  parameters.flatMap((parameter) => {
    if (parameter.list) {
      return [{ path: parameter.key, label: parameter.label }];
    }
    if (parameter.type === 'EntityReference' && parameter.entityType) {
      // eslint-disable-next-line no-restricted-syntax -- marcador, ver o comentário em fkFieldOptions
      const options: WorkflowEventFieldOption[] = [{ path: parameter.key, label: `${parameter.label} (Id)` }];
      const target = ctx
        ? resolveEntity(ctx, parameter.entityType)
        : getEntityByCollection(parameter.entityType);
      // eslint-disable-next-line no-restricted-syntax -- marcador, ver o comentário em fkFieldOptions
      options.push({ path: `${parameter.key}.id`, label: `${parameter.label}: Id` });
      for (const denormField of target?.referenceDenormFields ?? []) {
        options.push({
          path: `${parameter.key}.${denormField}`,
          label: `${parameter.label}: ${targetFieldLabel(target?.collection ?? '', denormField)}`,
        });
      }
      return options;
    }
    if (parameter.type === 'Object') {
      return workflowParametersToFieldOptions(parameter.fields ?? [], ctx).map((option) => ({
        path: `${parameter.key}.${option.path}`,
        label: `${parameter.label}: ${option.label}`,
      }));
    }
    return [{ path: parameter.key, label: parameter.label }];
  });

const isEmptyValue = (value: unknown): boolean => value === undefined || value === null || value === '';

export const applyParameterDefaults = (
  parameters: WorkflowParameter[] = [],
  values: Record<string, unknown> = {},
): Record<string, unknown> => {
  const result: Record<string, unknown> = { ...values };
  for (const parameter of parameters) {
    if (parameter.list) continue;
    if (parameter.type === 'Object') {
      const current = result[parameter.key];
      const wasPresent = current && typeof current === 'object' && !Array.isArray(current);
      const nested = wasPresent ? (current as Record<string, unknown>) : {};
      const filled = applyParameterDefaults(parameter.fields ?? [], nested);
      if (wasPresent || Object.keys(filled).length > 0) result[parameter.key] = filled;
      continue;
    }
    if (isScalarParameterType(parameter.type) && isEmptyValue(result[parameter.key]) && parameter.defaultValue !== undefined) {
      result[parameter.key] = parameter.defaultValue;
    }
  }
  return result;
};

export const ENTITY_EVENT_ACTIONS = ['saved', 'deleted'] as const;

export type EntityEventAction = (typeof ENTITY_EVENT_ACTIONS)[number];

/**
 * `person_note.saved` é o evento de um FILHO (nota, documento) da entidade fixa, não o de uma
 * coleção. A checagem é por composição — prefixo de entidade do registro + sufixo do filho — e não
 * por "tem underscore": chave com underscore é o normal de uma tela trazida por dependência
 * (`vendas__produto`), e barrá-la fazia o gatilho dela passar despercebido no empacotamento.
 */
export const NESTED_EVENT_SUFFIXES = ['_note', '_document'] as const;

const isNestedEntityEvent = (prefix: string): boolean =>
  NESTED_EVENT_SUFFIXES.some(
    (suffix) => prefix.endsWith(suffix) && !!getEntityByEventPrefix(prefix.slice(0, -suffix.length)),
  );

/**
 * Separa `<coleção>.saved` / `<coleção>.deleted`. Devolve `null` para os eventos que não são de
 * entidade (`lookup.*`, `case_note.*`, `workflow.called`) — o empacotamento usa isto para saber
 * qual tela um gatilho referencia.
 *
 * O que sai é o PREFIXO, não a coleção: ele coincide com o nome da coleção na maioria das telas, mas
 * uma que declara `eventPrefix` emite por um nome próprio. Quem precisa da tela resolve o prefixo
 * contra as telas que conhece (`screenEventPrefix`), em vez de tratá-lo como chave.
 */
export const splitEntityEventName = (
  eventName: string,
): { prefix: string; action: EntityEventAction } | null => {
  const separator = eventName.lastIndexOf('.');
  if (separator <= 0) return null;
  const action = eventName.slice(separator + 1) as EntityEventAction;
  if (!ENTITY_EVENT_ACTIONS.includes(action)) return null;
  const prefix = eventName.slice(0, separator);
  if (isNestedEntityEvent(prefix) || prefix === 'lookup' || prefix === 'workflow') return null;
  return { prefix, action };
};

/**
 * Toda entidade emite `<coleção>.saved`/`.deleted` — as fixas com o prefixo declarado
 * (`person.saved`), as demais com o próprio nome da coleção (`medico.saved`). Um evento de tela não
 * está no catálogo estático: é sintetizado a partir da entidade resolvida no contexto do tenant.
 */
const screenEventEntry = (
  eventName: string,
  ctx: SchemaContext | undefined,
): WorkflowEventCatalogEntry | undefined => {
  if (!ctx) return undefined;
  const separator = eventName.lastIndexOf('.');
  if (separator <= 0) return undefined;

  const collection = eventName.slice(0, separator);
  const action = eventName.slice(separator + 1) as EntityEventAction;
  if (!ENTITY_EVENT_ACTIONS.includes(action)) return undefined;

  const lookup = ctx.lookups.get(collection);
  if (lookup && !isBuiltinLookupCollection(collection)) {
    return declaredLookupEntry(lookup.collection, lookup.label, action);
  }
  if (isEntityCollection(ctx, collection)) {
    const entity = resolveEntity(ctx, collection);
    return entity ? entityEntry(entity, action) : undefined;
  }

  // O prefixo pode não ser o nome da coleção: uma tela declara `eventPrefix` para preservar os
  // eventos que as automações já escutam quando a entidade muda de dono (`cases` → `case.saved`).
  const declared = [...ctx.screens.values()].find((screen) => screen.eventPrefix === collection);
  if (!declared) return undefined;
  const entity = resolveEntity(ctx, declared.collection ?? declared.id);
  return entity ? entityEntry(entity, action) : undefined;
};

export const findEventCatalogEntry = (
  eventName: string,
  ctx?: SchemaContext,
): WorkflowEventCatalogEntry | undefined =>
  WORKFLOW_EVENT_CATALOG.find((entry) => entry.name === eventName) ?? screenEventEntry(eventName, ctx);

/**
 * Catálogo completo para o tenant: os eventos fixos mais um par `.saved`/`.deleted` por tela do
 * Form Design ou de extensão.
 */
export const buildWorkflowEventCatalog = (ctx: SchemaContext): WorkflowEventCatalogEntry[] => {
  const screenEntries: WorkflowEventCatalogEntry[] = [];
  for (const collection of ctx.screens.keys()) {
    if (collection in ctx.registry) continue;
    const entity = resolveEntity(ctx, collection);
    if (!entity) continue;
    screenEntries.push(entityEntry(entity, 'saved'), entityEntry(entity, 'deleted'));
  }
  // As 30 listas do kernel já estão no catálogo estático sob `lookup.*`; só as declaradas pelo
  // tenant precisam de par próprio, porque emitem pelo nome da coleção.
  for (const lookup of ctx.lookups.values()) {
    if (isBuiltinLookupCollection(lookup.collection)) continue;
    screenEntries.push(
      declaredLookupEntry(lookup.collection, lookup.label, 'saved'),
      declaredLookupEntry(lookup.collection, lookup.label, 'deleted'),
    );
  }
  return [...WORKFLOW_EVENT_CATALOG, ...screenEntries];
};

export const eventNameToRoot = (eventName: string, ctx?: SchemaContext): PathRoot | null =>
  findEventCatalogEntry(eventName, ctx)?.root ?? null;

export const eventNameToEntityKey = (eventName: string, ctx?: SchemaContext): string | null => {
  const prefix = eventName.split('.')[0];
  if (!prefix) return null;
  if (prefix === 'lookup') return 'lookups';
  const root = findEventCatalogEntry(eventName, ctx)?.root;
  return root?.kind === 'entity' ? root.entityKey : null;
};

/**
 * Campos disponíveis no payload do evento. Os campos declarados pelo tenant já vêm na entidade
 * resolvida — não há mais lista dinâmica separada nem prefixo `values.`/`customValues.`.
 */
export const getWorkflowEventFields = (
  eventName: string,
  ctx?: SchemaContext,
): WorkflowEventFieldOption[] => {
  const entry = findEventCatalogEntry(eventName, ctx);
  if (!entry) return [];
  if (entry.root.kind !== 'entity' || !ctx) return entry.fields;

  const entity = resolveEntity(ctx, entry.root.entityKey);
  if (!entity) return entry.fields;

  return [
    ID_FIELD,
    ...(entry.root.hasOld ? [CHANGE_TYPE_FIELD, OLD_FIELD] : []),
    ...entityEventFields(entity),
  ];
};
