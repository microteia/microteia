import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { flagValue, hasFlag } from '../shared/args.js';
import type { ParsedArgs } from '../shared/args.js';
import { CLI_VERSION, repoRoot } from '../shared/paths.js';
import { capture, captureOrThrow, run } from '../shared/run.js';
import { blank, bullets, heading, info, pending, step, success, warn } from '../shared/ui.js';
import { digestMismatch, digestOfFile } from '../shared/digest.js';
import {
  emptyIndex,
  entryOf,
  kernelTarballName,
  parseIndex,
  publishedBefore,
  serializeIndex,
  withEntry,
} from '../kernel/channel.js';
import type { ChannelIndex } from '../kernel/channel.js';
import type { KernelManifest } from '../kernel/manifest.js';
import { CONSOLE_CHANGELOG, KERNEL_CHANGELOG, changelogEntries, readChangelog } from './changelogs.js';
import { CONSOLE_PACKAGE_NAME } from './packageTemplates.js';
import { assertInsideRepository } from './repository.js';

/**
 * `microteia publish` — põe no ar o que o `pack` e o `pack-console` já produziram.
 *
 * Ele NÃO constrói. A separação é a mesma que existe entre `unpack` e `deploy` do outro lado, e pela
 * mesma razão: o `pack` é que roda o gate de qualidade, e um comando que constrói e publica no mesmo
 * gesto não tem momento para alguém olhar o que saiu. Publicar é o passo em que já não há como voltar
 * atrás — release é imutável —, então tudo o que pode recusar recusa antes de a primeira coisa subir.
 *
 * A ordem é ARTEFATOS primeiro, CATÁLOGO depois. Um índice que aponta para um arquivo que não subiu
 * quebra a instalação de todo mundo que pedir `latest`; um arquivo que subiu e que o índice ainda não
 * menciona não quebra nada — ninguém o encontra até a publicação terminar, e ela é retomável.
 */

/**
 * O repositório dos releases é SÓ de releases: nenhuma linha de fonte do kernel mora nele. Os artefatos
 * são compilados, mas o repositório que os hospeda é público, e a distância entre "público" e "fonte
 * pública" tem de ser estrutural, não uma configuração que alguém pode errar.
 */
const RELEASES_REPO = 'microteia/releases';

/** O caminho do catálogo DENTRO daquele repositório. É o que o GitHub Pages serve. */
const INDEX_PATH = 'kernel/index.json';

const tagOf = (version: string): string => `kernel-${version}`;

const assetUrl = (repo: string, version: string, name: string): string =>
  `https://github.com/${repo}/releases/download/${tagOf(version)}/${name}`;

const exists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const readJson = async <T>(path: string): Promise<T> =>
  JSON.parse(await readFile(path, 'utf8')) as T;

interface GitHubContents {
  content: string;
  sha: string;
}

/**
 * Lê o catálogo pela API de conteúdo, e não pela URL pública: o que interessa é o que está no
 * repositório AGORA, e o Pages serve de um cache que pode estar minutos atrás. Publicar contra a
 * versão em cache perderia a entrada de quem publicou antes.
 */
interface PublishedIndex {
  index: ChannelIndex;
  sha: string | null;
  /** Repositório sem commit nenhum: nem release nem tag podem existir ainda. */
  empty: boolean;
}

const readPublishedIndex = async (repo: string): Promise<PublishedIndex> => {
  const result = await capture('gh', ['api', `repos/${repo}/contents/${INDEX_PATH}`]);

  if (result.code !== 0) {
    const detail = `${result.stderr}${result.stdout}`;

    /**
     * Um 404 aqui tem DUAS causas, e elas pedem coisas opostas: o catálogo ainda não existe (primeira
     * publicação, segue em frente) ou o repositório não existe (erro de nome, pare). Distinguir por
     * texto não serve — a API responde "Not Found" quando falta o arquivo e "This repository is empty"
     * quando o repositório não tem commit nenhum, que é o caso de um repo recém-criado e é exatamente
     * quando a primeira publicação acontece.
     *
     * Então quem distingue é uma pergunta a mais, sobre o repositório em si. Ela custa uma chamada e
     * remove a ambiguidade inteira.
     */
    if (detail.includes('HTTP 404')) {
      const repository = await capture('gh', ['api', `repos/${repo}`]);
      if (repository.code !== 0) {
        throw new Error(
          `The repository ${repo} could not be read.\n${repository.stderr.trim() || repository.stdout.trim()}\n`
          + 'Check the name, and that "gh auth status" reports an account with access to it.',
        );
      }
      info(`  ${INDEX_PATH} does not exist in ${repo} yet — this is the first published version`);
      return { index: emptyIndex(), sha: null, empty: detail.includes('repository is empty') };
    }

    throw new Error(
      `Could not read ${INDEX_PATH} from ${repo}.\n${result.stderr.trim() || result.stdout.trim()}\n`
      + 'Is "gh" authenticated (gh auth status) and does the repository exist?',
    );
  }

  const contents = JSON.parse(result.stdout) as GitHubContents;
  const text = Buffer.from(contents.content, 'base64').toString('utf8');
  return { index: parseIndex(text, `${repo}/${INDEX_PATH}`), sha: contents.sha, empty: false };
};

/**
 * O que fica na raiz do repositório de releases, para quem chegar nele sem contexto.
 *
 * Ele é escrito UMA vez, ao semear — não é sobreposto depois. O que promete estar atual é o catálogo,
 * e é ele que a cada publicação é reescrito.
 */
const releasesReadme = (): string => `# Microteia — releases

Distribution artifacts for the Microteia platform. **No source lives here**: what travels is compiled.

- \`kernel/index.json\` — the catalog the Microteia Console reads. It lists every published version with
  its size and sha256, and the absolute URLs of the files that carry it.
- Each version is a release tagged \`kernel-<version>\`, carrying the package and its manifest.

Nobody downloads from here by hand:

    npm i -g @microteia/console
    microteia unpack --version latest

The Console reads the catalog, verifies what it downloads against the sha256 above, and only then puts
it in place.
`;

/**
 * Dá ao repositório o primeiro commit, porque sem ele não existe release.
 *
 * Um repositório de releases recém-criado está vazio, e o GitHub recusa criar release ou tag ali com
 * `422 Repository is empty` — depois de o pacote já ter sido conferido, que é o pior momento para
 * descobrir. Semear é uma escrita que este comando ia fazer de qualquer forma três passos adiante; ela
 * só passou a acontecer antes, e traz junto o README que o repositório precisa ter.
 */
const seedRepository = async (repo: string): Promise<void> => {
  pending(`${repo} has no commits yet — writing its README first`);
  const content = Buffer.from(releasesReadme(), 'utf8').toString('base64');
  await captureOrThrow('gh', [
    'api', '--method', 'PUT', `repos/${repo}/contents/README.md`,
    '-f', 'message=the releases repository',
    '-f', `content=${content}`,
  ]);
  success(`seeded ${repo}`);
};

const writePublishedIndex = async (
  repo: string,
  index: ChannelIndex,
  sha: string | null,
  version: string,
): Promise<void> => {
  const content = Buffer.from(serializeIndex(index), 'utf8').toString('base64');
  const args = [
    'api', '--method', 'PUT', `repos/${repo}/contents/${INDEX_PATH}`,
    '-f', `message=kernel ${version}`,
    '-f', `content=${content}`,
  ];
  if (sha !== null) args.push('-f', `sha=${sha}`);
  await captureOrThrow('gh', args);
};

/**
 * O `gh` é a única ferramenta que este comando exige, e a falta dele apareceria como `spawn gh ENOENT`
 * — que não diz o que instalar nem por quê. Mesma postura do `connect` com o `firebase`.
 */
const assertGitHubCli = async (): Promise<void> => {
  const result = await capture('gh', ['--version']).catch(() => null);
  if (result === null || result.code !== 0) {
    throw new Error(
      'Publishing the kernel needs the GitHub CLI ("gh"), and it is not available here.\n'
      + '  brew install gh && gh auth login\n'
      + 'The Console does not need it: "microteia publish --console-only" goes to npm.',
    );
  }
};

const releaseExists = async (repo: string, version: string): Promise<boolean> => {
  const result = await capture('gh', ['release', 'view', tagOf(version), '--repo', repo]);
  return result.code === 0;
};

/**
 * O pacote do kernel, conferido antes de qualquer coisa subir.
 *
 * O `sha256` é RECALCULADO do arquivo em vez de aceito do manifesto ao lado dele. Os dois foram escritos
 * pelo mesmo `pack`, então em teoria concordam — e é justamente por isso que a conferência é barata: ela
 * pega o caso em que alguém reconstruiu um dos dois e não o outro, que é o único jeito de um pacote
 * publicado divergir do hash que o descreve.
 */
const readKernelPackage = async (
  root: string,
  version: string,
): Promise<{ manifest: KernelManifest; tarball: string; changelog: string }> => {
  const directory = join(root, 'distributions', 'kernel', version);
  const tarball = join(directory, kernelTarballName(version));
  const manifestPath = join(directory, 'manifest.json');

  for (const path of [tarball, manifestPath]) {
    if (!await exists(path)) {
      throw new Error(
        `${path} does not exist, and publishing does not build.\nRun "npm run pack:kernel" first.`,
      );
    }
  }

  const manifest = await readJson<KernelManifest>(manifestPath);
  if (manifest.version !== version) {
    throw new Error(
      `${manifestPath} describes ${manifest.version} and sits in the folder of ${version}.`,
    );
  }
  if (manifest.tarball === undefined) {
    throw new Error(
      `${manifestPath} carries no tarball digest, so what is published could not be verified after download.\n`
      + 'Rebuild the package with "npm run pack:kernel".',
    );
  }

  const problem = digestMismatch(manifest.tarball, await digestOfFile(tarball));
  if (problem !== null) {
    throw new Error(
      `${tarball} does not match the manifest beside it: ${problem}\n`
      + 'One of the two was rebuilt without the other. Run "npm run pack:kernel" again.',
    );
  }

  const changelog = await readChangelog(root, KERNEL_CHANGELOG, version);
  return { manifest, tarball, changelog };
};

const publishKernel = async (
  root: string,
  version: string,
  repo: string,
  dryRun: boolean,
): Promise<void> => {
  await assertGitHubCli();
  const { manifest, tarball, changelog } = await readKernelPackage(root, version);
  const directory = join(root, 'distributions', 'kernel', version);
  const manifestPath = join(directory, 'manifest.json');

  const published = await readPublishedIndex(repo);

  /**
   * O corpo do release cobre o INTERVALO, e não só a versão que está saindo. Um pacote leva tudo o que
   * veio antes dele; um release que só cita a própria entrada esconde as versões que foram empacotadas e
   * não publicadas, e nenhum release posterior volta para contá-las.
   */
  const since = publishedBefore(published.index, version);
  const notes = changelogEntries(changelog, version, since);

  const next = withEntry(published.index, entryOf(manifest, {
    tarball: assetUrl(repo, version, kernelTarballName(version)),
    manifest: assetUrl(repo, version, 'manifest.json'),
  }, new Date().toISOString()));

  success(`kernel ${version} verified: ${manifest.tarball?.bytes} bytes, sha256 ${manifest.tarball?.sha256.slice(0, 12)}…`);
  info(`  tag ${tagOf(version)} in ${repo}, and ${INDEX_PATH} promoting it to "latest"`);
  info(
    notes.versions.length === 1
      ? `  release notes: the ${version} entry of ${KERNEL_CHANGELOG}`
      : `  release notes: ${notes.versions.join(', ')} — every entry since ${since ?? 'the first one'}`,
  );

  if (dryRun) {
    if (published.empty) info(`  ${repo} has no commits, so it would be seeded with a README first`);
    info(`  the catalog would go from ${published.index.kernel.length} to ${next.kernel.length} version(s)`);
    return;
  }

  if (published.empty) await seedRepository(repo);

  const notesRoot = await mkdtemp(join(tmpdir(), 'microteia-publish-'));
  const notesFile = join(notesRoot, 'notes.md');
  await writeFile(notesFile, notes.body);

  try {
    if (await releaseExists(repo, version)) {
      /**
       * O release existe e o catálogo não o menciona: é uma publicação interrompida entre os dois
       * passos. Retomar é subir os arquivos por cima e escrever o índice — e não recusar, porque
       * recusar deixaria a única saída sendo apagar o release à mão.
       */
      warn(`${tagOf(version)} already exists in ${repo}, and the catalog does not list it`);
      info('  completing the interrupted publish: re-uploading the assets and writing the catalog');
      await run('gh', [
        'release', 'upload', tagOf(version), tarball, manifestPath,
        '--repo', repo, '--clobber',
      ]);
    } else {
      pending(`creating ${tagOf(version)} in ${repo}`);
      await run('gh', [
        'release', 'create', tagOf(version), tarball, manifestPath,
        '--repo', repo,
        '--title', `Microteia kernel ${version}`,
        '--notes-file', notesFile,
      ]);
    }

    success(`assets published for ${version}`);

    // O catálogo por último, sempre. Ver a nota de ordem no topo deste módulo.
    await writePublishedIndex(repo, next, published.sha, version);
    success(`${INDEX_PATH} updated — "microteia unpack --version latest" now takes ${version}`);
  } finally {
    await rm(notesRoot, { recursive: true, force: true });
  }
};

const publishedConsoleVersion = async (version: string): Promise<boolean> => {
  const result = await capture('npm', ['view', `${CONSOLE_PACKAGE_NAME}@${version}`, 'version']);
  return result.code === 0 && result.stdout.trim() !== '';
};

/**
 * O npm exige 2FA para publicar, e o código não pode ser adivinhado nem guardado — então ele ATRAVESSA
 * o comando. Sem esta passagem, `microteia publish` era inutilizável sob a configuração padrão de uma
 * conta npm: ele chamava `npm publish`, o registry respondia 403, e a única saída era rodar o `npm` à
 * mão — o que pularia a conferência de histórico que este comando existe para fazer.
 *
 * A alternativa sem interação é um granular access token com "bypass 2FA", que é o caminho de CI. Os
 * dois estão na recusa, porque quem esbarra nela não é obrigado a saber que existem.
 */
const publishConsole = async (root: string, dryRun: boolean, otp?: string): Promise<void> => {
  const directory = join(root, 'distributions', 'console', CLI_VERSION);

  for (const relative of ['package.json', 'lib/index.js', CONSOLE_CHANGELOG]) {
    if (!await exists(join(directory, relative))) {
      throw new Error(
        `${join(directory, relative)} does not exist, and publishing does not build.\n`
        + 'Run "npm run pack:console" first.',
      );
    }
  }

  // O histórico é conferido aqui de novo, e não só no `pack-console`: as duas pastas de `distributions/`
  // sobrevivem entre versões, e publicar a de ontem é possível.
  await readChangelog(directory, CONSOLE_CHANGELOG, CLI_VERSION);

  if (await publishedConsoleVersion(CLI_VERSION)) {
    info(`${CONSOLE_PACKAGE_NAME}@${CLI_VERSION} is already on the registry — nothing to publish`);
    return;
  }

  success(`Console ${CLI_VERSION} ready to publish from ${directory}`);

  if (dryRun) {
    info(`  it would run "npm publish" as ${CONSOLE_PACKAGE_NAME}@${CLI_VERSION}`);
    return;
  }

  pending(`publishing ${CONSOLE_PACKAGE_NAME}@${CLI_VERSION}`);
  const args = otp === undefined ? ['publish'] : ['publish', `--otp=${otp}`];

  /**
   * A saída do `npm` vai direto para o terminal — é `run`, e não `capture`, porque o publish pode
   * PERGUNTAR o código de dois fatores, e uma pergunta capturada é um comando travado. O preço é que o
   * motivo da falha não chega aqui como texto: a primeira versão disto procurava "2fa" na mensagem do
   * erro, e a mensagem do erro é só "Command failed (exit 1): npm publish". A ajuda que ela produzia
   * nunca apareceu uma vez.
   *
   * Então a nota é impressa em TODA falha, e ela não afirma a causa: diz o que o registry exige, que é
   * de longe o motivo mais comum de um publish recusado, e deixa o erro do npm — que está logo acima,
   * na tela — dizer o resto.
   */
  await run('npm', args, { cwd: directory }).catch((error: unknown) => {
    blank();
    info('npm refused the publish. Publishing to the registry needs ONE of these, and the error above');
    info('says which is missing:');
    bullets([
      'two-factor authentication enabled on the account, and "microteia publish --otp <code>"',
      'a granular access token with "bypass 2FA", scoped to @microteia with read and write',
    ]);
    info('A plain token from "npm login" is not accepted for publishing.');
    throw error;
  });
  success(`${CONSOLE_PACKAGE_NAME}@${CLI_VERSION} published — "npm i -g ${CONSOLE_PACKAGE_NAME}" takes it`);
};

export const publish = async (args: ParsedArgs): Promise<void> => {
  await assertInsideRepository('publish');
  const root = repoRoot;
  const dryRun = hasFlag(args, 'dry-run');
  const repo = flagValue(args, 'repo') ?? RELEASES_REPO;

  const otp = flagValue(args, 'otp');
  const kernelOnly = hasFlag(args, 'kernel-only');
  const consoleOnly = hasFlag(args, 'console-only');
  if (kernelOnly && consoleOnly) {
    throw new Error('--kernel-only and --console-only cannot both be given.');
  }

  const pkg = await readJson<{ version: string }>(join(root, 'package.json'));

  const what = consoleOnly
    ? `Console ${CLI_VERSION}`
    : kernelOnly
      ? `kernel ${pkg.version}`
      : `kernel ${pkg.version} and Console ${CLI_VERSION}`;

  heading(dryRun ? `Publishing ${what} — dry run, nothing is written` : `Publishing ${what}`);

  const total = consoleOnly || kernelOnly ? 1 : 2;
  let index = 0;

  if (!consoleOnly) {
    index += 1;
    step(index, total, `Kernel ${pkg.version} to ${repo}`);
    await publishKernel(root, pkg.version, repo, dryRun);
  }

  if (!kernelOnly) {
    index += 1;
    step(index, total, `Console ${CLI_VERSION} to npm`);
    await publishConsole(root, dryRun, otp);
  }

  blank();
  if (dryRun) {
    info('Nothing was published. Run it again without --dry-run.');
  } else {
    info('Published. An office takes it with:');
    bullets([
      `npm i -g ${CONSOLE_PACKAGE_NAME}`,
      'microteia unpack --version latest',
      'microteia deploy',
    ]);
  }
  blank();
};
