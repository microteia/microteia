import { cp, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';
import { flagValue, hasFlag } from '../shared/args.js';
import type { ParsedArgs } from '../shared/args.js';
import { repoRoot } from '../shared/paths.js';
import { run } from '../shared/run.js';
import { blank, bullets, heading, info, step, success, warn } from '../shared/ui.js';
import {
  DEFAULT_FUNCTIONS_REGION,
  KERNEL_COMPONENTS,
  KERNEL_DISTRIBUTION_ID,
  MANUAL_PREREQUISITES,
  MINIMUM_CLI_VERSION,
  REQUIRED_NODE_VERSION,
  callableFunctionNames,
  declaredParametersIn,
  exportedFunctionNames,
  parseKernelVersion,
  parsePreLoginPoints,
} from '../kernel/manifest.js';
import type { BackendParameter, KernelManifest, KernelSdk } from '../kernel/manifest.js';
import { digestOfFile } from '../shared/digest.js';
import { kernelTarballName } from '../kernel/channel.js';
import {
  baselineFunctionsOf,
  baselineIndexesOf,
  claimProblems,
  claimsFromTemplates,
} from '../kernel/backendShape.js';
import type { BackendClaim, FirestoreIndexSpec } from '../kernel/backendShape.js';
import { declarationsWithComments, environmentSecrets, findBundleLeaks } from './bundleAudit.js';
import { KERNEL_CHANGELOG, readChangelog } from './changelogs.js';
import { assertInsideRepository } from './repository.js';
import { SDK_TARBALL } from './pluginWorkspaceTemplates.js';
import { stageExamples } from './exampleSources.js';
import { firstPartyTemplates } from './firstPartyTemplates.js';
import {
  packageCustomIndexTs,
  packageCustomTsconfig,
  packageFirebaseJson,
  packageFunctionsIndexJs,
  packageFunctionsPackageJson,
} from './packageTemplates.js';
import type { HostingConfig, RepoFunctionsPackage } from './packageTemplates.js';

/**
 * `dist` é um modo do Vite para o qual NÃO existe `.env.dist`. É isso que garante um bundle sem
 * projeto embutido: o repositório não tem `.env` de raiz servindo de fallback, então nada é inlinado.
 */
const DISTRIBUTION_TARGET = 'dist';

interface RootIndexesFile {
  indexes: FirestoreIndexSpec[];
  fieldOverrides?: unknown[];
}

/**
 * As exigências de backend das extensões de PRIMEIRA PARTE saem dos `extension-templates/*.json`, que
 * são gerados dos `.ts` e conferidos pelo `verify-extensions` que o gate de qualidade acima já roda.
 * Ler o `.json` gerado em vez do `.ts` evita carregar o Vite aqui só para avaliar um módulo.
 *
 * Os exemplos que só viajam para ser lidos ficam de FORA (`READING_ONLY_EXAMPLES`), e o motivo está
 * escrito lá: o backend de um exemplo não é deste repositório. Cobrá-lo aqui faria o exemplo que
 * ensina Cloud Functions abortar toda publicação — e, se a function existisse, a reivindicação a
 * tiraria da baseline do kernel, que é o oposto exato do que um exemplo deve provocar.
 */
const firstPartyClaims = (root: string): BackendClaim[] =>
  claimsFromTemplates(firstPartyTemplates<{ manifest?: Record<string, unknown> }>(root));

interface RepoFirebaseJson {
  hosting?: HostingConfig;
}

const readJson = async <T>(path: string): Promise<T> =>
  JSON.parse(await readFile(path, 'utf8')) as T;

interface BackendScan {
  parameters: BackendParameter[];
  callables: string[];
}

/**
 * Os `defineString` e as callables estão espalhados pelos handlers, não num arquivo só — então a
 * varredura é a árvore inteira de `functions/src`, uma vez, para os dois. Derivar daqui é o que faz
 * um parâmetro novo (ou uma callable nova) aparecer sozinho no manifesto, em vez de depender de
 * alguém lembrar de atualizar um template.
 */
const scanBackendSources = async (directory: string): Promise<BackendScan> => {
  const parameters = new Map<string, BackendParameter>();
  const callables = new Set<string>();

  const walk = async (current: string): Promise<void> => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(path);
      } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
        const source = await readFile(path, 'utf8');

        for (const parameter of declaredParametersIn(source)) {
          const previous = parameters.get(parameter.name);
          // Declarado em dois lugares com defaults diferentes: vale o mais exigente.
          if (previous === undefined || parameter.required) parameters.set(parameter.name, parameter);
        }

        for (const name of callableFunctionNames(source)) callables.add(name);
      }
    }
  };

  await walk(directory);

  return {
    parameters: [...parameters.values()].sort((left, right) => left.name.localeCompare(right.name)),
    callables: [...callables].sort((left, right) => left.localeCompare(right)),
  };
};

/**
 * Põe o SDK de autoria no pacote: o compilado, os tipos da API curada, e as extensões de primeira
 * parte como exemplo.
 *
 * O tarball vai com nome FIXO (`microteia-sdk.tgz`, sem versão) porque o `extensions/package.json` do
 * escritório aponta para ele por caminho: com a versão no nome, todo upgrade exigiria editar aquele
 * arquivo à mão, e quem esquecesse continuaria compilando contra o SDK antigo em silêncio.
 *
 * As três conferências do fim são do ARTEFATO, não do procedimento — mesma postura do `bundleAudit`:
 * o que sai daqui é `.d.ts` da superfície curada, e um comentário esquecido nele levaria para todo
 * escritório a narrativa interna de uma decisão nossa.
 */
const stageSdk = async (root: string, stageDir: string, version: string): Promise<KernelSdk> => {
  const sourceDir = join(root, 'sdk');
  const targetDir = join(stageDir, 'sdk');

  const manifest = await readJson<{ version: string; microteia?: { kernelVersion?: string } }>(
    join(sourceDir, 'package.json'),
  );
  const kernelVersion = manifest.microteia?.kernelVersion;
  if (manifest.version !== version || kernelVersion === undefined) {
    throw new Error('sdk/package.json is stale — "npm run verify" should have rebuilt it.');
  }

  await mkdir(targetDir, { recursive: true });
  await run('npm', ['pack', '--silent', '--pack-destination', targetDir], { cwd: sourceDir });

  const packed = (await readdir(targetDir)).filter((file) => file.endsWith('.tgz'));
  if (packed.length !== 1) {
    throw new Error(`Expected exactly one SDK tarball, found ${packed.length}.`);
  }
  await rename(join(targetDir, packed[0]), join(targetDir, SDK_TARBALL));

  await cp(join(sourceDir, 'types'), join(targetDir, 'types'), { recursive: true });

  // O `.d.ts` da superfície curada sai SEM comentário: o JSDoc deste repositório é em português e
  // narra decisões e incidentes internos. O que o autor lê é `types/` e o `AUTHORING.md`, escritos
  // para ele — e por isso `types/` fica de fora desta conferência, de propósito.
  const documented = await declarationsWithComments(join(sourceDir, 'lib'));
  if (documented.length > 0) {
    throw new Error(
      'Declarations in the SDK carry comments, which would ship internal notes to every office:\n'
      + documented.map((file) => `  ${relative(sourceDir, file)}`).join('\n')
      + '\n"removeComments" must stay on in tsconfig.sdk.json.',
    );
  }

  // As extensões de primeira parte como material de autoria, em FONTE e uma pasta por extensão. O
  // `.json` é o artefato e não ensina como se chega nele; a fonte ensina, e já viajava de qualquer
  // forma — o código das views está dentro do `.json`, em string. `exampleSources.test.ts` compila cada
  // uma e exige o `.json` versionado byte a byte.
  const examples = await stageExamples(root, join(targetDir, 'examples'));

  info(`  ${examples.length} first-party extension(s) staged as source examples`);

  return { version, kernelVersion, path: `sdk/${SDK_TARBALL}` };
};

export const pack = async (args: ParsedArgs): Promise<void> => {
  await assertInsideRepository('pack');
  const root = repoRoot;
  const skipVerify = hasFlag(args, 'skip-verify');

  const pkg = await readJson<{ version: string }>(join(root, 'package.json'));
  const version = pkg.version;

  /**
   * O histórico técnico é conferido AQUI, antes de qualquer build. Uma entrada que falta é um minuto de
   * conserto; descobri-la depois do `verify` e dos três builds custa dez, e é assim que a conferência
   * passa a ser contornada com `--skip-verify`.
   */
  const changelog = await readChangelog(root, KERNEL_CHANGELOG, version);
  const kernelVersion = parseKernelVersion(
    await readFile(join(root, 'src/domain/schema/plugin/kernelVersion.ts'), 'utf8'),
  );
  const preLoginPoints = parsePreLoginPoints(
    await readFile(join(root, 'src/domain/schema/plugin/preLoginPoints.ts'), 'utf8'),
  );
  const functionNames = exportedFunctionNames(
    await readFile(join(root, 'functions/src/index.ts'), 'utf8'),
  );
  const scan = await scanBackendSources(join(root, 'functions/src'));
  const backendParameters = scan.parameters;
  // Uma callable que não está exportada no `index.ts` não é deployada, e verificá-la acusaria uma
  // ausência que é só do parser.
  const callables = scan.callables.filter((name) => functionNames.includes(name));

  const rootIndexes = await readJson<RootIndexesFile>(join(root, 'firestore.indexes.json'));
  const claims = firstPartyClaims(root);
  const problems = claimProblems(claims, functionNames, rootIndexes.indexes);
  if (problems.length > 0) {
    throw new Error(
      'An extension declares backend artifacts that do not add up, so the package would be wrong:\n'
      + problems.map((problem) => `  ${problem}`).join('\n'),
    );
  }
  const baselineFunctions = baselineFunctionsOf(functionNames, claims);
  const baselineIndexes = baselineIndexesOf(rootIndexes.indexes, claims);

  const defaultOutputDir = join(root, 'distributions', 'kernel', version);
  const outputDir = flagValue(args, 'output') ?? defaultOutputDir;
  const stageDir = join(outputDir, 'package');
  const tarball = join(outputDir, kernelTarballName(version));

  heading(`Packaging Microteia kernel ${version} (contract ${kernelVersion})`);

  const total = 7;

  if (skipVerify) {
    info('Quality gate skipped (--skip-verify).');
  } else {
    step(1, total, 'Quality gate');
    await run('npm', ['run', 'verify'], { cwd: root });
  }

  step(2, total, `Building the portable frontend (TARGET=${DISTRIBUTION_TARGET})`);
  await run('npm', ['run', 'build'], { cwd: root, env: { TARGET: DISTRIBUTION_TARGET } });

  step(3, total, 'Compiling the Cloud Functions');
  await run('npm', ['run', 'build:functions'], { cwd: root });

  // Depois do `verify`, que já compilou o SDK — mas o `--skip-verify` existe, e um pacote sem SDK
  // seria descoberto só no `plugin-init` de um escritório.
  step(4, total, 'Building the authoring SDK');
  await run('npm', ['run', 'build:host-types'], { cwd: root });
  await run('npm', ['run', 'build:sdk'], { cwd: root });

  step(5, total, 'Checking that the bundle carries no Firebase project');
  const leaks = await findBundleLeaks(join(root, 'dist'), await environmentSecrets(root));
  if (leaks.length > 0) {
    throw new Error(
      'The built frontend contains Firebase credentials, so it is not distributable.\n'
      + leaks.map((leak) => `  ${leak.file}: ${leak.what}`).join('\n')
      + `\nThe distribution build must run with TARGET=${DISTRIBUTION_TARGET}, for which no env file exists.`,
    );
  }
  success('no project baked into the bundle');

  step(6, total, 'Assembling the distribution');
  await rm(stageDir, { recursive: true, force: true });
  await mkdir(stageDir, { recursive: true });

  const repoFirebase = await readJson<RepoFirebaseJson>(join(root, 'firebase.json'));
  if (repoFirebase.hosting === undefined) throw new Error('firebase.json has no hosting section.');

  const repoFunctions = await readJson<RepoFunctionsPackage>(join(root, 'functions/package.json'));

  // `.DS_Store` e afins vêm de `public/` e entram no `dist` pela cópia literal que o Vite faz. O
  // hosting já os ignoraria no upload, mas eles não têm por que existir dentro do pacote.
  await cp(join(root, 'dist'), join(stageDir, 'hosting'), {
    recursive: true,
    filter: (source) => !basename(source).startsWith('.'),
  });

  // Os `.js.map` ficam de fora: sem o `src/` que eles apontam são inúteis para quem instala, e
  // publicá-los entregaria a árvore interna de módulos do kernel — o desenho, ainda que não o
  // código. (`sourcesContent` não é emitido, então o TypeScript em si nunca esteve neles.)
  await cp(join(root, 'functions/lib'), join(stageDir, 'functions/lib'), {
    recursive: true,
    filter: (source) => !source.endsWith('.map'),
  });
  await cp(join(root, 'functions/package-lock.json'), join(stageDir, 'functions/package-lock.json'));
  // O `.env.example` NÃO viaja. Dentro de `install/functions/` ele era uma armadilha: convidava a
  // preencher a configuração ali, num diretório que o deploy seguinte apaga por inteiro. O que a
  // instalação recebe é o `.env.<projectId>` na RAIZ, escrito a partir do manifesto e já comentado —
  // um modelo a menos é um lugar errado a menos.

  for (const file of ['firestore.rules', 'storage.rules']) {
    await cp(join(root, file), join(stageDir, file));
  }

  // O histórico do kernel viaja DENTRO do pacote, e é de lá que o `unpack` o copia para a raiz da
  // instalação. Escrito do conteúdo já conferido, para não ler o arquivo duas vezes.
  await writeFile(join(stageDir, KERNEL_CHANGELOG), changelog);

  // A AGPL exige que o texto da licença acompanhe cada cópia distribuída do compilado, e o NOTICE
  // carrega os termos da seção 7 — atribuição e exceção para extensões — que só valem se viajarem juntos.
  for (const file of ['LICENSE', 'NOTICE']) {
    await cp(join(root, file), join(stageDir, file));
  }

  // O `firestore.indexes.json` do pacote é ESCRITO, não copiado: a raiz é o conjunto completo (é o que
  // roda em `microteia-dev` e `curatino`), e o que uma extensão reivindica sai daqui para ser criado
  // pelo `provision` quando ela for instalada. Os `fieldOverrides` são todos do kernel e vão inteiros.
  await writeFile(
    join(stageDir, 'firestore.indexes.json'),
    `${JSON.stringify({ ...rootIndexes, indexes: baselineIndexes }, null, 2)}\n`,
  );

  await mkdir(join(stageDir, 'functions/custom/src'), { recursive: true });
  await writeFile(join(stageDir, 'firebase.json'), packageFirebaseJson(repoFirebase.hosting));
  await writeFile(join(stageDir, 'functions/package.json'), packageFunctionsPackageJson(repoFunctions, version));
  await writeFile(join(stageDir, 'functions/index.js'), packageFunctionsIndexJs());
  await writeFile(join(stageDir, 'functions/custom/tsconfig.json'), packageCustomTsconfig());
  await writeFile(join(stageDir, 'functions/custom/src/index.ts'), packageCustomIndexTs());

  const sdk = await stageSdk(root, stageDir, version);

  const manifest: KernelManifest = {
    id: KERNEL_DISTRIBUTION_ID,
    name: 'Microteia Kernel',
    version,
    kernelVersion,
    minimumCliVersion: MINIMUM_CLI_VERSION,
    packagedAt: new Date().toISOString(),
    components: KERNEL_COMPONENTS,
    requires: {
      functionsRegion: DEFAULT_FUNCTIONS_REGION,
      nodeVersion: REQUIRED_NODE_VERSION,
    },
    functions: functionNames,
    baselineFunctions,
    baselineIndexes,
    callables,
    preLoginPoints,
    backendParameters,
    manualPrerequisites: MANUAL_PREREQUISITES,
    sdk,
  };

  await writeFile(join(stageDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  step(7, total, 'Writing the tarball');
  await run('tar', ['-czf', tarball, '-C', stageDir, '.'], { cwd: root });
  await rm(stageDir, { recursive: true, force: true });

  /**
   * A segunda cópia do manifesto, FORA do tarball, para que a versão e os pré-requisitos possam ser
   * lidos sem desempacotar nada — e agora também para que o que foi BAIXADO possa ser conferido.
   *
   * Ela deixou de ser o mesmo JSON da de dentro, e vem depois do `tar` por causa disso: o `sha256` é do
   * arquivo que acabou de ser escrito, e a cópia de dentro dele não teria como carregá-lo. É a única
   * diferença entre as duas, e está declarada no tipo.
   */
  const digest = await digestOfFile(tarball);
  const published: KernelManifest = {
    ...manifest,
    tarball: { name: basename(tarball), ...digest },
  };
  await writeFile(join(outputDir, 'manifest.json'), `${JSON.stringify(published, null, 2)}\n`);

  blank();
  info(`Kernel ${version} packaged.`);
  bullets([
    `tarball:  ${tarball}`,
    `manifest: ${join(outputDir, 'manifest.json')}`,
    `functions: ${functionNames.length} packaged, ${baselineFunctions.length} in the baseline`,
    `callables: ${callables.length}`,
    `claimed by extensions: ${functionNames.length - baselineFunctions.length} function(s), `
      + `${rootIndexes.indexes.length - baselineIndexes.length} index(es), from ${claims.length} extension(s)`,
    `backend parameters: ${backendParameters.length}`,
    `authoring SDK: ${sdk.version} (kernel contract ${sdk.kernelVersion})`,
    `size: ${(digest.bytes / 1_000_000).toFixed(1)} MB, sha256 ${digest.sha256.slice(0, 12)}…`,
  ]);
  blank();
  if (outputDir !== defaultOutputDir) {
    // O `publish` lê só `distributions/kernel/<versão>/`: o pacote escrito em outro lugar não é achado,
    // e sem este aviso a recusa dele parecia um pacote que nunca foi feito.
    warn(`--output wrote it outside ${relative(root, defaultOutputDir)}/, and "microteia publish" reads only there.`);
    info('  Copy the folder there to publish it, or install the file directly (below).');
    blank();
  }
  info('Publish it with:');
  bullets(['microteia publish --dry-run   (says what would go up)', 'microteia publish']);
  blank();
  info('Or install this file directly, without publishing:');
  bullets([
    'microteia init --name <office>',
    'microteia connect --project <firebase-project-id>',
    `microteia unpack --kernel ${tarball}`,
    'microteia deploy',
    'microteia plugin-init   (optional: author extensions in TypeScript)',
  ]);
  blank();
};
