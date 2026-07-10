// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/eventCatalog.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

import type { EntityKey, EntityMetadata, NativeFieldSpec, NativeFieldType } from './entityRegistry';
import { ENTITY_REGISTRY, getEntityByCollection, getEntityByEventPrefix } from './entityRegistry';
import type { PathRoot } from './pathResolver';
import type { WorkflowParameter } from '../entities/Workflow';
import { resolveRefEntityCollection } from '../entities/entitySchemas';

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
const OLD_FIELD: WorkflowEventFieldOption = { path: 'old', label: 'Dados anteriores (objeto)' };
const CUSTOM_VALUES_FIELD: WorkflowEventFieldOption = { path: 'customValues', label: 'Campos customizados (objeto)' };
const VALUES_FIELD: WorkflowEventFieldOption = { path: 'values', label: 'Campos da tela (objeto)' };

const ENTITY_EVENT_ORDER: EntityKey[] = [
  'persons',
  'contracts',
  'cases',
  'deadlines',
  'financials',
  'pushes',
  'customRecords',
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
  | { kind: 'entity'; entityKey: EntityKey; screenKey?: string }
  | { kind: 'fields'; fields: NativeFieldSpec[] };

const buildEntry = (
  name: string,
  label: string,
  hasOld: boolean,
  fields: WorkflowEventFieldOption[],
  rootBase: PathRootBase,
  placeholder?: WorkflowEventFieldOption,
): WorkflowEventCatalogEntry => {
  const root: PathRoot = rootBase.kind === 'entity' ? { ...rootBase, hasOld } : { ...rootBase, hasOld };
  return {
    name,
    label,
    fields: [ID_FIELD, ...(hasOld ? [OLD_FIELD] : []), ...fields, ...(placeholder ? [placeholder] : [])],
    root,
  };
};

const entityEntry = (entity: EntityMetadata, action: 'saved' | 'deleted'): WorkflowEventCatalogEntry => {
  const placeholder = entity.supportsCustomFields
    ? CUSTOM_VALUES_FIELD
    : entity.key === 'customRecords'
      ? VALUES_FIELD
      : undefined;
  return buildEntry(
    `${entity.eventPrefix}.${action}`,
    `Ao ${action === 'saved' ? 'salvar' : 'excluir'}: ${entity.labelSingular}`,
    action === 'saved',
    entityEventFields(entity),
    { kind: 'entity', entityKey: entity.key },
    placeholder,
  );
};

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

const NOTE_PARENTS: EntityKey[] = ['cases', 'persons', 'contracts', 'deadlines', 'financials'];
const DOCUMENT_PARENTS: EntityKey[] = ['cases', 'persons', 'contracts', 'financials'];

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

const WORKFLOW_PARAM_TYPE_MAP: Record<Exclude<WorkflowParameter['type'], 'EntityReference'>, NativeFieldType> = {
  String: 'string',
  Number: 'number',
  Date: 'date',
  Boolean: 'boolean',
  select: 'string',
};

export const workflowParameterToNativeField = (parameter: WorkflowParameter): NativeFieldSpec => {
  if (parameter.type === 'EntityReference') {
    return parameter.entityType
      ? { key: parameter.key, label: parameter.label, type: 'string', refEntity: parameter.entityType, multi: parameter.multi }
      : { key: parameter.key, label: parameter.label, type: 'string' };
  }
  return { key: parameter.key, label: parameter.label, type: WORKFLOW_PARAM_TYPE_MAP[parameter.type] ?? 'string' };
};

export const workflowParametersToRoot = (parameters: WorkflowParameter[] = []): PathRoot => ({
  kind: 'fields',
  fields: parameters.map(workflowParameterToNativeField),
  hasOld: false,
});

export const workflowParametersToFieldOptions = (
  parameters: WorkflowParameter[] = [],
): WorkflowEventFieldOption[] =>
  parameters.flatMap((parameter) => {
    if (parameter.type === 'EntityReference' && parameter.entityType) {
      const options: WorkflowEventFieldOption[] = [{ path: parameter.key, label: `${parameter.label} (Id)` }];
      if (!parameter.multi) {
        const target = getEntityByCollection(resolveRefEntityCollection(parameter.entityType));
        options.push({ path: `${parameter.key}.id`, label: `${parameter.label}: Id` });
        for (const denormField of target?.referenceDenormFields ?? []) {
          options.push({
            path: `${parameter.key}.${denormField}`,
            label: `${parameter.label}: ${targetFieldLabel(target?.collection ?? '', denormField)}`,
          });
        }
      }
      return options;
    }
    return [{ path: parameter.key, label: parameter.label }];
  });

export const findEventCatalogEntry = (eventName: string): WorkflowEventCatalogEntry | undefined =>
  WORKFLOW_EVENT_CATALOG.find((entry) => entry.name === eventName);

export const eventNameToRoot = (eventName: string, screenKey?: string): PathRoot | null => {
  const entry = findEventCatalogEntry(eventName);
  if (!entry) return null;
  if (entry.root.kind === 'entity' && entry.root.entityKey === 'customRecords' && screenKey) {
    return { ...entry.root, screenKey };
  }
  return entry.root;
};

export const eventNameToEntityKey = (eventName: string): string | null => {
  const prefix = eventName.split('.')[0];
  if (!prefix) return null;
  if (prefix === 'lookup') return 'lookups';
  if (prefix === 'news') return 'news';
  if (prefix === 'custom_record') return null;
  return getEntityByEventPrefix(prefix)?.collection ?? null;
};

export const getWorkflowEventFields = (
  eventName: string,
  dynamicFields: WorkflowEventFieldOption[] = [],
): WorkflowEventFieldOption[] => {
  const entry = findEventCatalogEntry(eventName);
  if (!entry) return [];

  const isCustomRecord = eventName.startsWith('custom_record.');
  const placeholderPath = isCustomRecord ? 'values' : 'customValues';
  const baseFields = entry.fields.filter((field) => field.path !== placeholderPath);

  if (dynamicFields.length === 0) return baseFields;

  const prefix = isCustomRecord ? 'values.' : 'customValues.';
  const prefixedFields = dynamicFields.map((field) => ({ ...field, path: `${prefix}${field.path}` }));
  return [...baseFields, ...prefixedFields];
};
