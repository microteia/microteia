// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/pathResolver.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

import type { EntityKey, EntityMetadata, NativeFieldSpec, NativeFieldType } from './entityRegistry';
import { LOOKUP_REGISTRY, getLookupLabel } from './lookupRegistry';
import type { SchemaContext } from './screenEntity';
import { resolveEntity } from './screenEntity';

export type { SchemaContext, SchemaScreen } from './screenEntity';
export { createSchemaContext } from './screenEntity';

export const DEFAULT_MAX_FK_DEPTH = 3;

export type PathRoot =
  | { kind: 'entity'; entityKey: EntityKey; hasOld: boolean }
  | { kind: 'fields'; fields: NativeFieldSpec[]; hasOld: boolean };

export type PathSegment = { kind: 'key'; name: string } | { kind: 'index'; index: number };

export type MaterializationMode = 'denormKey' | 'replaceValue';

export interface FkHop {
  atPath: string;
  targetCollection: string;
  materializeAt: string;
  mode: MaterializationMode;
  multi: boolean;
  fields: string[] | 'all';
  requiredFields?: string[];
}

export type PathNode =
  | { kind: 'scalar'; type: NativeFieldType; lookupCollection?: string }
  | { kind: 'entity'; collection: string }
  | { kind: 'entityList'; collection: string }
  | { kind: 'object' }
  | { kind: 'unknown' };

export interface PathResolution {
  valid: boolean;
  /** REFERÊNCIA de mensagem: o resolvedor roda no backend também, onde não há idioma. */
  error?: string;
  errorParams?: Record<string, string>;
  node: PathNode;
  hops: FkHop[];
  depth: number;
}

export interface ResolveOptions {
  maxFkDepth?: number;
}

export type PathSuggestionKind =
  | 'field'
  | 'fk'
  | 'fkList'
  | 'customField'
  | 'reference'
  | 'referenceList'
  | 'index'
  | 'special';

export interface PathSuggestion {
  insertText: string;
  label: string;
  kind: PathSuggestionKind;
  detail?: string;
  isLeaf: boolean;
}

export const parsePath = (raw: string): PathSegment[] => {
  const segments: PathSegment[] = [];
  const normalized = raw.trim().replace(/\[(\d+)\]/g, '.$1');
  if (!normalized) return segments;
  for (const part of normalized.split('.')) {
    if (!part) continue;
    if (/^\d+$/.test(part)) segments.push({ kind: 'index', index: Number(part) });
    else segments.push({ kind: 'key', name: part });
  }
  return segments;
};

export const stripEventPrefix = (raw: string): PathSegment[] | null => {
  const trimmed = raw.trim();
  if (trimmed === 'event' || trimmed === 'event.payload') return [];
  if (trimmed.startsWith('event.payload.')) return parsePath(trimmed.slice('event.payload.'.length));
  if (trimmed.startsWith('event.')) return parsePath(trimmed.slice('event.'.length));
  return null;
};

export const joinSegments = (segments: PathSegment[]): string =>
  segments.map((segment) => (segment.kind === 'key' ? segment.name : String(segment.index))).join('.');

export const getValueAtPath = (obj: unknown, segments: PathSegment[]): unknown => {
  let value: unknown = obj;
  for (const segment of segments) {
    if (value === null || value === undefined) return undefined;
    if (segment.kind === 'index') {
      if (Array.isArray(value)) {
        value = value[segment.index];
        continue;
      }
      if (typeof value === 'object' && String(segment.index) in (value as Record<string, unknown>)) {
        value = (value as Record<string, unknown>)[String(segment.index)];
        continue;
      }
      return undefined;
    }
    if (typeof value === 'object' && segment.name in (value as Record<string, unknown>)) {
      value = (value as Record<string, unknown>)[segment.name];
    } else {
      return undefined;
    }
  }
  return value;
};

type Cursor =
  | { kind: 'entity'; entity: EntityMetadata }
  | { kind: 'entityList'; entity?: EntityMetadata; collection: string }
  | { kind: 'externalRecord'; collection: string }
  | { kind: 'object'; fields: NativeFieldSpec[] }
  | { kind: 'scalar'; type: NativeFieldType; lookupCollection?: string }
  | { kind: 'unknown' };

interface WalkState {
  cursor: Cursor;
  hops: FkHop[];
  depth: number;
  path: PathSegment[];
  error?: string;
  errorParams?: Record<string, string>;
}

const rootCursor = (ctx: SchemaContext, root: PathRoot): Cursor => {
  if (root.kind === 'fields') return { kind: 'object', fields: root.fields };
  const entity = resolveEntity(ctx, root.entityKey);
  return entity ? { kind: 'entity', entity } : { kind: 'unknown' };
};

const invalid = (
  state: WalkState,
  error: string,
  errorParams?: Record<string, string>,
): WalkState => ({ ...state, error, errorParams });

/**
 * Toda referência aponta para uma COLEÇÃO — o `refEntity` é o nome dela, seja de entidade fixa ou de
 * tela do Form Design. Não há mais tradução de chave de tela para coleção física.
 */
const buildReferenceHopState = (
  ctx: SchemaContext,
  state: WalkState,
  refEntity: string,
  multi: boolean,
  segment: PathSegment,
  maxFkDepth: number,
): WalkState => {
  const depth = state.depth + 1;
  if (depth > maxFkDepth) {
    return invalid(state, '@core.automation/path.max-depth', { max: String(maxFkDepth) });
  }
  const path = [...state.path, segment];
  const pathText = joinSegments(path);
  const target = resolveEntity(ctx, refEntity);
  const hop: FkHop = {
    atPath: pathText,
    targetCollection: refEntity,
    materializeAt: pathText,
    mode: 'replaceValue',
    multi,
    fields: 'all',
  };
  const cursor: Cursor = multi
    ? { kind: 'entityList', entity: target, collection: refEntity }
    : target
      ? { kind: 'entity', entity: target }
      : { kind: 'externalRecord', collection: refEntity };
  return { cursor, hops: [...state.hops, hop], depth, path };
};

const stepNativeField = (
  ctx: SchemaContext,
  state: WalkState,
  field: NativeFieldSpec,
  segment: PathSegment,
  maxFkDepth: number,
): WalkState => {
  if (field.refEntity) {
    return buildReferenceHopState(ctx, state, field.refEntity, field.multi === true, segment, maxFkDepth);
  }
  const path = [...state.path, segment];
  if (field.list) {
    return { ...state, cursor: { kind: 'scalar', type: 'stringArray' }, path };
  }
  if (field.type === 'object' && field.objectFields) {
    return { ...state, cursor: { kind: 'object', fields: field.objectFields }, path };
  }
  return {
    ...state,
    cursor: { kind: 'scalar', type: field.type, lookupCollection: field.lookupCollection },
    path,
  };
};

const stepEntity = (
  ctx: SchemaContext,
  state: WalkState,
  cursor: Extract<Cursor, { kind: 'entity' }>,
  segment: Extract<PathSegment, { kind: 'key' }>,
  hasOld: boolean,
  maxFkDepth: number,
): WalkState => {
  const { entity } = cursor;
  const name = segment.name;

  if (name === 'old' && hasOld && state.path.length === 0) {
    return { ...state, path: [segment] };
  }
  if (name === 'changeType' && hasOld && state.path.length === 0) {
    return { ...state, cursor: { kind: 'scalar', type: 'string' }, path: [...state.path, segment] };
  }
  if (name === 'id') {
    return { ...state, cursor: { kind: 'scalar', type: 'string' }, path: [...state.path, segment] };
  }

  const nativeField = entity.fields.find((f) => f.key === name);
  if (nativeField) {
    return stepNativeField(ctx, state, nativeField, segment, maxFkDepth);
  }

  const fkByKey = entity.fks.find((fk) => fk.key === name);
  if (fkByKey) {
    return {
      ...state,
      cursor: { kind: 'scalar', type: fkByKey.multi ? 'stringArray' : 'string' },
      path: [...state.path, segment],
    };
  }

  // Campo de referência navegado pelo NOME do registro apontado (`contract` para `contractId`) —
  // o equivalente, para uma entidade declarada por tela, do `denormKey` das relações do registro.
  const fieldByRefDenormKey = entity.fields.find((f) => f.refDenormKey === name && f.refEntity);
  if (fieldByRefDenormKey) {
    return stepDenormalizedReference(ctx, state, {
      key: fieldByRefDenormKey.key,
      denormKey: name,
      targetCollection: fieldByRefDenormKey.refEntity as string,
      multi: fieldByRefDenormKey.multi === true,
      fields: 'all',
    }, segment, maxFkDepth);
  }

  const fkByDenormKey = entity.fks.find((fk) => fk.denormKey === name);
  if (fkByDenormKey) {
    return stepDenormalizedReference(ctx, state, {
      key: fkByDenormKey.key,
      denormKey: fkByDenormKey.denormKey,
      targetCollection: fkByDenormKey.targetCollection,
      multi: fkByDenormKey.multi === true,
      fields: fkByDenormKey.denormalizedFields ?? 'all',
    }, segment, maxFkDepth);
  }

  return { ...state, cursor: { kind: 'unknown' }, path: [...state.path, segment] };
};

interface DenormalizedReference {
  key: string;
  denormKey: string;
  targetCollection: string;
  multi: boolean;
  fields: string[] | 'all';
}

/**
 * Salto que LÊ de uma chave (`contractId`) e MATERIALIZA em outra (`contract`) — a forma como uma
 * relação aparece nas expressões. Serve tanto às relações do registro quanto aos campos de
 * referência que declaram `refDenormKey`.
 */
const stepDenormalizedReference = (
  ctx: SchemaContext,
  state: WalkState,
  reference: DenormalizedReference,
  segment: PathSegment,
  maxFkDepth: number,
): WalkState => {
  const depth = state.depth + 1;
  if (depth > maxFkDepth) {
    return invalid(state, '@core.automation/path.max-depth', { max: String(maxFkDepth) });
  }
  const parentPath = joinSegments(state.path);
  const prefix = parentPath ? `${parentPath}.` : '';
  const path = [...state.path, segment];
  const target = resolveEntity(ctx, reference.targetCollection);
  const hop: FkHop = {
    atPath: `${prefix}${reference.key}`,
    targetCollection: reference.targetCollection,
    materializeAt: `${prefix}${reference.denormKey}`,
    mode: 'denormKey',
    multi: reference.multi,
    fields: reference.fields,
  };
  const cursor: Cursor = reference.multi
    ? { kind: 'entityList', entity: target, collection: reference.targetCollection }
    : target
      ? { kind: 'entity', entity: target }
      : { kind: 'externalRecord', collection: reference.targetCollection };
  return { cursor, hops: [...state.hops, hop], depth, path };
};

const stepCursor = (
  ctx: SchemaContext,
  state: WalkState,
  segment: PathSegment,
  hasOld: boolean,
  maxFkDepth: number,
): WalkState => {
  const cursor = state.cursor;

  if (cursor.kind === 'unknown' || cursor.kind === 'externalRecord') {
    return { ...state, cursor: { kind: 'unknown' }, path: [...state.path, segment] };
  }

  if (cursor.kind === 'entityList') {
    if (segment.kind !== 'index') {
      return invalid(
        state,
        '@core.automation/path.is-list',
        { path: joinSegments(state.path) },
      );
    }
    const nextCursor: Cursor = cursor.entity
      ? { kind: 'entity', entity: cursor.entity }
      : { kind: 'externalRecord', collection: cursor.collection };
    return { ...state, cursor: nextCursor, path: [...state.path, segment] };
  }

  if (segment.kind === 'index') {
    if (cursor.kind === 'scalar' && cursor.type === 'stringArray') {
      return { ...state, cursor: { kind: 'scalar', type: 'string' }, path: [...state.path, segment] };
    }
    return invalid(
      state,
      '@core.automation/path.not-a-list',
      { path: joinSegments(state.path) },
    );
  }

  switch (cursor.kind) {
    case 'entity':
      return stepEntity(ctx, state, cursor, segment, hasOld, maxFkDepth);
    case 'object': {
      if (segment.name === 'old' && hasOld && state.path.length === 0) {
        return { ...state, path: [segment] };
      }
      const atObjectRoot =
        state.path.length === 0 ||
        (state.path.length === 1 && state.path[0].kind === 'key' && state.path[0].name === 'old');
      if (segment.name === 'id' && atObjectRoot) {
        return { ...state, cursor: { kind: 'scalar', type: 'string' }, path: [...state.path, segment] };
      }
      if (segment.name === 'changeType' && hasOld && state.path.length === 0) {
        return { ...state, cursor: { kind: 'scalar', type: 'string' }, path: [...state.path, segment] };
      }
      const field = cursor.fields.find((f) => f.key === segment.name);
      if (!field) {
        return { ...state, cursor: { kind: 'unknown' }, path: [...state.path, segment] };
      }
      return stepNativeField(ctx, state, field, segment, maxFkDepth);
    }
    case 'scalar':
      return invalid(
        state,
        '@core.automation/path.scalar-has-no-field',
        { path: joinSegments(state.path), field: segment.name },
      );
  }
};

const walk = (
  ctx: SchemaContext,
  root: PathRoot,
  segments: PathSegment[],
  options?: ResolveOptions,
): WalkState => {
  const maxFkDepth = options?.maxFkDepth ?? DEFAULT_MAX_FK_DEPTH;
  let state: WalkState = { cursor: rootCursor(ctx, root), hops: [], depth: 0, path: [] };
  for (const segment of segments) {
    state = stepCursor(ctx, state, segment, root.hasOld, maxFkDepth);
    if (state.error) return state;
  }
  return state;
};

const cursorToNode = (cursor: Cursor): PathNode => {
  switch (cursor.kind) {
    case 'entity':
      return { kind: 'entity', collection: cursor.entity.collection };
    case 'entityList':
      return { kind: 'entityList', collection: cursor.collection };
    case 'externalRecord':
      return { kind: 'entity', collection: cursor.collection };
    case 'object':
      return { kind: 'object' };
    case 'scalar':
      return { kind: 'scalar', type: cursor.type, lookupCollection: cursor.lookupCollection };
    case 'unknown':
      return { kind: 'unknown' };
  }
};

export const resolvePath = (
  ctx: SchemaContext,
  root: PathRoot,
  segments: PathSegment[],
  options?: ResolveOptions,
): PathResolution => {
  const state = walk(ctx, root, segments, options);
  if (state.error) {
    return {
      valid: false,
      error: state.error,
      errorParams: state.errorParams,
      node: { kind: 'unknown' },
      hops: state.hops,
      depth: state.depth,
    };
  }
  return { valid: true, node: cursorToNode(state.cursor), hops: state.hops, depth: state.depth };
};

/**
 * O rótulo da lista sai do CONTEXTO — que já reúne as do kernel e as declaradas pelo escritório ou
 * por extensão. Antes só o registro do kernel dava nome, e a lista de uma entidade instalada
 * aparecia pelo nome cru da coleção.
 */
const scalarDetail = (ctx: SchemaContext, lookupCollection?: string): string | undefined => {
  const lookup = lookupCollection ? ctx.lookups.get(lookupCollection) : undefined;
  if (!lookup) return undefined;
  return `Lista: ${LOOKUP_REGISTRY[lookup.collection] ? getLookupLabel(lookup.collection) : lookup.label}`;
};

const nativeFieldSuggestion = (ctx: SchemaContext, field: NativeFieldSpec): PathSuggestion => {
  const kind: PathSuggestionKind = field.origin && field.origin !== 'builtin' ? 'customField' : 'field';
  if (field.refEntity) {
    return {
      insertText: field.key,
      label: field.label,
      kind: field.multi ? 'referenceList' : 'reference',
      detail: resolveEntity(ctx, field.refEntity)?.labelSingular ?? field.refEntity,
      isLeaf: false,
    };
  }
  if (field.list) {
    return { insertText: field.key, label: field.label, kind, detail: 'Lista', isLeaf: true };
  }
  return {
    insertText: field.key,
    label: field.label,
    kind,
    detail: field.type === 'object' ? 'Objeto' : scalarDetail(ctx, field.lookupCollection),
    isLeaf: field.type !== 'object',
  };
};

const entitySuggestions = (
  ctx: SchemaContext,
  cursor: Extract<Cursor, { kind: 'entity' }>,
  atRoot: boolean,
  hasOld: boolean,
): PathSuggestion[] => {
  const { entity } = cursor;
  const suggestions: PathSuggestion[] = [];

  if (atRoot && hasOld) {
    suggestions.push({
      insertText: 'changeType',
      label: '@core.automation/autocomplete.change-type',
      kind: 'field',
      isLeaf: true,
    });
    suggestions.push({
      insertText: 'old',
      label: '@core.automation/autocomplete.old',
      kind: 'special',
      isLeaf: false,
    });
  }
  suggestions.push({
    insertText: 'id',
    label: '@core.automation/autocomplete.id',
    kind: 'field',
    isLeaf: true,
  });

  for (const field of entity.fields) {
    suggestions.push(nativeFieldSuggestion(ctx, field));
    // O campo guarda o id; a navegação pelo registro apontado tem nome próprio e também se sugere,
    // senão quem escreve a expressão não descobriria `contract` a partir de `contractId`.
    if (field.refEntity && field.refDenormKey) {
      suggestions.push({
        insertText: field.refDenormKey,
        label: field.label,
        kind: field.multi ? 'fkList' : 'fk',
        detail: resolveEntity(ctx, field.refEntity)?.labelSingular ?? field.refEntity,
        isLeaf: false,
      });
    }
  }

  for (const fk of entity.fks) {
    suggestions.push({
      insertText: fk.key,
      // eslint-disable-next-line no-restricted-syntax -- marcador "(Id)", igual em qualquer idioma
      label: `${fk.label} (Id)`,
      kind: 'field',
      isLeaf: true,
    });
    suggestions.push({
      insertText: fk.denormKey,
      label: fk.label,
      kind: fk.multi ? 'fkList' : 'fk',
      detail: resolveEntity(ctx, fk.targetCollection)?.labelSingular ?? fk.targetCollection,
      isLeaf: false,
    });
  }

  return suggestions;
};

export const suggestNextSegments = (
  ctx: SchemaContext,
  root: PathRoot,
  segments: PathSegment[],
  options?: ResolveOptions,
): PathSuggestion[] => {
  const state = walk(ctx, root, segments, options);
  if (state.error) return [];
  const cursor = state.cursor;
  const atRoot = state.path.length === 0;

  switch (cursor.kind) {
    case 'entity':
      return entitySuggestions(ctx, cursor, atRoot, root.hasOld);
    case 'entityList':
      return [{
        insertText: '0',
        label: '@core.automation/autocomplete.first-item',
        kind: 'index',
        isLeaf: false,
      }];
    case 'object': {
      if (atRoot && root.hasOld) {
        return [
          {
            insertText: 'changeType',
            label: '@core.automation/autocomplete.change-type',
            kind: 'field',
            isLeaf: true,
          },
          {
            insertText: 'old',
            label: '@core.automation/autocomplete.old',
            kind: 'special',
            isLeaf: false,
          },
          ...cursor.fields.map((field) => nativeFieldSuggestion(ctx, field)),
        ];
      }
      return cursor.fields.map((field) => nativeFieldSuggestion(ctx, field));
    }
    default:
      return [];
  }
};
