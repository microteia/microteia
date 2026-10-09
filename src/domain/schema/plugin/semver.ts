export interface SemVer {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
  raw: string;
}

export type RangeOperator = '=' | '^' | '~' | '>' | '>=' | '<' | '<=';

export interface RangeComparator {
  operator: RangeOperator;
  version: SemVer;
}

const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;
const COMPARATOR_PATTERN = /^(\^|~|>=|<=|>|<|=)?\s*(.+)$/;
const NUMERIC_IDENTIFIER = /^\d+$/;

export const parseSemVer = (raw: string): SemVer | null => {
  if (typeof raw !== 'string') return null;
  const match = VERSION_PATTERN.exec(raw.trim());
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split('.') : [],
    raw: raw.trim(),
  };
};

export const isValidSemVer = (raw: string): boolean => parseSemVer(raw) !== null;

const comparePrereleaseIdentifiers = (a: string, b: string): number => {
  const aNumeric = NUMERIC_IDENTIFIER.test(a);
  const bNumeric = NUMERIC_IDENTIFIER.test(b);
  if (aNumeric && bNumeric) return Number(a) - Number(b);
  if (aNumeric) return -1;
  if (bNumeric) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
};

const comparePrerelease = (a: string[], b: string[]): number => {
  if (a.length === 0 && b.length === 0) return 0;
  if (a.length === 0) return 1;
  if (b.length === 0) return -1;
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if (i >= a.length) return -1;
    if (i >= b.length) return 1;
    const result = comparePrereleaseIdentifiers(a[i], b[i]);
    if (result !== 0) return result < 0 ? -1 : 1;
  }
  return 0;
};

export const compareSemVer = (a: SemVer, b: SemVer): number => {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
  return comparePrerelease(a.prerelease, b.prerelease);
};

export const parseComparator = (raw: string): RangeComparator | null => {
  const match = COMPARATOR_PATTERN.exec(raw.trim());
  if (!match) return null;
  const version = parseSemVer(match[2]);
  if (!version) return null;
  return { operator: (match[1] as RangeOperator) ?? '=', version };
};

/** Uma faixa é uma conjunção de comparadores separados por espaço (`>=1.2.0 <2.0.0`), ou `*`. */
export const parseRange = (raw: string): RangeComparator[] | null => {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed === '' ) return null;
  if (trimmed === '*') return [];
  const comparators = trimmed.split(/\s+/).map(parseComparator);
  if (comparators.some((comparator) => comparator === null)) return null;
  return comparators as RangeComparator[];
};

export const isValidRange = (raw: string): boolean => parseRange(raw) !== null;

/**
 * Limite superior exclusivo de `^`, com a semântica do npm: em 0.x cada casa à esquerda do
 * primeiro dígito significativo é tratada como incompatível — `^0.2.3` não aceita `0.3.0` e
 * `^0.0.3` não aceita `0.0.4`.
 */
const caretUpperBound = (version: SemVer): SemVer => {
  if (version.major > 0) return { major: version.major + 1, minor: 0, patch: 0, prerelease: [], raw: '' };
  if (version.minor > 0) return { major: 0, minor: version.minor + 1, patch: 0, prerelease: [], raw: '' };
  return { major: 0, minor: 0, patch: version.patch + 1, prerelease: [], raw: '' };
};

const tildeUpperBound = (version: SemVer): SemVer =>
  ({ major: version.major, minor: version.minor + 1, patch: 0, prerelease: [], raw: '' });

const sameTuple = (a: SemVer, b: SemVer): boolean =>
  a.major === b.major && a.minor === b.minor && a.patch === b.patch;

const satisfiesComparator = (version: SemVer, comparator: RangeComparator): boolean => {
  const { operator, version: target } = comparator;

  // Uma pré-release só entra numa faixa quando o comparador fala explicitamente da mesma
  // tupla x.y.z — senão `1.0.0-beta` satisfaria `^1.0.0` e um teste virava produção.
  if (version.prerelease.length > 0 && !(target.prerelease.length > 0 && sameTuple(version, target))) {
    return false;
  }

  const order = compareSemVer(version, target);
  switch (operator) {
    case '=':  return order === 0;
    case '>':  return order > 0;
    case '>=': return order >= 0;
    case '<':  return order < 0;
    case '<=': return order <= 0;
    case '^':  return order >= 0 && compareSemVer(version, caretUpperBound(target)) < 0;
    case '~':  return order >= 0 && compareSemVer(version, tildeUpperBound(target)) < 0;
  }
};

const LOWER_BOUND_OPERATORS: ReadonlySet<RangeOperator> = new Set(['=', '>', '>=', '^', '~']);

/**
 * A faixa exclui TODA versão anterior a `floor`? Como a faixa é uma conjunção, basta um comparador de
 * limite inferior já em `floor` ou acima. É a pergunta de quem usa um recurso que só existe a partir
 * de uma versão: a faixa que a responde com "sim" é a que faz o kernel antigo recusar o pacote.
 * Faixa inválida, ou `*`, responde "não".
 */
export const rangeExcludesBelow = (range: string, floor: string): boolean => {
  const comparators = parseRange(range);
  const minimum = parseSemVer(floor);
  if (!comparators || !minimum) return false;
  return comparators.some((comparator) =>
    LOWER_BOUND_OPERATORS.has(comparator.operator) && compareSemVer(comparator.version, minimum) >= 0);
};

export const satisfiesRange = (version: string, range: string): boolean => {
  const parsedVersion = parseSemVer(version);
  const comparators = parseRange(range);
  if (!parsedVersion || !comparators) return false;
  return comparators.every((comparator) => satisfiesComparator(parsedVersion, comparator));
};

export const maxSatisfying = (versions: string[], range: string): string | null => {
  const candidates = versions
    .filter((version) => satisfiesRange(version, range))
    .map(parseSemVer)
    .filter((version): version is SemVer => version !== null);
  if (candidates.length === 0) return null;
  return candidates.reduce((best, current) => (compareSemVer(current, best) > 0 ? current : best)).raw;
};
