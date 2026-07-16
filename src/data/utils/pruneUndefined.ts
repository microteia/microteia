export const pruneUndefined = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map((item) => pruneUndefined(item)) as T;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, pruneUndefined(v)] as const);
    return Object.fromEntries(entries) as T;
  }
  return value;
};
