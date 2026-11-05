import { createHash } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { packagedFunctionsPath, packagedReviewPath, packagedSlug } from './packagedPaths.js';

/**
 * A fonte das Cloud Functions que viaja no pacote — redeclarada do lado do Console pelo mesmo motivo de
 * `backendShape.ts`: ele é publicado sem o `src/`. `packagedSources.test.ts` confere a serialização e a
 * regra de caminho contra o kernel; separadas em silêncio, o hash que o build grava nunca conferiria
 * aqui, e toda extensão com fonte seria recusada como adulterada.
 */
export interface PackagedSource {
  files: Record<string, string>;
  hash: string;
}

const SEPARATOR = '\u0000';

export const canonicalSource = (files: Record<string, string>): string =>
  Object.keys(files)
    .sort()
    .map((path) => `${path}${SEPARATOR}${files[path]}`)
    .join(SEPARATOR);

export const hashSource = (files: Record<string, string>): string =>
  createHash('sha256').update(canonicalSource(files), 'utf8').digest('hex');

const TEST_FILE = /\.(test|spec)\.ts$/;

export const isSourcePath = (path: string): boolean => {
  if (path === '' || path.startsWith('/') || path.includes('\\')) return false;
  const segments = path.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) return false;
  if (segments.some((segment) => segment.startsWith('.') || segment === 'node_modules' || segment === '__tests__')) {
    return false;
  }
  const name = segments.at(-1) ?? '';
  if (TEST_FILE.test(name)) return false;
  return name.endsWith('.ts') || name.endsWith('.json');
};

/**
 * A fonte como ela está gravada no pacote instalado. Leniente na LEITURA — a forma é cobrada por
 * `sourceProblems` —, porque o que veio do banco é dado, e um dado torto tem de virar recusa explicada,
 * não exceção.
 */
export const packagedSourceOf = (pkg: unknown): PackagedSource | undefined => {
  const raw = (pkg as { backendSource?: unknown } | undefined)?.backendSource;
  if (typeof raw !== 'object' || raw === null) return undefined;
  const { files, hash } = raw as { files?: unknown; hash?: unknown };
  const entries = typeof files === 'object' && files !== null
    ? Object.entries(files as Record<string, unknown>)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    : [];
  return { files: Object.fromEntries(entries), hash: typeof hash === 'string' ? hash : '' };
};

/**
 * O que impede a fonte de ir ao disco. A conferência é feita AQUI, e não só na importação: o pacote
 * chega ao Console pelo banco, e quem tem `extensions.manage` grava o documento instalado diretamente.
 * O hash é recalculado sobre o conteúdo que vai ser gravado — é ele que se aprova.
 */
export const sourceProblems = (source: PackagedSource): string[] => {
  const problems: string[] = [];
  const bad = Object.keys(source.files).filter((path) => !isSourcePath(path));
  if (bad.length > 0) problems.push(`it names files that cannot be written: ${bad.join(', ')}`);
  if (source.files['index.ts'] === undefined) problems.push('it has no index.ts');
  if (hashSource(source.files) !== source.hash) {
    problems.push('its checksum does not match its content — it was changed after it was built');
  }
  return problems;
};

/** `--approve id@hash,id@hash`. O hash INTEIRO: aprovar por prefixo é aprovar o que não se leu. */
export const parseApprovals = (value: string | undefined): Map<string, string> => {
  const approvals = new Map<string, string>();
  for (const part of (value ?? '').split(',').map((item) => item.trim()).filter(Boolean)) {
    const at = part.lastIndexOf('@');
    if (at <= 0 || at === part.length - 1) {
      throw new Error(`--approve takes <extension id>@<sha-256>, and "${part}" is not that.`);
    }
    approvals.set(part.slice(0, at), part.slice(at + 1));
  }
  return approvals;
};

export const approvalFlag = (pluginId: string, hash: string): string => `--approve ${pluginId}@${hash}`;

/** Uma extensão cuja fonte veio no pacote, com o que o projeto já aprovou dela. */
export interface PackagedClaim {
  pluginId: string;
  name: string;
  version: string;
  functions: string[];
  source: PackagedSource;
  /** Os hashes aprovados em QUALQUER cópia instalada no projeto — a aprovação é do projeto. */
  approvedHashes: ReadonlySet<string>;
}

export type PackagedDecision =
  | { kind: 'provided' }
  | { kind: 'invalid'; problems: string[] }
  | { kind: 'held'; flagMismatch: boolean }
  | { kind: 'approved'; how: 'recorded' | 'flag' | 'prompt' };

/**
 * A decisão que não depende de perguntar a ninguém. `null` é "pergunte": só então a revisão humana
 * entra, e só para o que nenhuma outra resposta cobre.
 *
 * `provided` vem antes de tudo: se o pacote do kernel ou a instalação (`extensions/<pasta>/functions/`)
 * já exporta um nome que a extensão reivindica, a fonte local vale — é onde o autor desenvolve, e é o
 * caso da instalação que é a casa da fonte. As duas juntas seriam o mesmo nome exportado duas vezes,
 * que a montagem recusa.
 */
export const decideWithoutAsking = (
  claim: PackagedClaim,
  provided: ReadonlySet<string>,
  flags: ReadonlyMap<string, string>,
): PackagedDecision | null => {
  if (claim.functions.some((name) => provided.has(name))) return { kind: 'provided' };
  const problems = sourceProblems(claim.source);
  if (problems.length > 0) return { kind: 'invalid', problems };
  if (claim.approvedHashes.has(claim.source.hash)) return { kind: 'approved', how: 'recorded' };
  const flagged = flags.get(claim.pluginId);
  if (flagged === claim.source.hash) return { kind: 'approved', how: 'flag' };
  if (flagged !== undefined) return { kind: 'held', flagMismatch: true };
  return null;
};

/**
 * Grava a fonte no diretório da extensão, dentro de `.microteia/packaged-functions/`.
 *
 * Cada caminho é conferido DE NOVO contra o diretório de destino depois de resolvido. `sourceProblems`
 * já recusou `..` e caminho absoluto, mas é esta a linha que escreve no disco, e a regra dela não pode
 * depender de alguém lembrar de chamar a outra antes.
 */
export const writePackagedSource = async (
  root: string,
  claim: PackagedClaim,
  purpose: 'deploy' | 'review' = 'deploy',
): Promise<string> => {
  const base = purpose === 'deploy' ? packagedFunctionsPath(root) : packagedReviewPath(root);
  const target = join(base, packagedSlug(claim.pluginId));
  await rm(target, { recursive: true, force: true });
  for (const [path, content] of Object.entries(claim.source.files)) {
    const file = resolve(target, path);
    if (!file.startsWith(`${resolve(target)}${sep}`)) {
      throw new Error(`${claim.name}: refusing to write "${path}" outside its folder.`);
    }
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, content);
  }
  return target;
};

/** As duas pastas recomeçam a cada execução: o que vale é o que está instalado AGORA. */
export const clearPackagedSources = async (root: string): Promise<void> => {
  await rm(packagedFunctionsPath(root), { recursive: true, force: true });
  await rm(packagedReviewPath(root), { recursive: true, force: true });
};

/** As dependências npm que a fonte declara — o que a aprovação precisa mostrar além do código. */
export const declaredDependencies = (source: PackagedSource): Record<string, string> => {
  const manifest = source.files['package.json'];
  if (manifest === undefined) return {};
  try {
    const parsed = JSON.parse(manifest) as { dependencies?: Record<string, unknown> };
    return Object.fromEntries(
      Object.entries(parsed.dependencies ?? {})
        .filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    );
  } catch {
    return {};
  }
};
