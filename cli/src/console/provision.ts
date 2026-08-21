import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { hasFlag, requiredFlag, flagValue } from '../shared/args.js';
import type { ParsedArgs } from '../shared/args.js';
import { run } from '../shared/run.js';
import { blank, bullets, failure, heading, info, step, success, warn } from '../shared/ui.js';
import type { KernelManifest } from '../kernel/manifest.js';
import {
  backendFingerprint,
  claimedIndexes,
  claimedParameters,
  functionClaimProblems,
  hasBackendRequirement,
  indexKey,
} from '../kernel/backendShape.js';
import type { BackendClaim, FirestoreIndexSpec, PluginBackendRequirement } from '../kernel/backendShape.js';
import { officeEnvPath, stageOfficeEnv } from './backendEnv.js';
import { installPath, readInstalledManifest } from './unpack.js';
import {
  changedParameters,
  functionsDeclaringParameters,
  parameterDigests,
  parseParameterState,
  readBackendEnv,
  serializeParameterState,
} from './backendParameters.js';
import { ENVIRONMENT_FILE, readEnvironment, writeEnvironment } from './environment.js';
import type { Environment } from './environment.js';
import { FIREBASE_BIN } from './firebaseCli.js';
import { deployFunctionsOneByOne } from './deployFunctions.js';
import { checkCallables, invokerGrantCommand } from './callableAccess.js';
import { decodeFields, documentId, listDocuments, patchStringMapField } from './firestoreRest.js';
import { gatherCustomFunctions, readOfficeFunctions } from './customFunctions.js';

/** Uma exigência, o escritório que a instalou e o documento que carrega o estado dela. */
export interface InstalledClaim extends BackendClaim {
  tenantId: string;
  documentPath: string;
  applied: boolean;
}

interface IndexesFile {
  indexes: FirestoreIndexSpec[];
  fieldOverrides?: unknown[];
}

/**
 * O que cada escritório do projeto instalou e exige do backend.
 *
 * A exigência vem do banco, então ela é DADO e não código — é por isso que `claimProblems` a confere
 * contra `manifest.functions` antes de qualquer deploy. Nome de function fora do pacote é recusado com
 * explicação; não há injeção possível, porque o código é sempre o do pacote.
 */
export const readInstalledClaims = async (projectId: string): Promise<InstalledClaim[]> => {
  const tenants = await listDocuments(projectId, '/tenants');
  const claims: InstalledClaim[] = [];

  for (const tenant of tenants) {
    const tenantId = documentId(tenant);
    const extensions = await listDocuments(projectId, `/tenants/${tenantId}/installed_extensions`);

    for (const document of extensions) {
      const data = decodeFields(document.fields);
      if (data.active === false) continue;

      const pkg = data.package as Record<string, unknown> | undefined;
      const manifest = pkg?.manifest as Record<string, unknown> | undefined;
      const backend = manifest?.backend as PluginBackendRequirement | undefined;
      if (!hasBackendRequirement(backend)) continue;

      const state = data.backendState as { fingerprint?: string } | undefined;
      claims.push({
        tenantId,
        documentPath: `/tenants/${tenantId}/installed_extensions/${documentId(document)}`,
        pluginId: String(manifest?.id ?? documentId(document)),
        name: String(manifest?.name ?? manifest?.id ?? documentId(document)),
        version: String(manifest?.version ?? '0.0.0'),
        backend: backend as PluginBackendRequirement,
        applied: state?.fingerprint === backendFingerprint(backend),
      });
    }
  }

  return claims.sort((a, b) => (a.pluginId < b.pluginId ? -1 : a.pluginId > b.pluginId ? 1 : 0));
};

const uniqueByPlugin = (claims: InstalledClaim[]): InstalledClaim[] => {
  const seen = new Set<string>();
  return claims.filter((claim) => {
    if (seen.has(claim.pluginId)) return false;
    seen.add(claim.pluginId);
    return true;
  });
};

export const parseAppliedFunctions = (value: string | null): string[] =>
  (value ?? '').split(',').map((name) => name.trim()).filter((name) => name !== '');

export interface ProvisionOptions {
  projectId: string;
  region: string;
  install: string;
  manifest: KernelManifest;
  delaySeconds: number;
  prune: boolean;
  environmentFile: string;
  environment: Environment;
}

export interface ProvisionOutcome {
  deployed: string[];
  failed: string[];
  orphans: string[];
  pending: InstalledClaim[];
}

/**
 * O motor: alinha o projeto Firebase com o que as extensões instaladas exigem, e carimba nelas o
 * estado. Um motor só, chamado pelo `deploy` no fim e pelo `provision` sozinho — duas implementações
 * divergiriam exatamente no ponto em que ninguém olha.
 */
export const provisionBackend = async (options: ProvisionOptions): Promise<ProvisionOutcome> => {
  const { projectId, region, install, manifest, delaySeconds } = options;
  const root = dirname(options.environmentFile);
  const outcome: ProvisionOutcome = { deployed: [], failed: [], orphans: [], pending: [] };

  /**
   * O que uma extensão pode reivindicar é o que EXISTE para ser deployado: o que o pacote traz mais o
   * que o escritório escreveu em `extensions/<plugin>/functions/` e em `functions/`.
   *
   * Conferir só contra o pacote recusava justamente o caso que o `microteia-plugin create function`
   * gera — a extensão declarava a própria function em `manifest.backend.functions`, o nome não estava no
   * pacote (nem poderia: o kernel não sabe o que o escritório vai escrever), e a extensão inteira era
   * rejeitada com "this kernel package does not contain".
   */
  const office = await readOfficeFunctions(root);
  const deployable = [...manifest.functions, ...office.all];

  const claims = await readInstalledClaims(projectId);
  const problems = functionClaimProblems(claims, deployable);
  const rejected = new Set<string>();
  if (problems.length > 0) {
    warn('some extensions ask for backend artifacts that are nowhere to be found:');
    bullets(problems);
    // A mensagem sozinha é um beco sem saída: ela diz que o nome não existe, e não onde ele deveria
    // existir. As duas respostas possíveis são estas, e a segunda é a que mais acontece — a function é
    // da extensão, o autor a declarou, e ninguém a exportou do `index.ts` do diretório dela.
    info('  a function comes from ONE of two places, and it has to be in one of them:');
    bullets([
      'this Microteia package — the extension claims a function the platform ships',
      `extensions/<folder>/functions/index.ts of this installation — the extension brings its own`,
    ]);
    info(`  this installation currently exports ${office.all.length} function(s) of its own`
      + `${office.all.length === 0 ? '' : `: ${office.all.join(', ')}`}`);
    for (const claim of claims) {
      if (problems.some((problem) => problem.includes(claim.pluginId))) rejected.add(claim.pluginId);
    }
  }

  const valid = uniqueByPlugin(claims.filter((claim) => !rejected.has(claim.pluginId)));

  if (valid.length === 0) {
    info('  no installed extension asks for backend artifacts');
    await recordBackendState(
      options,
      parseAppliedFunctions(options.environment.backend.functions),
      parseParameterState(options.environment.backend.parameters),
    );
    return outcome;
  }

  info(`  ${valid.length} extension(s) ask for backend artifacts:`);
  bullets(valid.map((claim) => `${claim.name} ${claim.version} (${claim.pluginId})`));

  const wantedFunctions = deployable.filter(
    (name) => valid.some((claim) => (claim.backend.functions ?? []).includes(name)),
  );
  const wantedIndexes = claimedIndexes(valid);
  const alreadyApplied = parseAppliedFunctions(options.environment.backend.functions);

  const previouslyDeclared = await declaredIndexes(install);
  await applyIndexes(install, projectId, manifest.baselineIndexes ?? [], wantedIndexes);

  const trackedParameters = claimedParameters(valid);
  // A raiz, e não o `install/`: a fonte é o arquivo que o escritório edita ao lado do `microteia.yaml`.
  const filledParameters = await readBackendEnv(dirname(options.environmentFile), projectId);
  const recordedDigests = parseParameterState(options.environment.backend.parameters);
  const currentDigests = parameterDigests(projectId, filledParameters, trackedParameters);

  const missingParameters = trackedParameters.filter((name) => !filledParameters.has(name));
  if (missingParameters.length > 0) {
    warn(`${missingParameters.length} backend setting(s) are still empty in .env.${projectId}`);
    info(`  (${officeEnvPath(dirname(options.environmentFile), projectId)})`);
    bullets(missingParameters);
    info('  the functions deploy anyway, but the feature that needs them will fail at runtime.');
  }

  // Preencher o arquivo não alcança function nenhuma: o valor é carimbado no deploy de cada uma. O que
  // já está aplicado com o valor anterior volta para a fila — sem isso, o parâmetro preenchido depois da
  // instalação fica sem nenhum comando que o aplique, e a feature falha no runtime.
  const changed = changedParameters(recordedDigests, currentDigests, trackedParameters);
  const staleFunctions = new Set(
    functionsDeclaringParameters(valid, changed)
      .filter((name) => wantedFunctions.includes(name) && alreadyApplied.includes(name)),
  );

  if (changed.length > 0) {
    blank();
    info(`  ${changed.length} backend setting(s) changed since the last run: ${changed.join(', ')}`);
    if (staleFunctions.size > 0) {
      info(`  ${staleFunctions.size} deployed function(s) still carry the previous value and are`);
      info('  redeployed now — a Cloud Function only sees a setting from the deploy that stamps it.');
    }
  }

  const prerequisites = valid.flatMap((claim) => (claim.backend.prerequisites ?? []).map(
    (prerequisite) => `[${claim.name}] ${prerequisite.title}\n      ${prerequisite.detail}`,
  ));
  if (prerequisites.length > 0) {
    blank();
    info('Manual steps these extensions need, which no command can do for you:');
    bullets(prerequisites);
    // O caminho sai daqui, resolvido, e não do texto de cada extensão: era assim que ele estava, e foi
    // assim que ficou errado quando a configuração se mudou para a raiz.
    info(`  Backend settings go in ${officeEnvPath(dirname(options.environmentFile), projectId)}`);
    info('  After filling one in, run "microteia provision" again — the value is stamped into each');
    info('  Cloud Function at ITS deploy, so a function already running keeps the previous one.');
    blank();
  }

  const toDeploy = wantedFunctions.filter(
    (name) => !alreadyApplied.includes(name) || staleFunctions.has(name),
  );
  if (toDeploy.length === 0) {
    success(`the ${wantedFunctions.length} function(s) these extensions need are already deployed`);
  } else {
    // A cópia que o `firebase-functions` lê é atualizada AGORA, e não só no `deploy`: este comando é o
    // que aplica um parâmetro preenchido depois da instalação, e subir a function contra uma cópia
    // velha carimbaria nela justamente o valor que se acabou de trocar.
    await stageOfficeEnv(dirname(options.environmentFile), projectId, install);

    // As fontes do escritório são remontadas AGORA quando alguma delas está na fila: este comando roda
    // sozinho depois de instalar uma extensão, e nesse caminho ninguém passou pelo `deploy` que as
    // monta. Subir sem isso deployaria o `custom/` da montagem anterior — ou nenhum.
    if (toDeploy.some((name) => office.all.includes(name))) {
      await gatherCustomFunctions(root, install, manifest.functions);
      info('  installing function dependencies…');
      await run('npm', ['install', '--no-audit', '--no-fund'], { cwd: join(install, 'functions') });
    }

    info(`  deploying ${toDeploy.length} function(s), one at a time…`);
    const report = await deployFunctionsOneByOne(toDeploy, {
      projectId, cwd: install, delaySeconds, force: false,
    });
    outcome.deployed = report.deployed;
    outcome.failed = report.failed.map((entry) => entry.name);
    for (const entry of report.failed) {
      failure(entry.name);
      info(entry.output.split('\n').slice(-12).map((line) => `      ${line}`).join('\n'));
    }
    await checkNewCallables(
      [...(manifest.callables ?? []), ...office.callables],
      report.deployed,
      projectId,
      region,
    );
  }

  const deployedNow = new Set([...alreadyApplied, ...outcome.deployed]);
  for (const claim of valid) {
    const satisfied = (claim.backend.functions ?? []).every((name) => deployedNow.has(name));
    if (satisfied) {
      await stampApplied(projectId, claims, claim);
    } else {
      outcome.pending.push(claim);
    }
  }

  const orphans = alreadyApplied.filter((name) => !wantedFunctions.includes(name));
  outcome.orphans = orphans;
  const remaining = await settleOrphans(options, orphans);

  await recordBackendState(
    options,
    appliedAfterRun({
      alreadyApplied,
      wanted: wantedFunctions,
      deployed: outcome.deployed,
      keptOrphans: remaining,
    }),
    appliedParameterState({
      recorded: recordedDigests,
      current: currentDigests,
      changed,
      failed: outcome.failed,
      claims: valid,
    }),
  );
  reportOrphanIndexes(projectId, manifest.baselineIndexes ?? [], previouslyDeclared, wantedIndexes);

  return outcome;
};

/**
 * O arquivo do pacote é a BASELINE, e este passo faz o arquivo instalado CONVERGIR para
 * `baseline ∪ exigido` — reescrever a partir da baseline, em vez de acrescentar ao que está lá, é o que
 * faz o índice de uma extensão desinstalada desaparecer do arquivo em vez de acumular para sempre.
 *
 * `firebase deploy --only firestore:indexes` cria o que falta e nunca apaga o que sobra, então o deploy
 * é seguro e a remoção de verdade é assunto de `--prune`.
 */
const applyIndexes = async (
  install: string,
  projectId: string,
  baseline: FirestoreIndexSpec[],
  wanted: FirestoreIndexSpec[],
): Promise<void> => {
  const path = join(install, 'firestore.indexes.json');
  const file = JSON.parse(await readFile(path, 'utf8')) as IndexesFile;

  const desired = [...baseline];
  const present = new Set(desired.map(indexKey));
  for (const index of wanted) {
    if (present.has(indexKey(index))) continue;
    present.add(indexKey(index));
    desired.push(index);
  }

  const current = new Set(file.indexes.map(indexKey));
  const missing = desired.filter((index) => !current.has(indexKey(index)));
  const changed = missing.length > 0 || file.indexes.length !== desired.length;

  if (!changed) {
    if (wanted.length > 0) success('the composite indexes these extensions need are already declared');
    return;
  }

  await writeFile(path, `${JSON.stringify({ ...file, indexes: desired }, null, 2)}\n`);
  if (missing.length === 0) return;
  info(`  creating ${missing.length} composite index(es)…`);
  await run(FIREBASE_BIN, ['deploy', '--only', 'firestore:indexes', '--project', projectId], { cwd: install });
};

const checkNewCallables = async (
  known: string[],
  deployed: string[],
  projectId: string,
  region: string,
): Promise<void> => {
  const callables = known.filter((name) => deployed.includes(name));
  if (callables.length === 0) return;

  const origin = `https://${projectId}.web.app`;
  const checks = await checkCallables(callables, { projectId, region, origin });
  const blocked = checks.filter((check) => check.access === 'blocked');

  if (blocked.length === 0) {
    success(`all ${checks.length} new callable(s) answer calls from ${origin}`);
    return;
  }

  failure(`${blocked.length} of ${checks.length} new callable(s) refuse calls from ${origin}.`);
  info('  The application will open and these calls will fail in the browser as what looks like a');
  info('  CORS error. Run once per function:');
  bullets(blocked.map((check) => invokerGrantCommand(region, projectId, check.name)));
};

/**
 * O carimbo é gravado em TODAS as cópias daquela extensão — o artefato é do projeto, então se ele
 * existe, existe para todo escritório que o instalou, e não só para aquele cuja cópia foi lida por
 * último.
 */
const stampApplied = async (
  projectId: string,
  all: InstalledClaim[],
  claim: InstalledClaim,
): Promise<void> => {
  const fingerprint = backendFingerprint(claim.backend);
  const appliedAt = new Date().toISOString();
  for (const copy of all.filter((entry) => entry.pluginId === claim.pluginId)) {
    if (backendFingerprint(copy.backend) !== fingerprint) continue;
    await patchStringMapField(projectId, copy.documentPath, 'backendState', { fingerprint, appliedAt });
  }
  success(`${claim.name} is ready in ${projectId}`);
};

/**
 * Function que nenhuma extensão instalada exige mais. Apagar é destrutivo e irreversível, então o
 * padrão RELATA e só `--prune` remove — e o que foi removido sai da lista de aplicadas.
 */
const settleOrphans = async (options: ProvisionOptions, orphans: string[]): Promise<string[]> => {
  if (orphans.length === 0) return [];

  blank();
  if (!options.prune) {
    warn(`${orphans.length} function(s) are deployed but no installed extension needs them:`);
    bullets(orphans);
    info('  they keep working and cost nothing while idle. To remove them:');
    bullets(['microteia provision --prune']);
    blank();
    return orphans;
  }

  info(`  deleting ${orphans.length} orphan function(s)…`);
  const deleted: string[] = [];
  for (const name of orphans) {
    try {
      await run(
        FIREBASE_BIN,
        ['functions:delete', name, '--project', options.projectId, '--region', options.region, '--force'],
        { cwd: options.install },
      );
      deleted.push(name);
    } catch {
      warn(`could not delete ${name}; it stays recorded as deployed`);
    }
  }
  success(`${deleted.length} orphan function(s) removed`);
  return orphans.filter((name) => !deleted.includes(name));
};

/**
 * Índice órfão é RELATADO com o comando, nunca apagado: `firebase deploy` não remove índice, e a API
 * que remove pede o id GERADO do índice — apagar às cegas o índice errado custa uma consulta em
 * produção, e listá-lo custa três linhas de saída.
 */
const declaredIndexes = async (install: string): Promise<FirestoreIndexSpec[]> => {
  const file = JSON.parse(
    await readFile(join(install, 'firestore.indexes.json'), 'utf8'),
  ) as IndexesFile;
  return file.indexes;
};

const reportOrphanIndexes = (
  projectId: string,
  baseline: FirestoreIndexSpec[],
  previouslyDeclared: FirestoreIndexSpec[],
  wanted: FirestoreIndexSpec[],
): void => {
  const keep = new Set([...baseline, ...wanted].map(indexKey));
  const orphans = previouslyDeclared.filter((index) => !keep.has(indexKey(index)));
  if (orphans.length === 0) return;

  blank();
  warn(`${orphans.length} composite index(es) belong to extensions that are no longer installed:`);
  bullets(orphans.map((index) => `${index.collectionGroup} (${index.fields.map((f) => f.fieldPath).join(', ')})`));
  warn('  a deploy never deletes an index. Remove them in the Firebase console (Firestore, Indexes),');
  warn('  or list the generated ids with:');
  bullets([`gcloud firestore indexes composite list --project=${projectId}`]);
};

/**
 * A lista aplicada CONVERGE para o que ainda é exigido: o que já estava e continua sendo pedido, mais
 * o que subiu agora, mais o órfão que não foi removido. Reescrevê-la só com o que subiu NESTA execução
 * a esvaziava na segunda passada — e a terceira redeployava tudo, achando que nada havia sido feito.
 */
export const appliedAfterRun = (input: {
  alreadyApplied: string[];
  wanted: string[];
  deployed: string[];
  keptOrphans: string[];
}): string[] => [...new Set([
  ...input.alreadyApplied.filter((name) => input.wanted.includes(name)),
  ...input.deployed,
  ...input.keptOrphans,
])].sort();

/**
 * A impressão digital do parâmetro só avança quando TODAS as functions que o carregam subiram. Gravar
 * antes disso é o que transformaria uma falha de deploy em silêncio permanente: o valor novo ficaria
 * registrado como aplicado, e nenhuma execução seguinte tentaria de novo.
 *
 * O que não é mais reivindicado por extensão nenhuma fica registrado em vez de ser removido: apagar
 * faria uma extensão reinstalada redeployar functions que já carregam o valor certo, e uma linha a mais
 * no arquivo não decide nada.
 */
export const appliedParameterState = (input: {
  recorded: Map<string, string>;
  current: Map<string, string>;
  changed: string[];
  failed: string[];
  claims: BackendClaim[];
}): Map<string, string> => {
  const failed = new Set(input.failed);
  const next = new Map(input.recorded);

  for (const name of input.changed) {
    const carriers = functionsDeclaringParameters(input.claims, [name]);
    if (carriers.some((functionName) => failed.has(functionName))) continue;

    const digest = input.current.get(name);
    if (digest === undefined) next.delete(name);
    else next.set(name, digest);
  }

  return next;
};

const recordBackendState = async (
  options: ProvisionOptions,
  names: string[],
  parameters: Map<string, string>,
): Promise<void> => {
  await writeEnvironment(options.environmentFile, {
    ...options.environment,
    backend: {
      functions: names.length === 0 ? null : names.join(','),
      parameters: serializeParameterState(parameters),
    },
  });
};

/** O comando: provisiona sem reenviar o kernel. É o que se roda depois de instalar uma extensão. */
export const provision = async (args: ParsedArgs): Promise<void> => {
  const file = resolve(hasFlag(args, 'file') ? requiredFlag(args, 'file') : join(process.cwd(), ENVIRONMENT_FILE));
  const root = dirname(file);
  const delaySeconds = Number.parseInt(flagValue(args, 'delay') ?? '1', 10);

  const environment = await readEnvironment(file);
  const projectId = environment.firebase.projectId;
  if (projectId === null) {
    throw new Error('This installation is not connected yet. Run "microteia connect --project <id>".');
  }
  if (environment.kernel.version === null) {
    throw new Error(
      'No kernel is deployed yet. Run "microteia unpack --kernel <package>.tgz" and then "microteia deploy".',
    );
  }

  // Pela mesma porta que o `deploy` usa: ela recusa com o comando que falta, e confere a versão mínima
  // do Console — montar o caminho à mão aqui devolveria um ENOENT cru.
  const install = installPath(root);
  const manifest = await readInstalledManifest(root);
  const region = manifest.requires.functionsRegion;

  heading(`Provisioning extension backends in ${projectId}`);
  step(1, 1, 'Reading what the offices installed');

  const outcome = await provisionBackend({
    projectId,
    region,
    install,
    manifest,
    delaySeconds,
    prune: hasFlag(args, 'prune'),
    environmentFile: file,
    environment,
  });

  blank();
  if (outcome.failed.length > 0) {
    failure(`${outcome.failed.length} function(s) did not deploy: ${outcome.failed.join(', ')}`);
    info('Re-run to retry:');
    bullets(['microteia provision']);
    blank();
    throw new Error('Some extension functions did not deploy.');
  }

  if (outcome.pending.length > 0) {
    warn(`${outcome.pending.length} extension(s) are still pending: `
      + outcome.pending.map((claim) => claim.name).join(', '));
    blank();
    return;
  }

  info('Every installed extension has what it needs. Reload the application to use them.');
  blank();
};
