// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/eventCatalog.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

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
  label: string;
  fields: WorkflowEventFieldOption[];
  root: PathRoot;
}

const ID_FIELD: WorkflowEventFieldOption = { path: 'id', label: 'Id' };
const CHANGE_TYPE_FIELD: WorkflowEventFieldOption = { path: 'changeType', label: 'Tipo da mudança ("created" ou "updated")' };
const OLD_FIELD: WorkflowEventFieldOption = { path: 'old', label: 'Dados anteriores (objeto)' };

const ENTITY_EVENT_ORDER: EntityKey[] = [
  'contracts',
  'deadlines',
  'financials',
  'pushes',
];

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
    fields.push({ path: fk.key, label: `${fk.label} (Id)` });
    if (!fk.multi) {
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
): WorkflowEventCatalogEntry => ({
  name,
  label,
  fields: [ID_FIELD, ...(hasOld ? [CHANGE_TYPE_FIELD, OLD_FIELD] : []), ...fields],
  root: { ...rootBase, hasOld },
});

const entityEntry = (entity: EntityMetadata, action: 'saved' | 'deleted'): WorkflowEventCatalogEntry =>
  buildEntry(
    `${entity.eventPrefix}.${action}`,
    `Ao ${action === 'saved' ? 'salvar' : 'excluir'}: ${entity.labelSingular}`,
    action === 'saved',
    entityEventFields(entity),
    { kind: 'entity', entityKey: entity.key },
  );

const LOOKUP_EVENT_FIELDS: NativeFieldSpec[] = [
  { key: 'key', label: 'Chave', type: 'string' },
  { key: 'label', label: 'Rótulo', type: 'string' },
  { key: 'collection', label: 'Coleção', type: 'string' },
];

const lookupEntry = (action: 'saved' | 'deleted'): WorkflowEventCatalogEntry =>
  buildEntry(
    `lookup.${action}`,
    `Ao ${action === 'saved' ? 'salvar' : 'excluir'}: Item de Lista`,
    action === 'saved',
    flattenNativeFields(LOOKUP_EVENT_FIELDS),
    { kind: 'fields', fields: LOOKUP_EVENT_FIELDS },
  );

/**
 * A lista declarada pelo tenant emite pelo PRÓPRIO nome da coleção, como qualquer coleção que não é
 * reservada. Não carrega o campo `collection` do evento `lookup.*`: ali ele existe justamente porque
 * um evento só serve às 30 listas do kernel; aqui o nome do evento já diz qual lista é.
 */
const DECLARED_LOOKUP_FIELDS: NativeFieldSpec[] = [
  { key: 'key', label: 'Chave', type: 'string' },
  { key: 'label', label: 'Rótulo', type: 'string' },
  { key: 'color', label: 'Cor', type: 'string' },
];

const declaredLookupEntry = (
  collection: string,
  label: string,
  action: EntityEventAction,
): WorkflowEventCatalogEntry =>
  buildEntry(
    `${collection}.${action}`,
    `Ao ${action === 'saved' ? 'salvar' : 'excluir'}: ${label}`,
    action === 'saved',
    flattenNativeFields(DECLARED_LOOKUP_FIELDS),
    { kind: 'fields', fields: DECLARED_LOOKUP_FIELDS },
  );

const NOTE_FIELDS: NativeFieldSpec[] = [
  { key: 'parentId', label: 'Id da entidade pai', type: 'string' },
  { key: 'parentType', label: 'Tipo da entidade pai', type: 'string' },
  { key: 'content', label: 'Conteúdo', type: 'string' },
  { key: 'createdBy', label: 'Criado por', type: 'string' },
  { key: 'createdAt', label: 'Data de criação', type: 'date' },
];

const DOCUMENT_FIELDS: NativeFieldSpec[] = [
  { key: 'parentId', label: 'Id da entidade pai', type: 'string' },
  { key: 'parentType', label: 'Tipo da entidade pai', type: 'string' },
  { key: 'fileName', label: 'Nome do arquivo', type: 'string' },
  { key: 'fileSize', label: 'Tamanho do arquivo', type: 'number' },
  { key: 'uploadedBy', label: 'Enviado por', type: 'string' },
  { key: 'uploadedAt', label: 'Data de envio', type: 'date' },
];

const parentObjectField = (entity: EntityMetadata): NativeFieldSpec => ({
  key: 'parent',
  label: entity.labelSingular,
  type: 'object',
  objectFields: [
    { key: 'id', label: 'Id', type: 'string' },
    ...entity.referenceDenormFields.map(
      (fieldKey) =>
        entity.fields.find((field) => field.key === fieldKey) ?? { key: fieldKey, label: fieldKey, type: 'string' as const },
    ),
  ],
});

const NOTE_PARENTS: EntityKey[] = ['contracts', 'deadlines', 'financials'];
const DOCUMENT_PARENTS: EntityKey[] = ['contracts', 'financials'];

const nestedEntries = (
  parents: EntityKey[],
  suffix: 'note' | 'document',
  labelPrefix: string,
  baseFields: NativeFieldSpec[],
): WorkflowEventCatalogEntry[] =>
  parents.flatMap((parentKey) => {
    const parent = ENTITY_REGISTRY[parentKey];
    const fields: NativeFieldSpec[] = [...baseFields, parentObjectField(parent)];
    const root: PathRootBase = { kind: 'fields', fields };
    const label = `${labelPrefix} de ${parent.labelSingular}`;
    const prefix = `${parent.eventPrefix}_${suffix}`;
    return [
      buildEntry(`${prefix}.saved`, `Ao salvar: ${label}`, true, flattenNativeFields(fields), root),
      buildEntry(`${prefix}.deleted`, `Ao excluir: ${label}`, false, flattenNativeFields(fields), root),
    ];
  });

const orderedEntities = ENTITY_EVENT_ORDER.map((key) => ENTITY_REGISTRY[key]).filter((entity) => entity.eventPrefix);

const workflowCalledEntry: WorkflowEventCatalogEntry = {
  name: WORKFLOW_CALLED_EVENT,
  label: 'Chamado por outro workflow',
  fields: [],
  root: { kind: 'fields', fields: [], hasOld: false },
};

export const WORKFLOW_EVENT_CATALOG: WorkflowEventCatalogEntry[] = [
  ...orderedEntities.map((entity) => entityEntry(entity, 'saved')),
  lookupEntry('saved'),
  ...orderedEntities.map((entity) => entityEntry(entity, 'deleted')),
  lookupEntry('deleted'),
  ...nestedEntries(NOTE_PARENTS, 'note', 'Nota', NOTE_FIELDS),
  ...nestedEntries(DOCUMENT_PARENTS, 'document', 'Documento', DOCUMENT_FIELDS),
  workflowCalledEntry,
];

const WORKFLOW_PARAM_TYPE_MAP: Record<Exclude<WorkflowParameter['type'], 'EntityReference' | 'Object'>, NativeFieldType> = {
  String: 'string',
  Number: 'number',
  Date: 'date',
  Boolean: 'boolean',
  select: 'string',
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
      const options: WorkflowEventFieldOption[] = [{ path: parameter.key, label: `${parameter.label} (Id)` }];
      const target = ctx
        ? resolveEntity(ctx, parameter.entityType)
        : getEntityByCollection(parameter.entityType);
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

const ENTITY_EVENT_ACTIONS = ['saved', 'deleted'] as const;

export type EntityEventAction = (typeof ENTITY_EVENT_ACTIONS)[number];

/**
 * `person_note.saved` é o evento de um FILHO (nota, documento) da entidade fixa, não o de uma
 * coleção. A checagem é por composição — prefixo de entidade do registro + sufixo do filho — e não
 * por "tem underscore": chave com underscore é o normal de uma tela trazida por dependência
 * (`vendas__produto`), e barrá-la fazia o gatilho dela passar despercebido no empacotamento.
 */
const NESTED_EVENT_SUFFIXES = ['_note', '_document'] as const;

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
