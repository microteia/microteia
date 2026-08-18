import { access, cp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { flagValue, hasFlag, requiredFlag } from '../shared/args.js';
import type { ParsedArgs } from '../shared/args.js';
import { CLI_VERSION } from '../shared/paths.js';
import { run } from '../shared/run.js';
import { blank, bullets, failure, heading, info, step, success, warn } from '../shared/ui.js';
import { compareVersions } from '../kernel/manifest.js';
import type { KernelManifest } from '../kernel/manifest.js';
import { ENVIRONMENT_FILE, readEnvironment, writeEnvironment } from './environment.js';
import { FIREBASE_BIN } from './firebaseCli.js';
import { deployFunctionsOneByOne } from './deployFunctions.js';
import {
  readResolvedConfig,
  stampedConfigJs,
  workspacePath,
  writeResolvedConfig,
} from './workspace.js';

const COMPONENTS = ['rules', 'indexes', 'functions', 'hosting'] as const;
type Component = (typeof COMPONENTS)[number];

/** O que pertence à instalação e sobrevive à troca do kernel. Ver "custom/" no README do pacote. */
const PRESERVED = ['functions/custom', 'functions/node_modules'];

const exists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const selectedComponents = (args: ParsedArgs): Component[] => {
  const only = flagValue(args, 'only');
  if (only === undefined) return [...COMPONENTS];

  const requested = only.split(',').map((name) => name.trim());
  const unknown = requested.filter((name) => !COMPONENTS.includes(name as Component));
  if (unknown.length > 0) {
    throw new Error(`Unknown component(s): ${unknown.join(', ')}. Valid: ${COMPONENTS.join(', ')}.`);
  }
  return requested as Component[];
};

/**
 * Desempacota preservando o que é do escritório. O pacote é substituído por inteiro — é isso que faz
 * o upgrade ser confiável —, então o que não pode ser perdido é copiado de volta explicitamente, em
 * vez de o extrator "mesclar" por cima e deixar restos da versão anterior.
 */
const unpackKernel = async (tarball: string, root: string): Promise<string> => {
  const install = join(workspacePath(root), 'install');
  const staging = join(workspacePath(root), 'staging');

  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });
  await run('tar', ['-xzf', tarball, '-C', staging]);

  for (const relative of PRESERVED) {
    const previous = join(install, relative);
    if (!await exists(previous)) continue;

    await rm(join(staging, relative), { recursive: true, force: true });
    await cp(previous, join(staging, relative), { recursive: true });
    info(`  kept ${relative} from the previous install`);
  }

  await rm(install, { recursive: true, force: true });
  await rename(staging, install);
  return install;
};

export const deploy = async (args: ParsedArgs): Promise<void> => {
  const file = resolve(hasFlag(args, 'file') ? requiredFlag(args, 'file') : join(process.cwd(), ENVIRONMENT_FILE));
  const root = dirname(file);
  const tarball = resolve(requiredFlag(args, 'kernel'));
  const components = selectedComponents(args);
  const delaySeconds = Number.parseInt(flagValue(args, 'delay') ?? '1', 10);

  const environment = await readEnvironment(file);
  const projectId = environment.firebase.projectId;

  if (projectId === null) {
    throw new Error('This installation is not connected yet. Run "microteia connect --project <id>".');
  }

  const resolvedConfig = await readResolvedConfig(root);
  const firstInstall = environment.kernel.version === null;

  heading(`Deploying Microteia to ${projectId}`);

  const total = components.length + 2;
  let current = 0;

  current += 1;
  step(current, total, 'Unpacking the kernel');
  const install = await unpackKernel(tarball, root);

  const manifest = JSON.parse(await readFile(join(install, 'manifest.json'), 'utf8')) as KernelManifest;

  if (compareVersions(CLI_VERSION, manifest.minimumCliVersion) < 0) {
    throw new Error(
      `This package needs Microteia Console ${manifest.minimumCliVersion} or newer; this is ${CLI_VERSION}.`,
    );
  }

  // A região é do PACOTE, não do arquivo: as Cloud Functions são compiladas com ela fixa, então o
  // que está no `microteia.yaml` é registro, e não escolha.
  const region = manifest.requires.functionsRegion;
  if (environment.firebase.region !== region) {
    warn(`this package is compiled for region ${region}; the installation recorded ${environment.firebase.region}.`);
  }

  success(`kernel ${manifest.version} (contract ${manifest.kernelVersion}), ${manifest.functions.length} functions`);
  if (firstInstall) info('  first install: functions are deployed with --force so cleanup policies get configured');

  current += 1;
  step(current, total, 'Stamping the installation configuration');
  const stamped = { ...resolvedConfig, functionsRegion: region };
  await writeResolvedConfig(root, stamped);
  await writeFile(join(install, 'hosting', 'firebase-config.js'), stampedConfigJs(stamped));

  const backendEnv = join(install, 'functions', `.env.${projectId}`);
  if (!await exists(backendEnv)) {
    await cp(join(install, 'functions', '.env.example'), backendEnv);
    info(`  created functions/.env.${projectId} from the template (Gmail intake is optional)`);
  }
  success(`hosting/firebase-config.js → ${projectId}`);

  const failures: string[] = [];

  for (const component of components) {
    current += 1;

    if (component === 'rules') {
      step(current, total, 'Firestore and Storage rules');
      await run(FIREBASE_BIN, ['deploy', '--only', 'firestore:rules,storage', '--project', projectId], { cwd: install });
      continue;
    }

    if (component === 'indexes') {
      step(current, total, 'Firestore indexes');
      await run(FIREBASE_BIN, ['deploy', '--only', 'firestore:indexes', '--project', projectId], { cwd: install });
      continue;
    }

    if (component === 'functions') {
      step(current, total, `Cloud Functions (${manifest.functions.length} kernel + this installation, one at a time)`);
      info('  installing function dependencies…');
      await run('npm', ['install', '--no-audit', '--no-fund'], { cwd: join(install, 'functions') });

      const report = await deployFunctionsOneByOne(manifest.functions, {
        projectId,
        cwd: install,
        delaySeconds,
        force: firstInstall,
      });

      if (report.failed.length > 0) {
        failures.push(`${report.failed.length} function(s): ${report.failed.map((entry) => entry.name).join(', ')}`);
        blank();
        for (const entry of report.failed) {
          failure(entry.name);
          info(entry.output.split('\n').slice(-12).map((line) => `      ${line}`).join('\n'));
        }
      }
      continue;
    }

    step(current, total, 'Hosting');
    await run(FIREBASE_BIN, ['deploy', '--only', 'hosting', '--project', projectId], { cwd: install });
  }

  await writeEnvironment(file, {
    ...environment,
    firebase: { ...environment.firebase, region },
    kernel: { version: manifest.version },
  });

  blank();

  if (failures.length > 0) {
    failure(`Deploy finished with problems: ${failures.join('; ')}`);
    info('Re-run to retry only what failed:');
    bullets([`microteia deploy --kernel ${tarball} --only functions`]);
    blank();
    throw new Error('Some components did not deploy.');
  }

  info(`Microteia ${manifest.version} is installed in ${projectId}.`);
  bullets([`https://${projectId}.web.app`]);
  blank();
  info('Sign in to create the first office. Everything else is configured from inside the application.');
  blank();
};
