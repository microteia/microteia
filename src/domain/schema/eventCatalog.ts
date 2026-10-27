import type { EntityKey, EntityMetadata, NativeFieldSpec, NativeFieldType } from './entityRegistry';
import { ENTITY_REGISTRY, getEntityByCollection } from './entityRegistry';
import type { PathRoot, SchemaContext } from './pathResolver';
import type { WorkflowParameter } from '../entities/Workflow';
import { isEntityCollection, resolveEntity } from './screenEntity';
import { isLookupCollection as isBuiltinLookupCollection } from './lookupRegistry';
import { DATE_REACHED_ACTION, WORKFLOW_SCHEDULE_EVENT } from './workflowClock';
import { AUDIT_EVENT_FIELDS, WORKFLOW_AUDIT_EVENT } from './workflowAuditTrigger';

export const WORKFLOW_CALLED_EVENT = 'workflow.called';

/**
 * O convidado do portal abriu o registro, ou obteve o link de um documento dele — publicado pelo
 * servidor só para a tela que declara `portal.trackViews`. O payload é o registro, como no `saved`, mais
 * `portalView`; o convidado é o `actor`.
 */
export const PORTAL_VIEWED_ACTION = 'portalViewed';

export const portalViewedEventName = (prefix: string): string => `${prefix}.${PORTAL_VIEWED_ACTION}`;

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

const ENTITY_ENTRY_LABELS: Record<EntityTriggerAction, string> = {
  saved: '@core.automation/event.on-save',
  deleted: '@core.automation/event.on-delete',
  dateReached: '@core.automation/event.on-date-reached',
  portalViewed: '@core.automation/event.on-portal-viewed',
};

/**
 * A abertura pelo portal, ao lado do registro aberto: quando (o relógio do SERVIDOR), por quem — o
 * e-mail do convite; o resto da identidade está em `actor` — e, quando foi um documento, qual.
 * `document` é `null` na abertura do registro.
 */
const PORTAL_VIEW_FIELDS: NativeFieldSpec[] = [{
  key: 'portalView',
  label: '@core.automation/event-field.portal-view',
  type: 'object',
  objectFields: [
    { key: 'at', label: '@core.automation/event-field.portal-view.at', type: 'date' },
    { key: 'email', label: '@core.automation/event-field.portal-view.email', type: 'string' },
    { key: 'documentId', label: '@core.automation/event-field.portal-view.document-id', type: 'string' },
    { key: 'documentName', label: '@core.automation/event-field.portal-view.document-name', type: 'string' },
    { key: 'documentType', label: '@core.automation/event-field.portal-view.document-type', type: 'string' },
  ],
}];

const entityEntry = (entity: EntityMetadata, action: EntityTriggerAction): WorkflowEventCatalogEntry => {
  const viewed = action === PORTAL_VIEWED_ACTION;
  const entry = buildEntry(
    `${entity.eventPrefix}.${action}`,
    ENTITY_ENTRY_LABELS[action],
    action === 'saved',
    [...entityEventFields(entity), ...(viewed ? flattenNativeFields(PORTAL_VIEW_FIELDS) : [])],
    { kind: 'entity', entityKey: entity.key },
    { name: entity.labelSingular },
  );
  return viewed && entry.root.kind === 'entity' ? { ...entry, root: { ...entry.root, extras: PORTAL_VIEW_FIELDS } } : entry;
};

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
  { key: 'title', label: '@core.automation/event-field.title', type: 'string' },
  { key: 'text', label: '@core.automation/event-field.text', type: 'string' },
  { key: 'createdBy', label: '@core.automation/event-field.created-by', type: 'string' },
  { key: 'createdByName', label: '@core.automation/event-field.created-by-name', type: 'string' },
  { key: 'createdAt', label: '@core.automation/event-field.created-at', type: 'date' },
];

const DOCUMENT_FIELDS: NativeFieldSpec[] = [
  { key: 'parentId', label: '@core.automation/event-field.parent-id', type: 'string' },
  { key: 'parentType', label: '@core.automation/event-field.parent-type', type: 'string' },
  { key: 'name', label: '@core.automation/event-field.file-name', type: 'string' },
  { key: 'type', label: '@core.automation/event-field.document-type', type: 'string' },
  { key: 'description', label: '@core.automation/event-field.description', type: 'string' },
  { key: 'contentType', label: '@core.automation/event-field.content-type', type: 'string' },
  { key: 'size', label: '@core.automation/event-field.file-size', type: 'number' },
  { key: 'sha256', label: '@core.automation/event-field.sha256', type: 'string' },
  { key: 'createdBy', label: '@core.automation/event-field.created-by', type: 'string' },
  { key: 'createdByName', label: '@core.automation/event-field.created-by-name', type: 'string' },
  { key: 'createdAt', label: '@core.automation/event-field.created-at', type: 'date' },
  { key: 'portalShared', label: '@core.automation/event-field.portal-shared', type: 'boolean' },
];

/**
 * Os filhos de um registro que publicam evento próprio — a nota e o documento da aba do registro. O
 * nome do evento é `<prefixo do pai>_<filho>.<ação>`: o prefixo é o da TELA (`eventPrefix`, ou a
 * coleção), e é por ele, e não por nome escrito aqui, que o evento existe para qualquer tela.
 */
export const CHILD_RECORD_KINDS = ['note', 'document'] as const;

/** O kernel a partir do qual nota e documento de QUALQUER tela publicam evento. */
export const CHILD_RECORD_EVENTS_SINCE_KERNEL = '2.69.0';

export type ChildRecordKind = (typeof CHILD_RECORD_KINDS)[number];

/** A subcoleção do registro de onde vem cada filho. */
export const CHILD_RECORD_SUBCOLLECTIONS: Record<ChildRecordKind, string> = {
  note: 'notes',
  document: 'documents',
};

export const childRecordEventName = (
  parentPrefix: string,
  kind: ChildRecordKind,
  action: EntityEventAction,
): string => `${parentPrefix}_${kind}.${action}`;

const CHILD_RECORD_FIELDS: Record<ChildRecordKind, NativeFieldSpec[]> = {
  note: NOTE_FIELDS,
  document: DOCUMENT_FIELDS,
};

const CHILD_RECORD_LABELS: Record<ChildRecordKind, string> = {
  note: '@core.automation/event.note',
  document: '@core.automation/event.document',
};

/** O registro de que o filho pende, como o evento o leva: o id e os campos que dão nome a ele. */
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

/**
 * O evento de uma nota ou de um documento — "Ao salvar: Nota de Contrato". O nome é composto em DOIS
 * níveis, e é o motor de mensagens que os compõe: `name` é ele mesmo uma referência, e os parâmetros
 * IRMÃOS (`item`, `parent`) descem para ela. Este módulo é compartilhado com o backend e não pode
 * conhecer catálogo de idioma, então aqui só se declara a forma.
 */
const childRecordEntry = (
  parent: EntityMetadata,
  kind: ChildRecordKind,
  action: EntityEventAction,
): WorkflowEventCatalogEntry => {
  const fields: NativeFieldSpec[] = [...CHILD_RECORD_FIELDS[kind], parentObjectField(parent)];
  return buildEntry(
    childRecordEventName(parent.eventPrefix ?? parent.collection, kind, action),
    action === 'saved' ? '@core.automation/event.on-save' : '@core.automation/event.on-delete',
    action === 'saved',
    flattenNativeFields(fields),
    { kind: 'fields', fields },
    { name: '@core.automation/event.nested-item', item: CHILD_RECORD_LABELS[kind], parent: parent.labelSingular },
  );
};

/** Os filhos que a tela da coleção mostra — e só esses têm evento no catálogo. */
const childKindsOf = (ctx: SchemaContext, collection: string): ChildRecordKind[] => {
  const screen = ctx.screens.get(collection);
  return CHILD_RECORD_KINDS.filter((kind) => (kind === 'note' ? screen?.hasNotes : screen?.hasDocuments) === true);
};

const orderedEntities = ENTITY_EVENT_ORDER.map((key) => ENTITY_REGISTRY[key]).filter((entity) => entity.eventPrefix);

const SCHEDULE_FIELDS: NativeFieldSpec[] = [
  { key: 'scheduledFor', label: '@core.automation/event-field.scheduled-for', type: 'date' },
  { key: 'firedAt', label: '@core.automation/event-field.fired-at', type: 'date' },
];

/**
 * O gatilho por horário: não há registro por trás dele, e por isso o payload é só o momento — o
 * previsto pela expressão e o real. Os dois diferem quando o relógio ficou parado e recuperou o atraso.
 */
const scheduleEntry: WorkflowEventCatalogEntry = {
  name: WORKFLOW_SCHEDULE_EVENT,
  label: '@core.automation/event.schedule',
  fields: flattenNativeFields(SCHEDULE_FIELDS),
  root: { kind: 'fields', fields: SCHEDULE_FIELDS, hasOld: false },
};

const workflowCalledEntry: WorkflowEventCatalogEntry = {
  name: WORKFLOW_CALLED_EVENT,
  label: '@core.automation/event.called',
  fields: [],
  root: { kind: 'fields', fields: [], hasOld: false },
};

/**
 * O gatilho por log de Auditoria: o payload é o próprio log. Não há `old` — log não se altera.
 */
const auditEntry: WorkflowEventCatalogEntry = {
  name: WORKFLOW_AUDIT_EVENT,
  label: '@core.automation/event.audit-recorded',
  fields: [ID_FIELD, ...flattenNativeFields(AUDIT_EVENT_FIELDS)],
  root: { kind: 'fields', fields: AUDIT_EVENT_FIELDS, hasOld: false },
};

export const WORKFLOW_EVENT_CATALOG: WorkflowEventCatalogEntry[] = [
  ...orderedEntities.map((entity) => entityEntry(entity, 'saved')),
  lookupEntry('saved'),
  ...orderedEntities.map((entity) => entityEntry(entity, 'deleted')),
  lookupEntry('deleted'),
  workflowCalledEntry,
  scheduleEntry,
  auditEntry,
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
 * Os gatilhos que nascem de um registro de uma coleção: os dois que o PUBLICADOR emite a cada gravação
 * (`saved`/`deleted`), o que o relógio do kernel emite quando uma data do registro chega e o que o
 * portal emite quando um convidado o abre.
 */
export const ENTITY_TRIGGER_ACTIONS = [...ENTITY_EVENT_ACTIONS, DATE_REACHED_ACTION, PORTAL_VIEWED_ACTION] as const;

export type EntityTriggerAction = (typeof ENTITY_TRIGGER_ACTIONS)[number];

const isEntityTriggerAction = (value: string): value is EntityTriggerAction =>
  (ENTITY_TRIGGER_ACTIONS as readonly string[]).includes(value);

/** Os campos de DATA de uma entidade, no primeiro nível — os que um `dateReached` pode vigiar. */
export const entityDateFieldKeys = (entity: EntityMetadata): string[] =>
  entity.fields.filter((field) => field.type === 'date' && !field.list).map((field) => field.key);

/**
 * `<prefixo>_note.saved` é o evento de um FILHO (nota, documento) de um registro, não o de uma
 * coleção. A checagem é pelo sufixo do filho, e não por "tem underscore": chave com underscore é o
 * normal de uma tela trazida por dependência (`vendas__produto`), e barrá-la fazia o gatilho dela
 * passar despercebido no empacotamento. Uma tela cujo prefixo TERMINA num desses sufixos emitiria o
 * mesmo nome que o filho de outra — e por isso o empacotamento o recusa como prefixo reservado.
 */
export const NESTED_EVENT_SUFFIXES = CHILD_RECORD_KINDS.map((kind) => `_${kind}` as const);

const isNestedEntityEvent = (prefix: string): boolean =>
  NESTED_EVENT_SUFFIXES.some((suffix) => prefix.length > suffix.length && prefix.endsWith(suffix));

/** Separa `<prefixo>_<filho>.<ação>`; `null` quando o evento não é de um filho de registro. */
export const splitChildRecordEventName = (
  eventName: string,
): { parentPrefix: string; kind: ChildRecordKind; action: EntityEventAction } | null => {
  const separator = eventName.lastIndexOf('.');
  if (separator <= 0) return null;
  const action = eventName.slice(separator + 1);
  if (!(ENTITY_EVENT_ACTIONS as readonly string[]).includes(action)) return null;
  const prefix = eventName.slice(0, separator);
  const kind = CHILD_RECORD_KINDS.find((candidate) => prefix.length > candidate.length + 1 && prefix.endsWith(`_${candidate}`));
  if (!kind) return null;
  return { parentPrefix: prefix.slice(0, -(kind.length + 1)), kind, action: action as EntityEventAction };
};

/**
 * Separa `<coleção>.saved` / `<coleção>.deleted`. Devolve `null` para os eventos que não são de
 * entidade (`lookup.*`, `<prefixo>_note.*`, `workflow.called`) — o empacotamento usa isto para saber
 * qual tela um gatilho referencia.
 *
 * O que sai é o PREFIXO, não a coleção: ele coincide com o nome da coleção na maioria das telas, mas
 * uma que declara `eventPrefix` emite por um nome próprio. Quem precisa da tela resolve o prefixo
 * contra as telas que conhece (`screenEventPrefix`), em vez de tratá-lo como chave.
 */
export const splitEntityEventName = (
  eventName: string,
): { prefix: string; action: EntityTriggerAction } | null => {
  const separator = eventName.lastIndexOf('.');
  if (separator <= 0) return null;
  const action = eventName.slice(separator + 1);
  if (!isEntityTriggerAction(action)) return null;
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
  const action = eventName.slice(separator + 1);
  if (!isEntityTriggerAction(action)) return undefined;

  const lookup = ctx.lookups.get(collection);
  if (lookup && !isBuiltinLookupCollection(collection)) {
    return action === DATE_REACHED_ACTION || action === PORTAL_VIEWED_ACTION
      ? undefined
      : declaredLookupEntry(lookup.collection, lookup.label, action);
  }
  if (isEntityCollection(ctx, collection)) {
    const entity = resolveEntity(ctx, collection);
    return entity ? entityEntry(entity, action) : undefined;
  }

  // O prefixo pode não ser o nome da coleção: uma tela declara `eventPrefix` para preservar os
  // eventos que as automações já escutam quando a entidade muda de dono (`orders` → `order.saved`).
  const declared = [...ctx.screens.values()].find((screen) => screen.eventPrefix === collection);
  if (!declared) return undefined;
  const entity = resolveEntity(ctx, declared.collection ?? declared.id);
  return entity ? entityEntry(entity, action) : undefined;
};

/** A coleção cuja tela EMITE o prefixo — o declarado em `eventPrefix`, ou o próprio nome dela. */
const collectionEmitting = (ctx: SchemaContext, prefix: string): string | undefined => {
  for (const [collection, screen] of ctx.screens) {
    if ((screen.eventPrefix?.trim() || collection) === prefix) return collection;
  }
  return undefined;
};

const childRecordEventEntry = (
  eventName: string,
  ctx: SchemaContext | undefined,
): WorkflowEventCatalogEntry | undefined => {
  if (!ctx) return undefined;
  const child = splitChildRecordEventName(eventName);
  if (!child) return undefined;
  const collection = collectionEmitting(ctx, child.parentPrefix);
  const parent = collection ? resolveEntity(ctx, collection) : undefined;
  return parent ? childRecordEntry(parent, child.kind, child.action) : undefined;
};

export const findEventCatalogEntry = (
  eventName: string,
  ctx?: SchemaContext,
): WorkflowEventCatalogEntry | undefined =>
  WORKFLOW_EVENT_CATALOG.find((entry) => entry.name === eventName)
  ?? screenEventEntry(eventName, ctx)
  ?? childRecordEventEntry(eventName, ctx);

/**
 * Catálogo completo para o tenant: os eventos fixos mais um par `.saved`/`.deleted` por tela do
 * Form Design ou de extensão — e o par de cada filho (nota, documento) que a tela mostra.
 */
export const buildWorkflowEventCatalog = (ctx: SchemaContext): WorkflowEventCatalogEntry[] => {
  const screenEntries: WorkflowEventCatalogEntry[] = [];
  for (const collection of ctx.screens.keys()) {
    if (collection in ctx.registry) continue;
    const entity = resolveEntity(ctx, collection);
    if (!entity) continue;
    screenEntries.push(entityEntry(entity, 'saved'), entityEntry(entity, 'deleted'));
    if (entityDateFieldKeys(entity).length > 0) screenEntries.push(entityEntry(entity, DATE_REACHED_ACTION));
    if (ctx.screens.get(collection)?.tracksPortalViews === true) screenEntries.push(entityEntry(entity, PORTAL_VIEWED_ACTION));
    for (const kind of childKindsOf(ctx, collection)) {
      screenEntries.push(childRecordEntry(entity, kind, 'saved'), childRecordEntry(entity, kind, 'deleted'));
    }
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

/**
 * A entidade que um gatilho de registro alcança — a tela que EMITE o prefixo, mesmo quando ele não é o
 * nome da coleção (`eventPrefix`). É por ela que o gatilho de data sabe que coleção consultar e quais
 * campos de data existem.
 */
export const eventEntity = (eventName: string, ctx: SchemaContext): EntityMetadata | undefined => {
  const root = eventNameToRoot(eventName, ctx);
  return root?.kind === 'entity' ? resolveEntity(ctx, root.entityKey) : undefined;
};

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
    ...flattenNativeFields(entry.root.extras ?? []),
  ];
};
