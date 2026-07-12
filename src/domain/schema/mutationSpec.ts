import type { InputMapping } from '../entities/Workflow';
import type { EntityKey, NativeFieldType } from './entityRegistry';
import { getEntityByCollection } from './entityRegistry';
import { isLookupCollection } from './lookupRegistry';
import type { PathRoot, SchemaContext } from './pathResolver';
import { parsePath, resolvePath } from './pathResolver';
import { resolveQueryTable } from './querySpec';

export interface UpsertSpec {
  table: string;
  id?: string;
  data: Record<string, unknown>;
}

export interface RemoveSpec {
  table: string;
  id: string;
}

export interface UpsertFieldMapping {
  path: string;
  value: InputMapping;
}

export interface UpsertStepConfig {
  table: string;
  id?: InputMapping;
  fields: UpsertFieldMapping[];
}

export interface RemoveStepConfig {
  table: string;
  id: InputMapping;
}

export const setValueAtPath = (
  target: Record<string, unknown>,
  path: string,
  value: unknown,
): void => {
  const parts = path.split('.').filter(Boolean);
  if (parts.length === 0) return;
  let cursor = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    const next = cursor[key];
    if (typeof next !== 'object' || next === null || Array.isArray(next)) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]] = value;
};

export type WritableTableKind = 'entity' | 'custom' | 'lookup';

export interface ResolvedWritableTable {
  kind: WritableTableKind;
  physicalCollection: string;
  screenKey?: string;
  entityKey?: EntityKey;
  root: PathRoot;
}

export type WritableTableOutcome =
  | { ok: true; value: ResolvedWritableTable }
  | { ok: false; error: string };

const WRITABLE_ENTITY_KEYS: ReadonlySet<EntityKey> = new Set<EntityKey>([
  'persons',
  'cases',
  'contracts',
  'deadlines',
  'financials',
  'customRecords',
]);

export const LOOKUP_WRITABLE_FIELDS: readonly string[] = ['key', 'label', 'color'];

const SYSTEM_MANAGED_KEYS: ReadonlySet<string> = new Set([
  'id',
  'screenKey',
  'title',
  'createdAt',
  'updatedAt',
  'createdBy',
  'updatedBy',
  'updatedByName',
  'updatedByPhotoURL',
  'deletedBy',
  'deletedByName',
  'deletedByPhotoURL',
]);

export const resolveWritableTable = (table: string, ctx: SchemaContext): WritableTableOutcome => {
  const resolved = resolveQueryTable(table, ctx);
  if (!resolved) return { ok: false, error: `Tabela "${table}" não existe` };

  if (isLookupCollection(table)) {
    return { ok: true, value: { kind: 'lookup', physicalCollection: table, root: resolved.root } };
  }

  if (resolved.screenKey) {
    return {
      ok: true,
      value: {
        kind: 'custom',
        physicalCollection: 'customRecords',
        screenKey: resolved.screenKey,
        entityKey: 'customRecords',
        root: resolved.root,
      },
    };
  }

  const entity = getEntityByCollection(resolved.physicalCollection);
  if (!entity || !WRITABLE_ENTITY_KEYS.has(entity.key)) {
    return { ok: false, error: `A tabela "${table}" não pode ser alterada por automações` };
  }
  return {
    ok: true,
    value: { kind: 'entity', physicalCollection: entity.collection, entityKey: entity.key, root: resolved.root },
  };
};

export interface MutationSpecIssue {
  field: string;
  error: string;
}

export interface WriteLeaf {
  path: string;
  value: unknown;
}

export const flattenDataLeaves = (data: unknown, prefix = ''): WriteLeaf[] => {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return prefix ? [{ path: prefix, value: data }] : [];
  }
  const entries = Object.entries(data as Record<string, unknown>);
  if (entries.length === 0) return prefix ? [{ path: prefix, value: data }] : [];
  return entries.flatMap(([key, value]) => flattenDataLeaves(value, prefix ? `${prefix}.${key}` : key));
};

const checkWritablePath = (
  ctx: SchemaContext,
  root: PathRoot,
  path: string,
): string | undefined => {
  const segments = parsePath(path);
  if (segments.length === 0) return 'Caminho do campo não informado';

  const top = segments[0].kind === 'key' ? segments[0].name : String(segments[0].index);
  if (SYSTEM_MANAGED_KEYS.has(top)) return `O campo "${top}" é gerenciado pelo sistema e não pode ser gravado`;

  const resolution = resolvePath(ctx, root, segments);
  if (!resolution.valid) return resolution.error ?? `Caminho "${path}" inválido`;
  if (resolution.node.kind === 'unknown') return `O campo "${path}" não existe nessa tabela`;
  if (resolution.hops.some((hop) => hop.atPath !== path)) {
    return `Não é possível gravar através de uma referência: "${path}"`;
  }
  return undefined;
};

export const validateUpsertSpec = (spec: UpsertSpec, ctx: SchemaContext): MutationSpecIssue[] => {
  const issues: MutationSpecIssue[] = [];

  const outcome = resolveWritableTable(spec.table, ctx);
  if (!outcome.ok) {
    issues.push({ field: 'table', error: outcome.error });
    return issues;
  }
  const resolved = outcome.value;

  if (spec.id !== undefined && (typeof spec.id !== 'string' || spec.id.trim() === '')) {
    issues.push({ field: 'id', error: 'Id do registro inválido' });
  }

  if (!spec.data || typeof spec.data !== 'object' || Array.isArray(spec.data)) {
    issues.push({ field: 'data', error: 'Dados para gravação não informados' });
    return issues;
  }

  const leaves = flattenDataLeaves(spec.data);
  if (leaves.length === 0) {
    issues.push({ field: 'data', error: 'Nenhum campo para gravar' });
    return issues;
  }

  if (resolved.kind === 'lookup') {
    for (const leaf of leaves) {
      if (leaf.path.includes('.') || !LOOKUP_WRITABLE_FIELDS.includes(leaf.path)) {
        issues.push({ field: `data.${leaf.path}`, error: `Campo "${leaf.path}" não é gravável em uma lista` });
      }
    }
    return issues;
  }

  for (const leaf of leaves) {
    const top = leaf.path.split('.')[0];
    if (resolved.kind === 'custom' && top !== 'values') {
      issues.push({
        field: `data.${leaf.path}`,
        error: 'Em entidades personalizadas, grave os campos dentro de "values"',
      });
      continue;
    }
    const error = checkWritablePath(ctx, resolved.root, leaf.path);
    if (error) issues.push({ field: `data.${leaf.path}`, error });
  }

  return issues;
};

export const validateWritablePath = (
  ctx: SchemaContext,
  table: string,
  path: string,
): string | undefined => {
  if (!path.trim()) return 'Informe o campo a gravar';
  const outcome = resolveWritableTable(table, ctx);
  if (!outcome.ok) return outcome.error;
  const resolved = outcome.value;
  if (resolved.kind === 'lookup') {
    return path.includes('.') || !LOOKUP_WRITABLE_FIELDS.includes(path)
      ? `Campo "${path}" não é gravável em uma lista`
      : undefined;
  }
  const top = path.split('.')[0];
  if (resolved.kind === 'custom' && top !== 'values') {
    return 'Em entidades personalizadas, grave os campos dentro de "values"';
  }
  return checkWritablePath(ctx, resolved.root, path);
};

export const validateRemoveSpec = (spec: RemoveSpec, ctx: SchemaContext): MutationSpecIssue[] => {
  const issues: MutationSpecIssue[] = [];

  const outcome = resolveWritableTable(spec.table, ctx);
  if (!outcome.ok) {
    issues.push({ field: 'table', error: outcome.error });
  }
  if (typeof spec.id !== 'string' || spec.id.trim() === '') {
    issues.push({ field: 'id', error: 'Id do registro a excluir não informado' });
  }

  return issues;
};

export const coerceWriteValue = (type: NativeFieldType | undefined, value: unknown): unknown => {
  if (value === null || value === undefined) return null;
  switch (type) {
    case 'date': {
      if (value instanceof Date) return value;
      if (typeof value === 'number') return new Date(value);
      if (typeof value === 'string') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? value : parsed;
      }
      return value;
    }
    case 'number': {
      if (typeof value === 'number') return value;
      if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) return Number(value);
      return value;
    }
    case 'boolean': {
      if (typeof value === 'boolean') return value;
      if (value === 'true' || value === 1) return true;
      if (value === 'false' || value === 0) return false;
      return value;
    }
    case 'stringArray':
      return Array.isArray(value) ? value : [value];
    default:
      return value;
  }
};

export const resolveLeafType = (
  ctx: SchemaContext,
  root: PathRoot,
  path: string,
): NativeFieldType | undefined => {
  const resolution = resolvePath(ctx, root, parsePath(path));
  return resolution.node.kind === 'scalar' ? resolution.node.type : undefined;
};
