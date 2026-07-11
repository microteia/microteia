export const setNestedValue = (
  target: Record<string, unknown>,
  path: string[],
  value: unknown,
): void => {
  let cursor = target;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    const next = cursor[key];
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[path[path.length - 1]] = value;
};

export const buildNestedParams = (entries: [string, unknown][]): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of entries) {
    setNestedValue(result, key.split('.'), value);
  }
  return result;
};
