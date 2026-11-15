// The rule of `normalize-code`, outside the sandbox: this file uses no sandbox global, so a test can
// call it in a second. The script lists it BEFORE itself in the merge, and the compiler drops the
// `export` and the import between the two — the sandbox resolves no module.

export interface NormalizedCode {
  code: string | null;
  changed: boolean;
}

/** Upper case, trimmed, inner spaces as single hyphens — `' ab  c '` becomes `'AB-C'`. */
export function normalizeCode(value: unknown): NormalizedCode {
  if (value === null || value === undefined) return { code: null, changed: false };
  const original = String(value);
  if (original.trim() === '') return { code: null, changed: false };
  const code = original.trim().toUpperCase().split(/\s+/).join('-');
  return { code, changed: code !== original };
}
