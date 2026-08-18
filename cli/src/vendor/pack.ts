import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { flagValue, hasFlag } from '../shared/args.js';
import type { ParsedArgs } from '../shared/args.js';
import { repoRoot } from '../shared/paths.js';
import { run } from '../shared/run.js';
import { blank, bullets, heading, info, step, success } from '../shared/ui.js';
import {
  DEFAULT_FUNCTIONS_REGION,
  KERNEL_COMPONENTS,
  KERNEL_DISTRIBUTION_ID,
  MANUAL_PREREQUISITES,
  MINIMUM_CLI_VERSION,
  REQUIRED_NODE_VERSION,
  declaredParametersIn,
  exportedFunctionNames,
  parseKernelVersion,
} from '../kernel/manifest.js';
import type { BackendParameter, KernelManifest } from '../kernel/manifest.js';
import { environmentSecrets, findBundleLeaks } from './bundleAudit.js';
import {
  packageCustomIndexTs,
  packageCustomTsconfig,
  packageFirebaseJson,
  packageFunctionsIndexJs,
  packageFunctionsPackageJson,
  packageReadme,
} from './packageTemplates.js';
import type { HostingConfig, RepoFunctionsPackage } from './packageTemplates.js';

/**
 * `dist` é um modo do Vite para o qual NÃO existe `.env.dist`. É isso que garante um bundle sem
 * projeto embutido: o repositório não tem `.env` de raiz servindo de fallback, então nada é inlinado.
 */
const DISTRIBUTION_TARGET = 'dist';

interface RepoFirebaseJson {
  hosting?: HostingConfig;
}

const readJson = async <T>(path: string): Promise<T> =>
  JSON.parse(await readFile(path, 'utf8')) as T;

/**
 * Os `defineString` estão espalhados pelos handlers, não num arquivo só — então a varredura é a
 * árvore inteira de `functions/src`. Derivar daqui é o que faz um parâmetro novo aparecer sozinho no
 * manifesto, em vez de depender de alguém lembrar de atualizar um template.
 */
const collectBackendParameters = async (directory: string): Promise<BackendParameter[]> => {
  const found = new Map<string, BackendParameter>();

  const walk = async (current: string): Promise<void> => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(path);
      } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
        for (const parameter of declaredParametersIn(await readFile(path, 'utf8'))) {
          const previous = found.get(parameter.name);
          // Declarado em dois lugares com defaults diferentes: vale o mais exigente.
          if (previous === undefined || parameter.required) found.set(parameter.name, parameter);
        }
      }
    }
  };

  await walk(directory);
  return [...found.values()].sort((left, right) => left.name.localeCompare(right.name));
};

export const pack = async (args: ParsedArgs): Promise<void> => {
  const root = repoRoot;
  const skipVerify = hasFlag(args, 'skip-verify');

  const pkg = await readJson<{ version: string }>(join(root, 'package.json'));
  const version = pkg.version;
  const kernelVersion = parseKernelVersion(
    await readFile(join(root, 'src/domain/schema/plugin/kernelVersion.ts'), 'utf8'),
  );
  const functionNames = exportedFunctionNames(
    await readFile(join(root, 'functions/src/index.ts'), 'utf8'),
  );
  const backendParameters = await collectBackendParameters(join(root, 'functions/src'));

  const outputDir = flagValue(args, 'output') ?? join(root, 'distributions', 'kernel', version);
  const stageDir = join(outputDir, 'package');
  const tarball = join(outputDir, `microteia-kernel-${version}.tgz`);

  heading(`Packaging Microteia kernel ${version} (contract ${kernelVersion})`);

  const total = 6;

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

  step(4, total, 'Checking that the bundle carries no Firebase project');
  const leaks = await findBundleLeaks(join(root, 'dist'), await environmentSecrets(root));
  if (leaks.length > 0) {
    throw new Error(
      'The built frontend contains Firebase credentials, so it is not distributable.\n'
      + leaks.map((leak) => `  ${leak.file}: ${leak.what}`).join('\n')
      + `\nThe distribution build must run with TARGET=${DISTRIBUTION_TARGET}, for which no env file exists.`,
    );
  }
  success('no project baked into the bundle');

  step(5, total, 'Assembling the distribution');
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
  await cp(join(root, 'functions/.env.example'), join(stageDir, 'functions/.env.example'));

  for (const file of ['firestore.rules', 'storage.rules', 'firestore.indexes.json']) {
    await cp(join(root, file), join(stageDir, file));
  }

  await mkdir(join(stageDir, 'functions/custom/src'), { recursive: true });
  await writeFile(join(stageDir, 'firebase.json'), packageFirebaseJson(repoFirebase.hosting));
  await writeFile(join(stageDir, 'README.md'), packageReadme(version));
  await writeFile(join(stageDir, 'functions/package.json'), packageFunctionsPackageJson(repoFunctions));
  await writeFile(join(stageDir, 'functions/index.js'), packageFunctionsIndexJs());
  await writeFile(join(stageDir, 'functions/custom/tsconfig.json'), packageCustomTsconfig());
  await writeFile(join(stageDir, 'functions/custom/src/index.ts'), packageCustomIndexTs());

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
    backendParameters,
    manualPrerequisites: MANUAL_PREREQUISITES,
  };

  const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
  await writeFile(join(stageDir, 'manifest.json'), manifestJson);
  // Uma segunda cópia FORA do tarball, para que a versão e os pré-requisitos possam ser lidos sem
  // desempacotar nada.
  await writeFile(join(outputDir, 'manifest.json'), manifestJson);

  step(6, total, 'Writing the tarball');
  await run('tar', ['-czf', tarball, '-C', stageDir, '.'], { cwd: root });
  await rm(stageDir, { recursive: true, force: true });

  blank();
  info(`Kernel ${version} packaged.`);
  bullets([
    `tarball:  ${tarball}`,
    `manifest: ${join(outputDir, 'manifest.json')}`,
    `functions: ${functionNames.length}`,
    `backend parameters: ${backendParameters.length}`,
  ]);
  blank();
  info('Install it with:');
  bullets([
    'microteia init --name <office>',
    'microteia connect --project <firebase-project-id>',
    `microteia deploy --kernel ${tarball}`,
  ]);
  blank();
};
