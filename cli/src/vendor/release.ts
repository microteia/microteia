import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { hasFlag } from '../shared/args.js';
import type { ParsedArgs } from '../shared/args.js';
import { repoRoot } from '../shared/paths.js';
import { capture, captureOrThrow } from '../shared/run.js';
import { blank, bullets, heading, info, success, warn } from '../shared/ui.js';
import { CONSOLE_CHANGELOG, KERNEL_CHANGELOG } from './changelogs.js';
import { assertInsideRepository } from './repository.js';

/**
 * A versão é decidida no RELEASE, não no commit.
 *
 * Enquanto cada commit subia a `version` e escrevia o topo de três arquivos, dois desenvolvedores em
 * paralelo brigavam sempre pelas mesmas linhas e pelo mesmo número — e a entrada técnica repetia o que a
 * mensagem do commit já dizia. Agora o commit carrega só a mensagem (Conventional Commits, em inglês), e
 * este comando junta as mensagens desde a última versão, decide o salto e escreve UMA entrada por artefato.
 */

/**
 * Os tipos aceitos no título do commit. O CI confere o título do pull request contra a MESMA lista
 * (`.github/workflows/ci.yml`), e `release.test.ts` exige que as duas pontas batam.
 */
export const COMMIT_TYPES = [
  'feat', 'fix', 'perf', 'refactor', 'docs', 'test', 'build', 'ci', 'chore', 'style', 'revert',
] as const;

export type CommitType = (typeof COMMIT_TYPES)[number];
export type Bump = 'major' | 'minor' | 'patch';

const RELEASING: Partial<Record<CommitType, Bump>> = { feat: 'minor', fix: 'patch', perf: 'patch' };

export interface ConventionalCommit {
  type: CommitType;
  scope?: string;
  breaking: boolean;
  /** O texto do rodapé `BREAKING CHANGE:`, quando é por ele — e não pelo `!` — que a quebra é dita. */
  breakingNote?: string;
  subject: string;
}

const HEADER = /^([a-z]+)(?:\(([^)]+)\))?(!)?: (\S.*)$/;
const BREAKING_FOOTER = /^BREAKING[ -]CHANGE: (.+)$/m;

export const parseCommit = (subject: string, body = ''): ConventionalCommit | null => {
  const match = HEADER.exec(subject.trim());
  if (match === null) return null;
  const type = match[1] as CommitType;
  if (!COMMIT_TYPES.includes(type)) return null;
  const footer = BREAKING_FOOTER.exec(body);
  return {
    type,
    scope: match[2],
    breaking: match[3] === '!' || footer !== null,
    breakingNote: footer?.[1].trim(),
    subject: subject.trim(),
  };
};

export const bumpOf = (commit: ConventionalCommit): Bump | null =>
  commit.breaking ? 'major' : RELEASING[commit.type] ?? null;

const RANK: Record<Bump, number> = { patch: 1, minor: 2, major: 3 };

export const highestBump = (bumps: (Bump | null)[]): Bump | null =>
  bumps.reduce<Bump | null>((top, bump) => (bump !== null && (top === null || RANK[bump] > RANK[top]) ? bump : top), null);

export const nextVersion = (version: string, bump: Bump): string => {
  const [major, minor, patch] = version.split('.').map(Number);
  if (bump === 'major') return `${major + 1}.0.0`;
  if (bump === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
};

/**
 * De qual artefato é o commit sai dos caminhos que ele toca, e não do escopo do título: o escopo é
 * escolhido por quem escreve, o caminho não esquece. `cli/` é o Console; o resto é o kernel — menos o
 * que não viaja em pacote nenhum (documentos da raiz, configuração do GitHub e do agente). Um commit que
 * toca os dois lados entra nos dois históricos.
 */
const NOT_SHIPPED = [/^[^/]+\.md$/, /^\.github\//, /^\.claude\//, /^\.vscode\//];

export type Artifact = 'kernel' | 'console';

export const artifactsOf = (paths: string[]): Set<Artifact> => {
  const artifacts = new Set<Artifact>();
  for (const path of paths) {
    if (path.startsWith('cli/')) artifacts.add('console');
    else if (!NOT_SHIPPED.some((pattern) => pattern.test(path))) artifacts.add('kernel');
  }
  return artifacts;
};

export interface GitCommit {
  hash: string;
  subject: string;
  body: string;
  paths: string[];
}

export interface ReleasePlan {
  artifact: Artifact;
  from: string;
  to: string;
  bump: Bump;
  /** Os commits que entram na entrada, do mais antigo para o mais recente. */
  commits: (ConventionalCommit & { hash: string })[];
}

/**
 * O que um artefato tem a lançar. `null` quando nada desde a última versão muda o que ele entrega —
 * `docs`, `test`, `chore` e companhia não sobem número nenhum.
 */
export const planRelease = (artifact: Artifact, version: string, commits: GitCommit[]): ReleasePlan | null => {
  const releasing = commits
    .filter((commit) => artifactsOf(commit.paths).has(artifact))
    .map((commit) => {
      const parsed = parseCommit(commit.subject, commit.body);
      return parsed === null ? null : { ...parsed, hash: commit.hash };
    })
    .filter((commit): commit is ConventionalCommit & { hash: string } => commit !== null && bumpOf(commit) !== null);

  const bump = highestBump(releasing.map(bumpOf));
  if (bump === null) return null;
  return { artifact, from: version, to: nextVersion(version, bump), bump, commits: releasing };
};

/** Quebras primeiro, depois funcionalidades, depois correções — cada grupo na ordem em que aconteceu. */
const groupOf = (commit: ConventionalCommit): number => (commit.breaking ? 0 : commit.type === 'feat' ? 1 : 2);

export const releaseEntry = (plan: ReleasePlan, date: string): string => {
  const lines = [...plan.commits]
    .sort((a, b) => groupOf(a) - groupOf(b))
    .map((commit) => `- ${commit.subject}${commit.breakingNote ? ` — BREAKING CHANGE: ${commit.breakingNote}` : ''}`);
  return `#### [${plan.to}] — ${date}\n\n${lines.join('\n')}\n\n`;
};

/**
 * A entrada nova entra acima da mais recente — e, portanto, abaixo do cabeçalho e do comentário do
 * topo, que não são entradas. Num arquivo ainda sem entrada nenhuma, ela vai para o fim.
 */
export const withEntry = (contents: string, entry: string): string => {
  const withoutComments = contents.replace(/<!--[\s\S]*?-->/g, (comment) => ' '.repeat(comment.length));
  const first = /^#### \[/m.exec(withoutComments);
  if (first === null) return `${contents.trimEnd()}\n\n${entry}`;
  return `${contents.slice(0, first.index)}${entry}${contents.slice(first.index)}`;
};

const CLI_VERSION_LINE = /^export const CLI_VERSION = '(\d+\.\d+\.\d+)';$/m;
const PACKAGE_VERSION_LINE = /^(\s*"version":\s*")(\d+\.\d+\.\d+)(")/m;

export const withCliVersion = (source: string, version: string): string => {
  if (!CLI_VERSION_LINE.test(source)) throw new Error('cli/src/shared/paths.ts no longer declares CLI_VERSION on one line.');
  return source.replace(CLI_VERSION_LINE, `export const CLI_VERSION = '${version}';`);
};

/** Só a primeira `version` — a do produto; a de uma dependência não está no topo do arquivo. */
export const withPackageVersion = (source: string, version: string): string => {
  if (!PACKAGE_VERSION_LINE.test(source)) throw new Error('package.json has no "version".');
  return source.replace(PACKAGE_VERSION_LINE, `$1${version}$3`);
};

interface VersionSource {
  file: string;
  /** Regex POSIX para o `git log -G`: o commit que mudou ESTA linha é o da última versão. */
  pickaxe: string;
  read: (source: string) => string;
  write: (source: string, version: string) => string;
  changelog: string;
}

const SOURCES: Record<Artifact, VersionSource> = {
  kernel: {
    file: 'package.json',
    pickaxe: '^[[:space:]]*"version":',
    read: (source) => (JSON.parse(source) as { version: string }).version,
    write: withPackageVersion,
    changelog: KERNEL_CHANGELOG,
  },
  console: {
    file: 'cli/src/shared/paths.ts',
    pickaxe: 'export const CLI_VERSION',
    read: (source) => {
      const match = CLI_VERSION_LINE.exec(source);
      if (match === null) throw new Error('cli/src/shared/paths.ts no longer declares CLI_VERSION on one line.');
      return match[1];
    },
    write: withCliVersion,
    changelog: join('cli', CONSOLE_CHANGELOG),
  },
};

const RECORD = '\x1e';
const FIELD = '\x1f';

export const parseGitLog = (output: string): GitCommit[] =>
  output
    .split(RECORD)
    .filter((record) => record.trim() !== '')
    .map((record) => {
      const [hash, subject, body, files = ''] = record.split(FIELD);
      return {
        hash: hash.trim(),
        subject: subject.trim(),
        body: body.trim(),
        paths: files.split('\n').map((line) => line.trim()).filter(Boolean),
      };
    });

/**
 * A base é o último commit que mudou o NÚMERO, e não a última tag. Num clone que não baixou as tags a
 * conta pela tag começaria versões atrás e lançaria de novo o que já subiu; e a tag marca o que foi
 * PUBLICADO, que é outra coisa — o `git log kernel-<boa>..kernel-<ruim>` de uma regressão depende disso.
 * Foi também o que fez a transição não precisar de caso especial: a 9.299.0, última numerada à mão, já é
 * a base.
 */
const baselineOf = async (root: string, source: VersionSource): Promise<string> => {
  const hash = (await captureOrThrow('git', ['log', '-1', '--format=%H', '-G', source.pickaxe, '--', source.file], { cwd: root })).trim();
  if (hash === '') throw new Error(`No commit ever set the version in ${source.file}, so there is no baseline to release from.`);
  return hash;
};

const commitsSince = async (root: string, baseline: string): Promise<GitCommit[]> => {
  const output = await captureOrThrow(
    'git',
    ['log', `${baseline}..HEAD`, '--no-merges', '--reverse', '--name-only', `--format=${RECORD}%H${FIELD}%s${FIELD}%b${FIELD}`],
    { cwd: root },
  );
  return parseGitLog(output);
};

const planFor = async (root: string, artifact: Artifact): Promise<ReleasePlan | null> => {
  const source = SOURCES[artifact];
  const version = source.read(await readFile(join(root, source.file), 'utf8'));
  return planRelease(artifact, version, await commitsSince(root, await baselineOf(root, source)));
};

/**
 * A trava do `pack` e do `pack-console`: um commit que lança algo depois da base significa que o pacote
 * levaria código sob um número que não o descreve. Fora de um checkout git não há o que conferir.
 */
export const assertReleased = async (root: string, artifact: Artifact): Promise<void> => {
  const head = await capture('git', ['rev-parse', 'HEAD'], { cwd: root }).catch(() => null);
  if (head === null || head.code !== 0) return;
  const plan = await planFor(root, artifact);
  if (plan === null) return;
  throw new Error(
    `${plan.commits.length} commit(s) since ${artifact} ${plan.from} change what it ships, and no version describes them yet.\n`
    + `Run "npm run release" first — it would make this ${plan.to}.`,
  );
};

const today = (): string => {
  const now = new Date();
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

const LABEL: Record<Artifact, string> = { kernel: 'Kernel', console: 'Console' };

export const release = async (args: ParsedArgs): Promise<void> => {
  await assertInsideRepository('release');
  const root = repoRoot;
  const dryRun = hasFlag(args, 'dry-run');

  heading(dryRun ? 'Release plan (dry run)' : 'Release');

  const plans = (await Promise.all((['kernel', 'console'] as const).map((artifact) => planFor(root, artifact))))
    .filter((plan): plan is ReleasePlan => plan !== null);

  if (plans.length === 0) {
    info('Nothing to release: no feat, fix, perf or breaking commit since the last version of either artifact.');
    return;
  }

  /**
   * O release escreve em arquivos que alguém pode estar editando. Uma alteração pendente neles entraria
   * no commit de release sem ninguém ter pedido — então recusa antes de escrever qualquer coisa.
   */
  if (!dryRun) {
    const files = plans.flatMap((plan) => [SOURCES[plan.artifact].file, SOURCES[plan.artifact].changelog]);
    const pending = (await captureOrThrow('git', ['status', '--porcelain', '--', ...files], { cwd: root })).trim();
    if (pending !== '') {
      throw new Error(`These files have uncommitted changes, and the release commit would carry them:\n${pending}`);
    }
  }

  const date = today();
  const touched: string[] = [];

  for (const plan of plans) {
    const source = SOURCES[plan.artifact];
    const entry = releaseEntry(plan, date);
    blank();
    info(`${LABEL[plan.artifact]} ${plan.from} → ${plan.to} (${plan.bump}, ${plan.commits.length} commit(s))`);
    bullets(entry.trim().split('\n').slice(2).map((line) => line.replace(/^- /, '')));

    if (dryRun) continue;

    const versionFile = join(root, source.file);
    const changelogFile = join(root, source.changelog);
    await writeFile(versionFile, source.write(await readFile(versionFile, 'utf8'), plan.to));
    await writeFile(changelogFile, withEntry(await readFile(changelogFile, 'utf8'), entry));
    touched.push(source.file, source.changelog);
  }

  if (dryRun) return;

  /**
   * Só os arquivos do release entram no commit — `git commit -- <caminhos>` ignora o que mais estiver
   * no índice ou na árvore. Há outras pessoas (e outras sessões) mexendo no mesmo checkout, e o commit
   * de release não pode levar o trabalho de ninguém.
   */
  const summary = plans.map((plan) => `${plan.artifact} ${plan.to}`).join(', ');
  await captureOrThrow('git', ['commit', '-m', `chore(release): ${summary}`, '--', ...touched], { cwd: root });

  blank();
  success(`Committed chore(release): ${summary}`);
  warn('Next: push, then "npm run pack:kernel" / "npm run pack:console" and "npm run publish:packages".');
};
