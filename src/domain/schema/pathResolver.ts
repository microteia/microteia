import type { EntityKey, EntityMetadata, NativeFieldSpec, NativeFieldType } from './entityRegistry';
import { lookupLabelRef } from './lookupRegistry';
import type { SchemaContext } from './screenEntity';
import { resolveEntity } from './screenEntity';
import type { ContactKind } from './notificationContacts';

export type { SchemaContext, SchemaScreen } from './screenEntity';
export { createSchemaContext } from './screenEntity';

export const DEFAULT_MAX_FK_DEPTH = 3;

/**
 * A raiz de um caminho. Na de entidade, `extras` são chaves que o EVENTO leva ao lado do registro, no
 * mesmo nível — a abertura pelo portal (`portalView`) sobre o próprio registro aberto. Elas são
 * resolvidas antes dos campos da entidade, só no primeiro segmento.
 */
export type PathRoot =
  | { kind: 'entity'; entityKey: EntityKey; hasOld: boolean; extras?: NativeFieldSpec[] }
  | { kind: 'fields'; fields: NativeFieldSpec[]; hasOld: boolean };

const rootExtras = (root: PathRoot): NativeFieldSpec[] => (root.kind === 'entity' ? root.extras ?? [] : []);

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

/**
 * `list` marca o que o caminho colheu de uma LISTA de registros — `activePoleIds.cpf` é um CPF por
 * apontado. O tipo continua sendo o do campo: quem precisa do valor sabe lê-lo, e quem precisa saber
 * que ele vem em vários (um balde de data, uma soma) pergunta por `list`.
 */
export type PathNode =
  | { kind: 'scalar'; type: NativeFieldType; lookupCollection?: string; list?: true; contact?: ContactKind }
  | { kind: 'entity'; collection: string }
  | { kind: 'entityList'; collection: string }
  | { kind: 'object'; list?: true }
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
  /** REFERÊNCIA de mensagem, ou o rótulo que o escritório digitou. */
  label: string;
  kind: PathSuggestionKind;
  /**
   * O que a sugestão é — "Lista", "Objeto", a entidade apontada. REFERÊNCIA, como `label`, e com
   * `detailParams` para o que é composto: os três eram texto em português escrito aqui, num módulo
   * que o backend também compila e que não pode conhecer catálogo de idioma.
   */
  detail?: string;
  detailParams?: Record<string, string>;
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
    // O campo de CADA item, quando o valor é uma LISTA — a referência de vários chega hidratada como
    // uma lista de registros, e `activePoleIds.cpf` é o CPF de cada apontado. Sem esta projeção o
    // caminho devolvia `undefined`, e a única forma de ler um campo do apontado era fixar a posição
    // (`activePoleIds.0.cpf`), que responde por um item e ignora o resto.
    //
    // O resultado é achatado um nível a cada passo (lista de listas é lista) e o ausente sai: uma
    // lista vazia é ausência de valor, não o valor vazio — é o que mantém `exists` respondendo não.
    if (Array.isArray(value)) {
      const projected = value
        .flatMap((item) => {
          const found = getValueAtPath(item, [segment]);
          return Array.isArray(found) ? found : [found];
        })
        .filter((item) => item !== null && item !== undefined);
      value = projected.length > 0 ? projected : undefined;
      continue;
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
  | { kind: 'scalar'; type: NativeFieldType; lookupCollection?: string; contact?: ContactKind }
  | { kind: 'unknown' };

interface WalkState {
  cursor: Cursor;
  hops: FkHop[];
  depth: number;
  path: PathSegment[];
  /**
   * O caminho ATRAVESSOU uma lista de registros sem fixar a posição — do ponto em que isso acontece,
   * tudo o que ele lê é um valor por item. Uma vez ligado nunca se desliga: entrar num registro
   * apontado de dentro de uma lista continua sendo um por item.
   */
  listed?: true;
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
  return { cursor, hops: [...state.hops, hop], depth, path, listed: state.listed };
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
    cursor: {
      kind: 'scalar',
      type: field.type,
      lookupCollection: field.lookupCollection,
      ...(field.contact ? { contact: field.contact } : {}),
    },
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
  return { cursor, hops: [...state.hops, hop], depth, path, listed: state.listed };
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
    const item: Cursor = cursor.entity
      ? { kind: 'entity', entity: cursor.entity }
      : { kind: 'externalRecord', collection: cursor.collection };
    // A posição fixa um item; o NOME de um campo atravessa todos eles, e o que o caminho lê dali é um
    // valor por apontado. Exigir a posição era recusar a pergunta mais comum sobre uma referência de
    // vários — "o CPF do polo ativo" —, e nenhum agrupamento ou filtro de relatório podia escrevê-la.
    if (segment.kind !== 'index') {
      return stepCursor(ctx, { ...state, cursor: item, listed: true }, segment, hasOld, maxFkDepth);
    }
    return { ...state, cursor: item, path: [...state.path, segment] };
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
    const extra = state.path.length === 0 && segment.kind === 'key'
      ? rootExtras(root).find((field) => field.key === segment.name)
      : undefined;
    state = extra
      ? stepNativeField(ctx, state, extra, segment, maxFkDepth)
      : stepCursor(ctx, state, segment, root.hasOld, maxFkDepth);
    if (state.error) return state;
  }
  return state;
};

/**
 * O nó do que o caminho alcançou. Ter ATRAVESSADO uma lista muda a resposta: um registro apontado de
 * dentro dela é uma lista de registros, e um campo dele é um valor por item.
 */
const cursorToNode = (cursor: Cursor, listed: boolean): PathNode => {
  switch (cursor.kind) {
    case 'entity':
      return listed
        ? { kind: 'entityList', collection: cursor.entity.collection }
        : { kind: 'entity', collection: cursor.entity.collection };
    case 'entityList':
      return { kind: 'entityList', collection: cursor.collection };
    case 'externalRecord':
      return listed
        ? { kind: 'entityList', collection: cursor.collection }
        : { kind: 'entity', collection: cursor.collection };
    case 'object':
      return listed ? { kind: 'object', list: true } : { kind: 'object' };
    case 'scalar': {
      // O contato atravessa até o nó: é por ele que o passo `notify` sabe que o caminho leva a um
      // campo que a TELA declarou como meio de falar com alguém.
      const contact = cursor.contact ? { contact: cursor.contact } : {};
      return listed
        ? { kind: 'scalar', type: cursor.type, lookupCollection: cursor.lookupCollection, list: true, ...contact }
        : { kind: 'scalar', type: cursor.type, lookupCollection: cursor.lookupCollection, ...contact };
    }
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
  return {
    valid: true,
    node: cursorToNode(state.cursor, state.listed === true),
    hops: state.hops,
    depth: state.depth,
  };
};

/**
 * O rótulo da lista sai do CONTEXTO — que já reúne as do kernel e as declaradas pelo escritório ou
 * por extensão. Antes só o registro do kernel dava nome, e a lista de uma entidade instalada
 * aparecia pelo nome cru da coleção.
 */
const scalarDetail = (
  ctx: SchemaContext,
  lookupCollection?: string,
): Pick<PathSuggestion, 'detail' | 'detailParams'> => {
  const lookup = lookupCollection ? ctx.lookups.get(lookupCollection) : undefined;
  if (!lookup) return {};
  // A lista do kernel tem rótulo composto; a do escritório traz o próprio, que já pode ser referência
  // com parâmetros. Nos dois casos o nome desce como parâmetro IRMÃO, e o motor resolve as duas voltas.
  const kernel = lookupLabelRef(lookup.collection);
  const inner = kernel.labelParams
    ? { name: kernel.label, ...kernel.labelParams }
    : { name: lookup.label, ...(lookup.labelParams ?? {}) };
  return { detail: '@core.ui/expression.detail.lookup', detailParams: inner };
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
    return { insertText: field.key, label: field.label, kind, detail: '@core.ui/expression.detail.list', isLeaf: true };
  }
  return {
    insertText: field.key,
    label: field.label,
    kind,
    ...(field.type === 'object'
      ? { detail: '@core.ui/expression.detail.object' }
      : scalarDetail(ctx, field.lookupCollection)),
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
      return [
        ...entitySuggestions(ctx, cursor, atRoot, root.hasOld),
        ...(atRoot ? rootExtras(root).map((field) => nativeFieldSuggestion(ctx, field)) : []),
      ];
    case 'entityList': {
      const first: PathSuggestion = {
        insertText: '0',
        label: '@core.automation/autocomplete.first-item',
        kind: 'index',
        isLeaf: false,
      };
      // Os campos de cada item vêm depois da posição, e não em vez dela: o caminho aceita os dois, e
      // oferecer só a posição escondia a leitura que atravessa a lista inteira.
      if (!cursor.entity) return [first];
      return [first, ...entitySuggestions(ctx, { kind: 'entity', entity: cursor.entity }, false, false)];
    }
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
