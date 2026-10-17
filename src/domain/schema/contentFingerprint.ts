// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/contentFingerprint.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Impressão digital de CONTEÚDO: 64 bits de FNV-1a (duas sementes), em hex. Não é criptográfica —
 * responde "isto mudou?", não "isto é autêntico?" —, e por isso roda igual no navegador e no Node,
 * síncrona, sem `crypto`.
 */

const FNV_PRIME = 0x01000193;

const fnv1a = (input: string, seed: number): number => {
  let hash = seed;
  for (let index = 0; index < input.length; index += 1) {
    hash = Math.imul(hash ^ input.charCodeAt(index), FNV_PRIME);
  }
  return hash >>> 0;
};

const hex = (value: number): string => value.toString(16).padStart(8, '0');

export const textFingerprint = (text: string): string =>
  `${hex(fnv1a(text, 0x811c9dc5))}${hex(fnv1a(text, 0x1000193))}`;

/**
 * O JSON com as chaves em ordem e sem `undefined`: dois objetos de mesmo conteúdo dão o mesmo texto,
 * qualquer que seja a ordem em que as chaves foram escritas — o Firestore não a preserva.
 */
export const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item ?? null)).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
};

export const contentFingerprint = (value: unknown): string => textFingerprint(canonicalJson(value));
