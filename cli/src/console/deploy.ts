import { writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { flagValue, hasFlag, requiredFlag } from '../shared/args.js';
import type { ParsedArgs } from '../shared/args.js';
import { run } from '../shared/run.js';
import { blank, bullets, failure, heading, info, step, success, warn } from '../shared/ui.js';
import { ENVIRONMENT_FILE, readEnvironment, writeEnvironment } from './environment.js';
import type { Environment } from './environment.js';
import { FIREBASE_BIN } from './firebaseCli.js';
import { reportFailures, reportNotices } from './deployFunctions.js';
import { clearRegionOrphans, listDeployedFunctions } from './regionOrphans.js';
import { gateProblemsFor } from './functionGate.js';
import { deployFunctionsThatChanged } from './functionsUpToDate.js';
import { checkCallables, invokerGrantCommand } from './callableAccess.js';
import { checkHostingServed, htmlIsRevalidated } from './hostingCheck.js';
import { provisionBackend } from './provision.js';
import { installPath, readInstalledManifest } from './unpack.js';
import { ensureOfficeEnv, ensureRootGitignore, officeEnvName, stageOfficeEnv } from './backendEnv.js';
import { gatherCustomFunctions, readOfficeFunctions } from './customFunctions.js';
import {
  readResolvedConfig,
  stampedConfigJs,
  writeResolvedConfig,
} from './workspace.js';
import { STAMP_FILE, buildLoginExtensions, stampPath } from './loginExtensions.js';

const COMPONENTS = ['rules', 'indexes', 'functions', 'hosting'] as const;
type Component = (typeof COMPONENTS)[number];

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

export const deploy = async (args: ParsedArgs): Promise<void> => {
  const file = resolve(hasFlag(args, 'file') ? requiredFlag(args, 'file') : join(process.cwd(), ENVIRONMENT_FILE));
  const root = dirname(file);
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

  const total = components.length + 1;
  let current = 0;

  // Publica o que o `unpack` trouxe. Separar os dois é o que permite trocar de kernel e publicar SÓ o
  // que mudou naquela versão — e é o que dá um momento para preencher um parâmetro novo antes de subir.
  const install = installPath(root);
  const manifest = await readInstalledManifest(root);

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

  success(`hosting/firebase-config.js → ${projectId}`);

  // As extensões que valem ANTES do login. Carimbadas no mesmo passo da configuração porque são a
  // mesma coisa: o que o navegador precisa saber antes de o bundle subir. Escrito sempre, mesmo vazio
  // — pular a escrita deixaria o carimbo do deploy anterior no ar, e tirar um pacote da lista não o
  // tiraria da tela.
  const loginExtensions = await buildLoginExtensions(
    root,
    environment.login.extensions,
    manifest.preLoginPoints,
  );
  await writeFile(stampPath(install), loginExtensions.contents);
  if (loginExtensions.stamped.length === 0) {
    success(`hosting/${STAMP_FILE} → no extensions before sign-in`);
  } else {
    success(`hosting/${STAMP_FILE} → ${loginExtensions.stamped.join(', ')}`);
  }
  for (const warning of loginExtensions.warnings) warn(warning);

  // O arquivo que o escritório edita é o da RAIZ; o que o `firebase-functions` lê tem de estar em
  // `install/functions/`, e por isso é uma cópia escrita agora. Antes a fonte era a cópia, e o deploy
  // seguinte a apagava junto com o pacote.
  await ensureRootGitignore(root);
  // A união, e não só o que o pacote declara: o `firebase-functions` valida os `defineString`
  // GLOBALMENTE, então um parâmetro declarado por uma function do escritório e sem linha no arquivo
  // recusa o deploy de TODAS elas — inclusive as que não têm relação com ele.
  const office = await readOfficeFunctions(root);
  const settings = await ensureOfficeEnv(
    root,
    projectId,
    [...manifest.backendParameters, ...office.parameters],
  );
  if (settings.created) {
    warn(`created ${officeEnvName(projectId)} with ${settings.added.length} setting(s), all empty —`);
    warn('  features that need one stay off until it is filled in and "microteia provision" runs again.');
  } else if (settings.added.length > 0) {
    warn(`this package declares ${settings.added.length} new setting(s), added empty to `
      + `${officeEnvName(projectId)}: ${settings.added.join(', ')}`);
  }
  await stageOfficeEnv(root, projectId, install);

  const failures: string[] = [];
  const unreachableCallables: string[] = [];
  let staleHosting = false;
  let skippedFunctions = 0;
  // O que as sondas do passo de functions descobriram: carimbo antigo -> carimbo de agora. O
  // provisionamento está no MESMO codebase, então esse é o carimbo das functions de extensão também.
  // Segue `undefined` quando o passo de functions não rodou: ali não há conclusão a tirar, e um mapa
  // vazio diria a mesma coisa por acaso, e não por decisão.
  let refreshedStamps: Map<string, string> | undefined;

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

      // As functions do escritório são montadas AGORA, a partir de onde ele as escreve: `functions/` (as
      // comuns) e `extensions/<plugin>/functions/` (as de cada extensão). O `predeploy` do pacote compila
      // só o `custom/`, então o que não estiver aqui não sobe.
      const gathered = await gatherCustomFunctions(root, install, manifest.functions);

      /**
       * O que sobe aqui é a baseline MAIS as functions comuns que NÃO dizem a quem servem.
       *
       * As de `extensions/<plugin>/functions/` têm dono e sobem pelo provisionamento, no fim deste
       * comando — é o mesmo "empacotar não é deployar" que vale para as do kernel reivindicadas por
       * extensão. E a comum que DECLARA quem serve passou a ter a mesma condição, pela mesma razão: ela
       * é devida enquanto alguma das extensões servidas estiver instalada, e subi-la aqui de qualquer
       * forma faria o `--prune` apagá-la e este passo repô-la, indefinidamente.
       *
       * A comum sem declaração continua subindo sempre. É o comportamento anterior, e mantê-lo é o que
       * impede esta versão de tirar do ar function de uma instalação que já existe.
       */
      const own = [...baseline, ...gathered.unserved];

      /**
       * O portão de instalação, cobrado do que ESTE passo sobe — e não de toda fonte que existe no
       * disco.
       *
       * Na prática ele quase nunca tem o que dizer aqui, e isso é a confirmação de que o lugar é este:
       * o que sobe no `deploy` é a baseline (do kernel) e a comum sem declaração (de quem não há id a
       * cobrar). É no `provision` que a function de extensão entra na fila, e é lá que a recusa morde.
       * Cobrar aqui mantém a regra atada ao ato — se um dia esta lista crescer, ela vem coberta.
       */
      const refused = gateProblemsFor(gathered.sources, own);
      if (refused.length > 0) {
        throw new Error(
          `These Cloud Functions cannot go up as they are:\n${refused.map((line) => `  ${line}`).join('\n')}`,
        );
      }

      step(current, total, `Cloud Functions (${own.length}, one at a time)`);

      if (gathered.sources.length > 0) {
        success(
          `${gathered.functions.length} function(s) of your own, from `
          + `${gathered.sources.map((source) => `${source.label}/`).join(', ')}`,
        );
        const provisioned = gathered.all.length - gathered.unserved.length;
        if (provisioned > 0) {
          info(`  ${provisioned} of them go up with "provision", only where they are needed`);
        }
      }
      if (Object.keys(gathered.dependencies.added).length > 0) {
        success(
          `${Object.keys(gathered.dependencies.added).length} npm dependency(ies) your functions declare: `
          + `${Object.keys(gathered.dependencies.added).join(', ')}`,
        );
        info('  the packaged lockfile does not cover them, so this npm install resolves them and takes');
        info('  longer than the following ones.');
      }
      for (const line of gathered.dependencies.overridden) {
        warn(`${line} — the package's range wins; the runtime is the kernel's choice`);
      }

      info('  installing function dependencies… (~250 packages, a few seconds)');
      // Os dois avisos que o npm dá aqui são esperados, e explicá-los antes evita que quem instala pare
      // para investigar: `EBADENGINE` compara a Node DESTA máquina com a do runtime das functions (que
      // é fixa em 22 de propósito), e as notas de descontinuação vêm de dependências do próprio
      // Firebase, não do kernel. Nenhum dos dois impede o deploy.
      info('  npm may warn about the Node engine and about deprecated packages: both are expected —');
      info('  "engines" names the Cloud Functions runtime, and the notices come from Firebase\'s deps.');
      await run('npm', ['install', '--no-audit', '--no-fund'], { cwd: join(install, 'functions') });

      // Uma pergunta só ao projeto, e duas decisões a partir dela: qual cópia ficou numa região
      // abandonada, e o que ele já roda. Perguntar duas vezes não é caro, é ambíguo — as duas
      // respostas podem divergir, e aí a decisão passa a depender de qual delas o código olhou.
      const deployedNow = await listDeployedFunctions(projectId);

      // ANTES de deployar: uma cópia da mesma function numa região que o pacote abandonou faz o
      // `firebase` recusar o deploy dela, tentativa após tentativa, e faz um gatilho de Firestore
      // disparar duas vezes por gravação enquanto ninguém percebe.
      const standingCopies = await clearRegionOrphans(projectId, own, region, hasFlag(args, 'prune'), deployedNow);

      // Numa instalação nova não há carimbo nenhum com que comparar, e o mecanismo cai sozinho no
      // caminho de sempre — não é preciso um desvio para isso. `--all` é o pedido explícito de subir
      // tudo, para a configuração trocada por fora, que carimbo nenhum enxerga.
      const report = await deployFunctionsThatChanged(own, {
        projectId,
        cwd: install,
        delaySeconds,
        force: firstInstall,
        standingCopies,
      }, { deployed: deployedNow, region, all: hasFlag(args, 'all') });
      refreshedStamps = report.refreshed;
      skippedFunctions = report.skipped.length;

      if (report.failed.length > 0) {
        failures.push(`${report.failed.length} function(s): ${report.failed.map((entry) => entry.name).join(', ')}`);
        blank();
        reportFailures(report.failed);
      }
      reportNotices(report.notices);
      // Deployada não quer dizer alcançável: a concessão de invocação pública pode ter sido
      // recusada, e o `firebase deploy` termina bem do mesmo jeito. Quem paga a conta é o escritório,
      // com uma aplicação que abre e não consegue falar com o servidor.
      const callables = [...(manifest.callables ?? []), ...gathered.callables]
        .filter((name) => own.includes(name));

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

  /**
   * O que o `deploy` carimba é o `deployed`: o `version` já foi gravado pelo `unpack`, que é quem põe o
   * pacote no lugar. Um número só mentia numa das duas pontas — entre desempacotar e publicar, o
   * `MICROTEIA.md` anunciava a versão nova e o `microteia.yaml` ao lado dele, a anterior.
   */
  const applied: Environment = {
    ...environment,
    firebase: { ...environment.firebase, region },
    kernel: { version: manifest.version, deployed: manifest.version },
  };
  await writeEnvironment(file, applied);

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
      all: hasFlag(args, 'all'),
      refreshedStamps,
      environmentFile: file,
      environment: applied,
    });
    if (provisioned.failed.length > 0) {
      failures.push(`${provisioned.failed.length} extension function(s): ${provisioned.failed.join(', ')}`);
    }
  }

  blank();

  if (failures.length > 0) {
    failure(`Deploy finished with problems: ${failures.join('; ')}`);
    info('Re-run to retry only what failed:');
    bullets(['microteia deploy --only functions']);
    blank();
    throw new Error('Some components did not deploy.');
  }

  if (skippedFunctions > 0) {
    info(`${skippedFunctions} Cloud Function(s) were already running this exact code and were left alone.`);
    bullets(['microteia deploy --all', '  deploys every one of them, whatever the project already runs']);
    blank();
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
