export const isTimestampLike = (v: unknown): v is { toDate: () => Date } =>
  !!v && typeof v === 'object' && typeof (v as { toDate?: unknown }).toDate === 'function';

const isSerializedTimestamp = (v: unknown): v is { seconds: number; nanoseconds: number } =>
  !!v &&
  typeof v === 'object' &&
  (v as { type?: unknown }).type === 'firestore/timestamp/1.0' &&
  typeof (v as { seconds?: unknown }).seconds === 'number' &&
  typeof (v as { nanoseconds?: unknown }).nanoseconds === 'number';

const isPlainObject = (v: unknown): v is Record<string, unknown> => {
  if (!v || typeof v !== 'object') return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};

export const normalizeFirestoreValue = <T>(value: T): T => {
  if (isTimestampLike(value)) return value.toDate() as unknown as T;

  if (isSerializedTimestamp(value)) {
    return new Date(value.seconds * 1000 + Math.floor(value.nanoseconds / 1e6)) as unknown as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeFirestoreValue(item)) as unknown as T;
  }

  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] = normalizeFirestoreValue(item);
    }
    return result as unknown as T;
  }

  return value;
};
