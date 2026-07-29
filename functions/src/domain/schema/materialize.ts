// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/materialize.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

import type { FkHop, PathSegment } from './pathResolver';
import { getValueAtPath, parsePath } from './pathResolver';

export const MULTI_FK_MATERIALIZE_LIMIT = 50;

export interface RecordRef {
  collection: string;
  id: string;
}

export type RecordMap = ReadonlyMap<string, Record<string, unknown> | null>;

export const recordKey = (collection: string, id: string): string => `${collection}:${id}`;

const idsAtHop = (payload: Record<string, unknown>, hop: FkHop): string[] => {
  const raw = getValueAtPath(payload, parsePath(hop.atPath));
  if (hop.multi) {
    if (!Array.isArray(raw)) return [];
    return raw.filter((value): value is string => typeof value === 'string').slice(0, MULTI_FK_MATERIALIZE_LIMIT);
  }
  return typeof raw === 'string' && raw ? [raw] : [];
};

const hasAllFields = (value: unknown, requiredFields: string[]): boolean =>
  value !== null && typeof value === 'object' && requiredFields.every((field) => field in (value as Record<string, unknown>));

const denormValueSatisfies = (value: unknown, hop: FkHop): boolean => {
  if (value === undefined || value === null || typeof value !== 'object') return false;
  const requiredFields = hop.requiredFields;
  if (!requiredFields || requiredFields.length === 0) return true;
  if (hop.multi) {
    return Array.isArray(value) && value.length > 0 && value.every((item) => hasAllFields(item, requiredFields));
  }
  return hasAllFields(value, requiredFields);
};

export const collectHopRecordRefs = (payload: Record<string, unknown>, hops: FkHop[]): RecordRef[] => {
  const refs = new Map<string, RecordRef>();
  for (const hop of hops) {
    if (hop.mode === 'denormKey') {
      const existing = getValueAtPath(payload, parsePath(hop.materializeAt));
      if (denormValueSatisfies(existing, hop)) continue;
    }
    for (const id of idsAtHop(payload, hop)) {
      refs.set(recordKey(hop.targetCollection, id), { collection: hop.targetCollection, id });
    }
  }
  return [...refs.values()];
};

const pickFields = (
  data: Record<string, unknown>,
  fields: string[] | 'all',
  id: string,
): Record<string, unknown> => {
  if (fields === 'all') return { id, ...data };
  const result: Record<string, unknown> = { id };
  for (const field of fields) {
    if (field !== 'id' && field in data) {
      result[field] = data[field];
    }
  }
  return result;
};

const buildRecordValue = (
  hop: FkHop,
  id: string,
  data: Record<string, unknown> | null | undefined,
): Record<string, unknown> => (data ? pickFields(data, hop.fields, id) : { id });

const setValueAtPath = (target: unknown, segments: PathSegment[], value: unknown): unknown => {
  if (segments.length === 0) return value;
  const [segment, ...rest] = segments;
  if (segment.kind === 'index') {
    const list = Array.isArray(target) ? [...target] : [];
    list[segment.index] = setValueAtPath(list[segment.index], rest, value);
    return list;
  }
  const base = target && typeof target === 'object' && !Array.isArray(target) ? { ...(target as Record<string, unknown>) } : {};
  base[segment.name] = setValueAtPath(base[segment.name], rest, value);
  return base;
};

export const materializeHops = (
  payload: Record<string, unknown>,
  hops: FkHop[],
  records: RecordMap,
): Record<string, unknown> => {
  let result = payload;

  for (const hop of hops) {
    const materializeSegments = parsePath(hop.materializeAt);

    if (hop.mode === 'denormKey') {
      const existing = getValueAtPath(result, materializeSegments);
      if (denormValueSatisfies(existing, hop)) continue;
      const ids = idsAtHop(result, hop);
      if (ids.length === 0) continue;
      const merge = (previous: unknown, built: Record<string, unknown>): Record<string, unknown> =>
        previous && typeof previous === 'object' && !Array.isArray(previous)
          ? { ...(previous as Record<string, unknown>), ...built }
          : built;
      const value = hop.multi
        ? ids.map((id, index) =>
            merge(
              Array.isArray(existing) ? existing[index] : undefined,
              buildRecordValue(hop, id, records.get(recordKey(hop.targetCollection, id))),
            ),
          )
        : merge(existing, buildRecordValue(hop, ids[0], records.get(recordKey(hop.targetCollection, ids[0]))));
      result = setValueAtPath(result, materializeSegments, value) as Record<string, unknown>;
      continue;
    }

    const current = getValueAtPath(result, parsePath(hop.atPath));
    if (hop.multi) {
      if (!Array.isArray(current)) continue;
      const replaced = current.map((item, index) =>
        typeof item === 'string' && index < MULTI_FK_MATERIALIZE_LIMIT
          ? buildRecordValue(hop, item, records.get(recordKey(hop.targetCollection, item)))
          : item,
      );
      result = setValueAtPath(result, materializeSegments, replaced) as Record<string, unknown>;
    } else {
      if (typeof current !== 'string' || !current) continue;
      const value = buildRecordValue(hop, current, records.get(recordKey(hop.targetCollection, current)));
      result = setValueAtPath(result, materializeSegments, value) as Record<string, unknown>;
    }
  }

  return result;
};
