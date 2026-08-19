import { access, cp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { flagValue, hasFlag, requiredFlag } from '../shared/args.js';
import type { ParsedArgs } from '../shared/args.js';
import { CLI_VERSION } from '../shared/paths.js';
import { run } from '../shared/run.js';
import { blank, bullets, failure, heading, info, step, success, warn } from '../shared/ui.js';
import { compareVersions } from '../kernel/manifest.js';
import type { BackendParameter, KernelManifest } from '../kernel/manifest.js';
import { ENVIRONMENT_FILE, readEnvironment, writeEnvironment } from './environment.js';
import { FIREBASE_BIN } from './firebaseCli.js';
import { deployFunctionsOneByOne } from './deployFunctions.js';
import { checkCallables, invokerGrantCommand } from './callableAccess.js';
import { checkHostingServed, htmlIsRevalidated } from './hostingCheck.js';
import { provisionBackend } from './provision.js';
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

/**
 * O `firebase-functions` valida os parâmetros GLOBALMENTE, e não por function: um `defineString` sem
 * valor e sem default recusa o deploy de TODAS as functions, inclusive as que nada têm a ver com ele.
 * Um `GOOGLE_GMAIL_TOPIC` ausente derrubou `callAIProxy` numa instalação nova — a mensagem do
 * Firebase nomeia a variável, mas não a function que ela derrubou, e as duas não se parecem.
 *
 * Por isso o arquivo é ESCRITO a partir do manifesto e não copiado de um template, e por isso o que
 * falta é ACRESCENTADO num arquivo já existente: um parâmetro novo numa versão nova do kernel
 * quebraria o upgrade exatamente da mesma forma. O que o escritório já preencheu é preservado.
 */
const ensureBackendEnv = async (
  install: string,
  projectId: string,
  parameters: BackendParameter[],
): Promise<void> => {
  const path = join(install, 'functions', `.env.${projectId}`);
  const previous = await exists(path) ? await readFile(path, 'utf8') : '';

  const declared = new Set(
    previous.split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '' && !line.startsWith('#'))
      .map((line) => line.slice(0, line.indexOf('='))),
  );

  const missing = parameters.filter((parameter) => !declared.has(parameter.name));
  if (missing.length === 0) return;

  const header = previous === ''
    ? `# Backend settings for ${projectId}. Optional features stay empty until configured.\n`
      + '# Never commit this file to a public repository.\n\n'
    : '';

  const body = missing.map((parameter) => `${parameter.name}=`).join('\n');
  await writeFile(path, `${previous}${previous === '' ? '' : '\n'}${header}${body}\n`);

  info(
    previous === ''
      ? `  created functions/.env.${projectId} with ${missing.length} setting(s), all empty`
      : `  added ${missing.length} new setting(s) to functions/.env.${projectId}`,
  );
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

  const baselineCount = (manifest.baselineFunctions ?? manifest.functions).length;
  success(
    `kernel ${manifest.version} (contract ${manifest.kernelVersion}), ${baselineCount} baseline function(s)`
    + `, ${manifest.functions.length - baselineCount} claimed by extensions`,
  );
  if (firstInstall) info('  first install: functions are deployed with --force so cleanup policies get configured');

  current += 1;
  step(current, total, 'Stamping the installation configuration');
  const stamped = { ...resolvedConfig, functionsRegion: region };
  await writeResolvedConfig(root, stamped);
  await writeFile(join(install, 'hosting', 'firebase-config.js'), stampedConfigJs(stamped));

  await ensureBackendEnv(install, projectId, manifest.backendParameters);
  success(`hosting/firebase-config.js → ${projectId}`);

  const failures: string[] = [];
  const unreachableCallables: string[] = [];
  let staleHosting = false;

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
      // A BASELINE, e não tudo o que foi empacotado: function de extensão sobe quando a extensão for
      // instalada, pelo provisionamento no fim deste comando.
      const baseline = manifest.baselineFunctions ?? manifest.functions;
      step(current, total, `Cloud Functions (${baseline.length} baseline, one at a time)`);
      info('  installing function dependencies… (~250 packages, a few seconds)');
      // Os dois avisos que o npm dá aqui são esperados, e explicá-los antes evita que quem instala pare
      // para investigar: `EBADENGINE` compara a Node DESTA máquina com a do runtime das functions (que
      // é fixa em 22 de propósito), e as notas de descontinuação vêm de dependências do próprio
      // Firebase, não do kernel. Nenhum dos dois impede o deploy.
      info('  npm may warn about the Node engine and about deprecated packages: both are expected —');
      info('  "engines" names the Cloud Functions runtime, and the notices come from Firebase\'s deps.');
      await run('npm', ['install', '--no-audit', '--no-fund'], { cwd: join(install, 'functions') });

      const report = await deployFunctionsOneByOne(baseline, {
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
      // Deployada não quer dizer alcançável: a concessão de invocação pública pode ter sido
      // recusada, e o `firebase deploy` termina bem do mesmo jeito. Quem paga a conta é o escritório,
      // com uma aplicação que abre e não consegue falar com o servidor.
      const callables = (manifest.callables ?? []).filter((name) => baseline.includes(name));

      if (callables.length > 0) {
        info(`  checking that the browser can reach the ${callables.length} callable(s)…`);
        const origin = `https://${projectId}.web.app`;
        const checks = await checkCallables(callables, { projectId, region, origin });

        const blocked = checks.filter((check) => check.access === 'blocked');
        const unclear = checks.filter((check) => check.access !== 'blocked' && check.access !== 'reachable');

        if (blocked.length > 0) {
          unreachableCallables.push(...blocked.map((check) => check.name));
          blank();
          failure(`${blocked.length} of ${checks.length} callable(s) refuse calls from ${origin}.`);
          info('  The deploy could not make them public — an organization policy that forbids allUsers');
          info('  in IAM does exactly this. The application will open and every server call will fail,');
          info('  in the browser, as what looks like a CORS error. Run once per function:');
          bullets(blocked.map((check) => invokerGrantCommand(region, projectId, check.name)));
        } else if (unclear.length > 0) {
          warn(
            `could not confirm ${unclear.length} of ${checks.length} callable(s): `
            + `${unclear.map((check) => check.name).join(', ')}. Re-run the check, or open the`
            + ' application and watch the browser console.',
          );
        } else {
          success(`all ${checks.length} callables answer calls from ${origin}`);
        }
      }

      continue;
    }

    step(current, total, 'Hosting');
    await run(FIREBASE_BIN, ['deploy', '--only', 'hosting', '--project', projectId], { cwd: install });

    // Publicado não é servido: se o navegador ainda recebe o `index.html` antigo, ele continua
    // carregando o bundle antigo — e a aplicação segue na versão anterior com o deploy em sucesso.
    const hosting = await checkHostingServed(install, `https://${projectId}.web.app`);
    if (hosting.served === 'current') {
      success(`the site serves this version's bundle (${hosting.servedBundle})`);
    } else if (hosting.served === 'stale') {
      warn(`the site is still serving the PREVIOUS bundle (${hosting.servedBundle},`);
      warn(`  this package ships ${hosting.packagedBundle}). Give the CDN a moment and reload; if the`);
      warn('  application keeps showing the old version, force a reload to drop the cached page.');
      staleHosting = true;
    } else {
      info('  could not confirm which bundle the site serves — open it and check the version in the footer');
    }

    if (!htmlIsRevalidated(hosting.htmlCacheControl) && hosting.htmlCacheControl !== null) {
      warn(`the page is served with "cache-control: ${hosting.htmlCacheControl}", so a browser that`);
      warn('  already visited it may keep the previous version until that expires. This package sets');
      warn('  the page to revalidate on every load, so the value above is the one from the deploy');
      warn('  BEFORE this one — it settles once this deploy propagates.');
    }
  }

  await writeEnvironment(file, {
    ...environment,
    firebase: { ...environment.firebase, region },
    kernel: { version: manifest.version },
  });

  // Um motor só: o que as extensões instaladas exigem é aplicado aqui, no fim do deploy, e pelo
  // `microteia provision` quando alguém instala uma extensão depois. Numa instalação nova não há nada
  // instalado e este passo não faz nada — é justamente o que se quer.
  if (components.includes('functions') || components.includes('indexes')) {
    blank();
    info('Extension backends');
    const provisioned = await provisionBackend({
      projectId,
      region,
      install,
      manifest,
      delaySeconds,
      prune: hasFlag(args, 'prune'),
      environmentFile: file,
      environment: { ...environment, firebase: { ...environment.firebase, region }, kernel: { version: manifest.version } },
    });
    if (provisioned.failed.length > 0) {
      failures.push(`${provisioned.failed.length} extension function(s): ${provisioned.failed.join(', ')}`);
    }
  }

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

  if (staleHosting) {
    warn('the browser may still load the previous version for a few minutes. A forced reload');
    warn('  (Shift+Reload, or Empty Cache and Hard Reload) settles it immediately.');
    blank();
  }

  if (unreachableCallables.length > 0) {
    warn(`the deploy finished, but ${unreachableCallables.length} function(s) still refuse calls from`);
    warn('  the browser. Grant the invoker role with the commands printed above before signing in,');
    warn('  otherwise the application opens and nothing it asks the server for will work.');
    blank();
  }

  info('Sign in to create the first office. Everything else is configured from inside the application.');
  blank();
};
