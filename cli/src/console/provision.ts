import { dirname, join, resolve } from 'node:path';
import { hasFlag, requiredFlag, flagValue } from '../shared/args.js';
import type { ParsedArgs } from '../shared/args.js';
import { run } from '../shared/run.js';
import { blank, bullets, failure, heading, info, step, success, warn } from '../shared/ui.js';
import type { KernelManifest } from '../kernel/manifest.js';
import {
  backendFingerprint,
  baselineClaimProblems,
  claimedIndexes,
  claimedParameters,
  functionClaimProblems,
  hasBackendRequirement,
  indexKey,
  sharedClaimProblems,
} from '../kernel/backendShape.js';
import type { BackendClaim, FirestoreIndexSpec, PluginBackendRequirement } from '../kernel/backendShape.js';
import {
  convergeIndexes,
  describeIndex,
  parseIndexState,
  readIndexFile,
  serializeIndexState,
  writeIndexFile,
} from './backendIndexes.js';
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
import { deployFunctionsOneByOne, reportFailures, reportNotices } from './deployFunctions.js';
import { clearRegionOrphans, listDeployedFunctions } from './regionOrphans.js';
import type { DeployedFunction } from './regionOrphans.js';
import { outdatedByStamp } from './functionsUpToDate.js';
import type { OutdatedFunctions } from './functionsUpToDate.js';
import { checkCallables, invokerGrantCommand } from './callableAccess.js';
import { asString, asTimestamp, patchMapField } from './firestoreRest.js';
import { writeBackendResidue } from './backendResidue.js';
import { listTenants, readInstalledExtensions } from './installedExtensions.js';
import { gatherCustomFunctions, readOfficeFunctions } from './customFunctions.js';
import {
  describeMisgated,
  gateProblems,
  misgatedTriggers,
  singleClaimants,
} from './functionGate.js';
import {
  appliedAfterRun,
  classifyApplied,
  describeApplied,
  parseAppliedFunctions,
  serializeAppliedFunctions,
  straysInProject,
} from './appliedFunctions.js';
import type { AppliedFunction, PreservedFunction, StrayFunctions } from './appliedFunctions.js';

/** Uma exigência, o escritório que a instalou e o documento que carrega o estado dela. */
export interface InstalledClaim extends BackendClaim {
  tenantId: string;
  documentPath: string;
  applied: boolean;
}

/**
 * A varredura inteira, e não só o que ela achou.
 *
 * As contagens estão aqui porque é delas que sai o direito de APAGAR: a Cloud Function é do PROJETO e a
 * instalação é do ESCRITÓRIO, então "extensão nenhuma exige mais" é uma afirmação sobre todos os
 * escritórios do projeto, não sobre o último que foi lido. A varredura é completa ou não existe —
 * `listDocuments` pagina até o fim e qualquer leitura recusada derruba o comando —, e o que faltava era
 * DIZER isso a quem lê a proposta de remoção.
 */
export interface InstalledSurvey {
  /** Escritórios lidos. Todos os do projeto, ou nada abaixo teria acontecido. */
  tenants: number;
  /** Cópias de extensão lidas, ativas ou não. */
  extensions: number;
  claims: InstalledClaim[];
  /**
   * Todo id instalado e ativo no projeto, exija ele backend ou não.
   *
   * `claims` não serve para esta pergunta, e a diferença é a que faz a function comum ser retirada pelo
   * motivo certo: uma extensão sem `manifest.backend` nunca vira reivindicação, mas ela pode muito bem
   * ser uma das que a function comum serve. Decidir pela lista de reivindicações apagaria a function de
   * quem está instalado.
   */
  installedIds: Set<string>;
}

/**
 * O que cada escritório do projeto instalou e exige do backend.
 *
 * A exigência vem do banco, então ela é DADO e não código — é por isso que `claimProblems` a confere
 * contra `manifest.functions` antes de qualquer deploy. Nome de function fora do pacote é recusado com
 * explicação; não há injeção possível, porque o código é sempre o do pacote.
 */
export const surveyInstallations = async (projectId: string): Promise<InstalledSurvey> => {
  const tenants = await listTenants(projectId);
  const claims: InstalledClaim[] = [];
  const installedIds = new Set<string>();
  let extensions = 0;

  for (const tenant of tenants) {
    for (const extension of await readInstalledExtensions(projectId, tenant.id)) {
      extensions += 1;
      if (!extension.active) continue;
      installedIds.add(extension.id);

      const backend = extension.manifest?.backend as PluginBackendRequirement | undefined;
      if (!hasBackendRequirement(backend)) continue;

      const state = extension.data.backendState as { fingerprint?: string } | undefined;
      claims.push({
        tenantId: extension.tenantId,
        documentPath: extension.documentPath,
        pluginId: extension.id,
        name: extension.name,
        version: extension.version,
        backend: backend as PluginBackendRequirement,
        applied: state?.fingerprint === backendFingerprint(backend),
      });
    }
  }

  return {
    tenants: tenants.length,
    extensions,
    claims: claims.sort((a, b) => (a.pluginId < b.pluginId ? -1 : a.pluginId > b.pluginId ? 1 : 0)),
    installedIds,
  };
};

const uniqueByPlugin = (claims: InstalledClaim[]): InstalledClaim[] => {
  const seen = new Set<string>();
  return claims.filter((claim) => {
    if (seen.has(claim.pluginId)) return false;
    seen.add(claim.pluginId);
    return true;
  });
};

export interface ProvisionOptions {
  projectId: string;
  region: string;
  install: string;
  manifest: KernelManifest;
  delaySeconds: number;
  prune: boolean;
  /** `--all`: ignora o carimbo e sobe toda function que as extensões instaladas exigem. */
  all?: boolean;
  /**
   * O que as sondas do passo de functions do `deploy` observaram: carimbo antigo -> carimbo de
   * agora. A function de extensão está no MESMO codebase da baseline, então esse carimbo vale para
   * ela — e é por ele que uma cujo CÓDIGO mudou volta para a fila, coisa que o nome nunca disse.
   *
   * Sem ele — o `provision` chamado sozinho, logo depois de alguém instalar uma extensão pela
   * aplicação — o comando decide como sempre decidiu. Sondar ali custaria um deploy a cada
   * instalação de extensão para responder uma pergunta que naquele momento é quase sempre "nada".
   */
  refreshedStamps?: Map<string, string>;
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

  const survey = await surveyInstallations(projectId);
  const claims = survey.claims;
  const missing = functionClaimProblems(claims, deployable);
  const overlapping = baselineClaimProblems(claims, manifest.baselineFunctions ?? []);
  // A comum do escritório tem o MESMO desfecho da function da plataforma, e por isso a mesma recusa: o
  // `deploy` a sobe sempre, então reivindicá-la não muda nada — até o dia em que `--prune` a apaga.
  const appropriated = sharedClaimProblems(claims, office.shared);
  // O portão aberto para o id de OUTRA extensão. Só aqui se pode perguntar: é a reivindicação que diz de
  // quem a function é, e ela vem do banco do escritório — o `deploy` não a tem.
  const misgated = misgatedTriggers(office.sources, singleClaimants(claims));
  const problems = [
    ...missing,
    ...overlapping,
    ...appropriated,
    ...misgated.map(describeMisgated),
  ];
  const rejected = new Set<string>();

  if (missing.length > 0) {
    warn('some extensions ask for backend artifacts that are nowhere to be found:');
    bullets(missing);
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
  }

  if (overlapping.length > 0) {
    warn('some extensions claim a function that belongs to the platform itself:');
    bullets(overlapping);
    info('  every "microteia deploy" puts those up, extension or no extension, so claiming one changes');
    info('  nothing while it is installed — and takes a working trigger out of this project the day it');
    info('  is uninstalled. Rename the extension\'s own function, or drop the name from its');
    info('  manifest.backend.functions.');
  }

  if (appropriated.length > 0) {
    warn('some extensions claim a function that is shared by this whole installation:');
    bullets(appropriated);
    info('  functions/ next to microteia.yaml is the place for a function that serves SEVERAL');
    info('  extensions, so it has no owner and every "microteia deploy" puts it up. Claiming one changes');
    info('  nothing while the extension is installed — and the day it is uninstalled the function turns');
    info('  into an orphan, --prune deletes it, and the next deploy puts it back. Whoever else depended');
    info('  on it loses their backend in a window nothing explains. Move the function into');
    info('  extensions/<folder>/functions/ if it is really this extension\'s, drop the name from its');
    info('  manifest.backend.functions, or — if several extensions need it — name them in "microteia" ->');
    info('  "serves" in functions/package.json, which is how a shared function gets withdrawn.');
  }

  /**
   * O portão é RELATADO por inteiro aqui, e COBRADO uma a uma na fila de deploy, mais abaixo.
   *
   * A assimetria é deliberada, e é o que este comando exige: ele é o único capaz de RETIRAR uma function
   * do projeto. Recusar o comando inteiro trancaria `--prune` — que é justamente quem apaga a órfã — por
   * causa de uma fonte que a órfã não tem nada a ver. Então a fonte defeituosa sai da fila, é dita em voz
   * alta, o comando termina em erro por causa dela, e tudo o mais acontece.
   *
   * O relato é de TODAS, e não só das que estão subindo agora: uma fonte com portão faltando é uma
   * function que ninguém vai conseguir deployar, e descobrir isso no dia da instalação da extensão é
   * tarde. Aqui o que ela custa é uma linha.
   */
  const gateFaults = gateProblems(office.sources);
  const gateFaultBy = new Map(gateFaults.map((fault) => [fault.name, fault.message]));
  if (gateFaults.length > 0) {
    warn(`${gateFaults.length} function(s) written in this installation act outside any office's`
      + ' installation:');
    bullets(gateFaults.map((fault) => fault.message));
    info('  each one is refused the moment this command tries to deploy IT — the others go up as');
    info('  usual, and a source sitting here for an extension nobody installed blocks nothing.');
    info('  Whatever is already in the air keeps acting on every office in this project.');
  }

  /**
   * A comum SEM declaração de quem serve. Ela continua subindo no `deploy`, sempre, e nada a retira — é
   * o comportamento anterior, mantido para não quebrar instalação nenhuma.
   *
   * O que muda é que ele deixa de ser invisível. Era esse o defeito: quem herdasse a instalação não tinha
   * como saber que aquelas functions estavam fora do mecanismo de retirada, e a única forma de descobrir
   * era um gatilho disparando anos depois de a última extensão que o usava ter saído.
   */
  if (office.unserved.length > 0) {
    blank();
    info(`  ${office.unserved.length} shared function(s) do not say which extensions they serve:`);
    bullets(office.unserved);
    info('  they go up with every "microteia deploy" and nothing here withdraws them — not even --prune.');
    info('  Name the extensions each one exists for in "microteia" -> "serves" in functions/package.json,');
    info('  and they are deployed only while one of those is installed, and removed when none is.');
  }

  if (misgated.length > 0) {
    warn('some extensions gate a trigger for an extension id that is not their own:');
    bullets(misgated.map(describeMisgated));
    info('  it is what a copied function leaves behind. The trigger deploys, fires on every write, and');
    info('  the handler never runs — the gate asks about an extension nobody installed. Fix the id in');
    info('  the forInstalledExtension call.');
  }

  if (problems.length > 0) {
    for (const claim of claims) {
      if (problems.some((problem) => problem.includes(claim.pluginId))) rejected.add(claim.pluginId);
    }
    // O dono de um portão errado é pendurado por IDENTIDADE, e não por o id dele aparecer no texto: a
    // mensagem cita DOIS ids, e casar por substring penduraria também a extensão cujo id foi copiado.
    for (const entry of misgated) rejected.add(entry.owner);
  }

  const valid = uniqueByPlugin(claims.filter((claim) => !rejected.has(claim.pluginId)));

  /**
   * O nome que uma reivindicação RECUSADA carrega. Ele não entra em `wantedFunctions` — não há como
   * deployá-lo —, mas também não pode virar órfão: a extensão que o pede continua instalada, e o que
   * falhou foi resolver a declaração dela. Sem esta lista, um export renomeado em
   * `extensions/<x>/functions/index.ts` fazia `--prune` apagar a function de uma extensão viva.
   */
  const unresolved = new Map<string, string>();
  for (const claim of claims) {
    if (!rejected.has(claim.pluginId)) continue;
    for (const name of claim.backend.functions ?? []) unresolved.set(name, claim.pluginId);
  }

  if (valid.length === 0) {
    info('  no installed extension asks for backend artifacts');
  } else {
    info(`  ${valid.length} extension(s) ask for backend artifacts:`);
    bullets(valid.map((claim) => `${claim.name} ${claim.version} (${claim.pluginId})`));
  }

  const settled = await settleIndexes(options, valid);

  /**
   * NÃO existe mais um desvio de "nenhuma extensão exige nada" aqui — e é a correção do defeito que
   * este comando tinha justamente no caso mais comum. Desinstalar a ÚLTIMA extensão com backend caía
   * naquele desvio, e o desvio devolvia antes do cálculo de órfã: a Cloud Function dela continuava no
   * ar para sempre, `--prune` não a alcançava, e a lista de aplicadas era regravada intacta. O sintoma
   * era um gatilho `onDocumentWritten` de uma extensão que ninguém tem mais, disparando sobre os dados
   * do escritório a cada gravação.
   *
   * O índice já havia sido salvo dessa mesma armadilha — foi por isso que `settleIndexes` subiu para
   * antes do desvio. A function ficou para trás, e a lição é que o desvio é que estava errado: o que
   * ele pulava não era "trabalho inútil", era a retirada.
   *
   * O que sobrou dele são duas guardas pontuais mais abaixo: não perguntar ao projeto o que ele roda
   * quando não há nada a conferir, e não anunciar que "as 0 functions já estão deployadas".
   */
  /**
   * A function COMUM que declara quem serve entra aqui, e é o que a tira da invisibilidade.
   *
   * Ela não tem dono que possa reivindicá-la — nenhuma extensão pode —, então ela ficava fora do
   * mecanismo por inteiro: nunca entrava no registro de aplicadas, nunca virava órfã, nunca era
   * relatada, e o `--prune` não a alcançava. Com a declaração, a pergunta passa a ter resposta: ela é
   * devida enquanto ALGUMA das extensões que ela serve estiver instalada em algum escritório do projeto.
   *
   * "Basta uma" é a única regra possível: a function existe porque mais de uma extensão precisa dela.
   * Exigir todas faria desinstalar uma desligar o backend das outras.
   */
  const sharedWanted = office.served.filter(
    (entry) => entry.serves.some((id) => survey.installedIds.has(id)),
  );
  const sharedWantedNames = new Set(sharedWanted.map((entry) => entry.name));

  const wantedFunctions = deployable.filter(
    (name) => sharedWantedNames.has(name)
      || valid.some((claim) => (claim.backend.functions ?? []).includes(name)),
  );

  /** Quem reivindica cada nome AGORA — é com este dono que o registro é reconciliado. */
  const owners = new Map<string, string>();
  for (const claim of valid) {
    for (const name of claim.backend.functions ?? []) owners.set(name, claim.pluginId);
  }
  // A comum tem VÁRIOS donos, e o registro guarda a lista declarada em vez de eleger um deles: é ela que
  // explica, meses depois, por que aquela function estava ali — e por que ela deixou de estar.
  for (const entry of sharedWanted) owners.set(entry.name, entry.serves.join('+'));

  const applied = parseAppliedFunctions(options.environment.backend.functions);
  const appliedNames = new Set(applied.map((entry) => entry.name));
  const classification = classifyApplied({
    applied,
    wanted: wantedFunctions,
    baseline: manifest.baselineFunctions ?? [],
    unresolved,
  });

  // Os do diretório comum entram: são eles que as functions comuns servidas carregam, e um parâmetro
  // que ninguém acompanha é um valor que nunca chega à function que o lê.
  const trackedParameters = [...new Set([
    ...claimedParameters(valid),
    ...(office.sources.find((source) => source.shared)?.parameters ?? []).map((p) => p.name),
  ])].sort();
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
      .filter((name) => wantedFunctions.includes(name) && appliedNames.has(name)),
  );

  /**
   * A comum que agora sobe pelo provisionamento também precisa voltar à fila quando um parâmetro muda.
   * Antes ela subia a cada `deploy`, e isso mascarava a pergunta.
   *
   * A granularidade é o DIRETÓRIO, e não a function: `functions/` declara os `defineString` num conjunto
   * só, sem dizer qual function lê qual. Redeployar todas as comuns servidas quando um parâmetro do
   * diretório muda erra para o lado de fazer o que é devido — o inverso deixaria uma delas rodando com o
   * valor antigo, que é o defeito que este mecanismo existe para fechar.
   */
  const sharedSource = office.sources.find((source) => source.shared);
  const sharedParameters = new Set((sharedSource?.parameters ?? []).map((parameter) => parameter.name));
  if (changed.some((name) => sharedParameters.has(name))) {
    for (const entry of sharedWanted) {
      if (appliedNames.has(entry.name)) staleFunctions.add(entry.name);
    }
  }

  /**
   * Uma pergunta só ao projeto, e duas decisões a partir dela: o que ele já roda, e qual cópia ficou
   * numa região abandonada. Perguntar duas vezes não é caro, é ambíguo — as duas respostas podem
   * divergir, e aí a decisão passa a depender de qual delas o código olhou.
   *
   * Ela é feita SEMPRE, e a versão anterior a pulava quando não havia function aplicada a conferir —
   * economia que custava exatamente o caso que mais importa. É a instalação sem extensão nenhuma que
   * precisa da pergunta: é ali que mora a function de uma extensão que saiu, e sem perguntar ao projeto
   * a resposta é o silêncio. A ida vale segundos; a alternativa é uma callable órfã que nenhum comando
   * menciona.
   */
  let asked: DeployedFunction[] | null | undefined;
  const projectFunctions = async (): Promise<DeployedFunction[] | null> => {
    if (asked === undefined) asked = await listDeployedFunctions(projectId);
    return asked;
  };

  // O que a lista de nomes nunca respondeu: a function aplicada que sumiu do projeto, e a que segue
  // lá carregando o carimbo de um código anterior. As duas voltam para a fila.
  const appliedAndWanted = wantedFunctions.filter((name) => appliedNames.has(name));
  const outdated: OutdatedFunctions = appliedAndWanted.length === 0
    ? { absent: [], stale: [] }
    : outdatedByStamp(appliedAndWanted, await projectFunctions(), region, options.refreshedStamps);
  for (const name of [...outdated.absent, ...outdated.stale]) staleFunctions.add(name);

  if (outdated.absent.length > 0) {
    blank();
    info(`  ${outdated.absent.length} function(s) recorded as applied are not running in this project:`);
    bullets(outdated.absent);
    info('  they are deployed again — the record is a list of names, and a name does not know what');
    info('  happened to the function after it went up.');
  }
  if (outdated.stale.length > 0) {
    blank();
    info(`  ${outdated.stale.length} function(s) still carry the code of a previous package:`);
    bullets(outdated.stale);
    info('  Firebase stamps every function with what it was built from, and theirs no longer matches');
    info('  what this package builds. They are deployed again.');
  }

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

  const queued = wantedFunctions.filter(
    (name) => options.all === true || !appliedNames.has(name) || staleFunctions.has(name),
  );

  /**
   * A recusa do portão, cobrada de quem está na fila — e só dela.
   *
   * Ela sai da fila em vez de derrubar o comando, e as duas metades disso importam. Sair da fila é o que
   * impede a function de ir para o ar agindo sobre escritório que não a instalou, que é o defeito
   * inteiro. Não derrubar é o que deixa o resto acontecer: as outras extensões recebem o backend delas,
   * os índices convergem, e `--prune` apaga a órfã. O comando termina em erro por causa dela, no fim,
   * quando já não há nada a atrapalhar.
   */
  const refused = queued.filter((name) => gateFaultBy.has(name));
  const toDeploy = queued.filter((name) => !gateFaultBy.has(name));
  if (refused.length > 0) {
    blank();
    failure(`${refused.length} function(s) are needed by an installed extension and cannot go up:`);
    bullets(refused.map((name) => gateFaultBy.get(name) ?? name));
    info('  they are the only ones held back. Fix the guard and run "microteia provision" again.');
    outcome.failed.push(...refused);
  }

  if (toDeploy.length === 0) {
    // Anunciar "as 0 functions já estão deployadas" seria o preço de ter tirado o desvio, e não é
    // preciso pagá-lo: quando não há exigência nenhuma, quem já falou foi a linha lá em cima.
    if (wantedFunctions.length > 0 && refused.length === 0) {
      success(`the ${wantedFunctions.length} function(s) these extensions need are already deployed`);
    }
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

    // A extensão que mudou de região deixa a cópia antiga para trás igual ao kernel, e ali o efeito
    // é o mesmo: deploy recusado em toda tentativa, e gatilho disparando em duas regiões.
    await clearRegionOrphans(projectId, toDeploy, region, options.prune, await projectFunctions());

    info(`  deploying ${toDeploy.length} function(s), one at a time…`);
    const report = await deployFunctionsOneByOne(toDeploy, {
      projectId, cwd: install, delaySeconds, force: false,
    });
    outcome.deployed = report.deployed;
    outcome.failed.push(...report.failed.map((entry) => entry.name));
    reportFailures(report.failed);
    reportNotices(report.notices);
    await checkNewCallables(
      [...(manifest.callables ?? []), ...office.callables],
      report.deployed,
      projectId,
      region,
    );
  }

  const deployedNow = new Set([...appliedNames, ...outcome.deployed]);
  for (const claim of valid) {
    const satisfied = (claim.backend.functions ?? []).every((name) => deployedNow.has(name));
    if (satisfied) {
      await stampApplied(projectId, claims, claim);
    } else {
      outcome.pending.push(claim);
    }
  }

  /**
   * O que o PROJETO roda, cruzado com o que esta instalação consegue justificar.
   *
   * O registro respondia sozinho por essa pergunta, e é um registro que se perde — e quando se perde,
   * some com ele a única memória de que aquela function existe. Perguntar ao projeto é o que fecha o
   * buraco: uma callable de extensão desinstalada, no ar, publicamente invocável, com o
   * `backend.functions` do `microteia.yaml` vazio, não era mencionada por comando nenhum.
   *
   * O limite está em `straysInProject`, e é o que torna isto seguro: só vira órfã o nome que ESTA
   * instalação sabe produzir. O que a órfã ganha aqui, além da remoção, é entrar no registro quando não
   * for removida — a partir da próxima execução ela é conhecida mesmo que o código-fonte dela saia do
   * disco.
   */
  const running = await projectFunctions();
  const stray = straysInProject({
    // A região é o filtro, e o ESTADO não é. Uma cópia em região abandonada tem endereço próprio
    // (`clearRegionOrphans`); já o estado só decide se dá para comparar carimbo — para existir no
    // projeto, basta estar na listagem. E o `functions:list` nem sempre traz o campo: exigir `ACTIVE`
    // deixaria a varredura cega em silêncio no dia em que ele viesse vazio.
    running: (running ?? []).filter((entry) => entry.region === region).map((entry) => entry.name),
    known: [...manifest.functions, ...office.all],
    justified: [
      ...wantedFunctions,
      // A baseline do PACOTE, com o mesmo fallback que o `deploy` usa para decidir o que subir. Um
      // `?? []` aqui faria toda function da plataforma virar órfã num pacote sem o campo.
      ...(manifest.baselineFunctions ?? manifest.functions),
      ...office.unserved,
      ...unresolved.keys(),
    ],
    recorded: applied.map((entry) => entry.name),
  });
  reportStrays(stray, running);

  reportPreserved(classification.preserved);
  const orphans = [...classification.orphans, ...stray.orphans];
  outcome.orphans = orphans.map((entry) => entry.name);
  const remaining = await settleOrphans(options, orphans, survey);

  await recordBackendState(
    options,
    appliedAfterRun({
      applied,
      wanted: wantedFunctions,
      deployed: outcome.deployed,
      keptOrphans: remaining,
      preserved: classification.preserved.map((item) => item.entry),
      owners,
    }),
    appliedParameterState({
      recorded: recordedDigests,
      current: currentDigests,
      changed,
      failed: outcome.failed,
      claims: valid,
    }),
    settled.declared,
  );
  reportOrphanIndexes(projectId, settled.orphans, options.prune);
  await publishResidue(projectId, remaining, settled.orphans, survey);

  return outcome;
};

/**
 * O que sobrou, devolvido ao banco para a aplicação poder mostrá-lo.
 *
 * A lista é a que sobra DEPOIS do `--prune`: o que ele apagou saiu, e o que ele não conseguiu apagar
 * fica — é o estado do projeto agora, e não o do começo da execução.
 *
 * Falhar aqui não derruba o comando, e a exceção é justificada: as functions e os índices já foram
 * aplicados, e o que ficou de fazer era um RELATO. Recusar o `provision` inteiro por causa dele mandaria
 * quem instala rodar de novo um comando que já terminou o trabalho. Mas o aviso é dito em voz alta —
 * calar deixaria a tela silenciosa parecendo "não há resíduo", que é a afirmação oposta.
 */
const publishResidue = async (
  projectId: string,
  functions: AppliedFunction[],
  indexes: FirestoreIndexSpec[],
  survey: InstalledSurvey,
): Promise<void> => {
  try {
    await writeBackendResidue(projectId, {
      scannedAt: new Date(),
      tenants: survey.tenants,
      extensions: survey.extensions,
      functions: functions.map((entry) => ({ name: entry.name, owner: entry.owner ?? '' })),
      indexes: indexes.map(describeIndex),
    });
  } catch (error) {
    warn('could not record what is left over where the application can show it:');
    info(`  ${error instanceof Error ? error.message : String(error)}`);
    info('  the artifacts above were applied. What did not happen is the Extensions screen learning');
    info('  about the leftovers — it keeps showing what the previous run recorded.');
  }
};

/**
 * O que o projeto tem de declarar de índice composto, e o que sobrou de uma extensão que saiu.
 *
 * A memória vem da RAIZ (`backend.indexes` do `microteia.yaml`), não do arquivo instalado: é o `unpack`
 * que apaga `.microteia/install/` inteiro, e o pacote traz apenas a baseline. Enquanto o único registro
 * era o arquivo de lá, trocar de kernel apagava a memória — e o `firebase deploy` seguinte oferecia
 * apagar do PROJETO o índice de toda extensão instalada, o que é uma consulta em produção por resposta
 * errada a uma pergunta feita no meio de um upgrade.
 *
 * O arquivo instalado entra na leitura só para ADOTAR o que uma execução anterior a este campo havia
 * declarado. Passada essa vez, ele é derivado daqui.
 */
const settleIndexes = async (
  options: ProvisionOptions,
  valid: InstalledClaim[],
): Promise<{ declared: FirestoreIndexSpec[]; orphans: FirestoreIndexSpec[] }> => {
  const baseline = options.manifest.baselineIndexes ?? [];
  const baselineKeys = new Set(baseline.map(indexKey));
  const file = await readIndexFile(options.install);

  const remembered = new Map<string, FirestoreIndexSpec>();
  for (const index of parseIndexState(options.environment.backend.indexes)) {
    remembered.set(indexKey(index), index);
  }
  for (const index of file.indexes) {
    if (!baselineKeys.has(indexKey(index))) remembered.set(indexKey(index), index);
  }

  const wanted = claimedIndexes(valid);
  const wantedKeys = new Set(wanted.map(indexKey));
  const orphans = [...remembered.values()].filter((index) => !wantedKeys.has(indexKey(index)));

  /**
   * O órfão CONTINUA declarado, a não ser que se peça `--prune`. Deixá-lo cair fora do arquivo é o que
   * fazia o `firebase` oferecer a exclusão dele; mantê-lo declarado custa nada (o índice já existe) e
   * torna a remoção um ato explícito. Com `--prune` ele sai do arquivo e da memória — e é a próxima
   * publicação de índices que oferece apagá-lo do projeto, com a pergunta feita na hora certa.
   */
  const declared = options.prune ? wanted : [...wanted, ...orphans];
  const convergence = convergeIndexes(file.indexes, baseline, declared);

  if (!convergence.changed) {
    if (wanted.length > 0) success('the composite indexes these extensions need are already declared');
    return { declared, orphans };
  }

  await writeIndexFile(options.install, { ...file, indexes: convergence.desired });

  if (convergence.missing.length === 0) return { declared, orphans };

  info(`  creating ${convergence.missing.length} composite index(es)…`);
  await run(
    FIREBASE_BIN,
    ['deploy', '--only', 'firestore:indexes', '--project', options.projectId],
    { cwd: options.install },
  );
  return { declared, orphans };
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
  const appliedAt = new Date();
  for (const copy of all.filter((entry) => entry.pluginId === claim.pluginId)) {
    if (backendFingerprint(copy.backend) !== fingerprint) continue;
    await patchMapField(projectId, copy.documentPath, 'backendState', {
      fingerprint: asString(fingerprint),
      appliedAt: asTimestamp(appliedAt),
    });
  }
  success(`${claim.name} is ready in ${projectId}`);
};

/**
 * O que ninguém exige e mesmo assim NÃO é órfã.
 *
 * Relatar é o ponto. As duas causas são configuração errada de um lado ou do outro, e o silêncio sobre
 * elas faria a próxima pessoa a abrir o `microteia.yaml` concluir que a lista está suja — e apagar à
 * mão exatamente o que estas linhas protegem.
 */
const reportPreserved = (preserved: PreservedFunction[]): void => {
  const baseline = preserved.filter((item) => item.reason === 'baseline');
  const unresolved = preserved.filter((item) => item.reason === 'unresolved');

  if (baseline.length > 0) {
    blank();
    warn(`${baseline.length} function(s) in this installation's record belong to the platform:`);
    bullets(baseline.map((item) => describeApplied(item.entry)));
    info('  every "microteia deploy" puts them up, extension or no extension, so nothing here removes');
    info('  them — not even --prune.');
  }

  if (unresolved.length > 0) {
    blank();
    warn(`${unresolved.length} function(s) belong to an extension whose declaration did not resolve:`);
    bullets(unresolved.map((item) => `${item.entry.name} — claimed by ${item.claimant}`));
    info('  the extension is still installed, so they are not orphans and nothing removes them.');
    info('  Fix what is reported above and run "microteia provision" again.');
  }
};

/**
 * O que a varredura do projeto achou, e que o registro não conhecia.
 *
 * As duas listas são ditas porque respondem a perguntas diferentes de quem lê. A órfã é uma decisão a
 * tomar — ela vai para `settleOrphans` logo abaixo, e sai com `--prune`. O estranho não é decisão
 * nenhuma: é um aviso de que o projeto Firebase tem inquilino que a Microteia não pôs ali, e dizer que
 * nada o toca vale mais do que o silêncio, porque o silêncio aqui parece "não há mais nada".
 */
const reportStrays = (stray: StrayFunctions, running: DeployedFunction[] | null): void => {
  if (running === null) {
    blank();
    warn('could not list what this project is running, so nothing was compared against it.');
    info('  a function left behind by an extension that is gone would not be found this run. The');
    info('  account needs permission to run "firebase functions:list".');
    return;
  }

  if (stray.orphans.length > 0) {
    blank();
    info(`  ${stray.orphans.length} function(s) are running in this project and this installation's`);
    info('  record does not mention them:');
    bullets(stray.orphans.map((entry) => entry.name));
    info('  this installation is what produces them, and nothing installed needs them — so they are');
    info('  treated as orphans below. A record is lost by a re-init, a restored backup, or a Console');
    info('  older than the field; the function it forgot stays in the air either way.');
  }

  if (stray.strangers.length > 0) {
    blank();
    info(`  ${stray.strangers.length} function(s) run in this project and did not come from this`);
    info('  installation:');
    bullets(stray.strangers);
    info('  nothing here touches them — not even --prune. A Firebase project can be shared, and');
    info('  deleting what Microteia did not put there is not this command\'s call.');
    info('  A function of yours lands here once its source is gone from this installation: run');
    info('  "microteia provision" BEFORE deleting extensions/<folder>/, and it is recognized.');
  }
};

/**
 * Function que nenhuma extensão instalada exige mais.
 *
 * A CERTEZA vem antes da remoção, e é dita em voz alta: a Cloud Function é do PROJETO e a instalação é
 * do ESCRITÓRIO, então "ninguém mais exige" é uma afirmação sobre TODOS os escritórios do projeto, e
 * não sobre o último que foi lido. A varredura é completa ou não existe — `listDocuments` pagina até o
 * fim e qualquer leitura recusada derruba o comando lá em cima —, e é o número dito aqui que permite a
 * quem lê conferir a afirmação em vez de acreditar nela.
 *
 * Apagar é destrutivo e irreversível, então o padrão RELATA e só `--prune` remove — e o que foi
 * removido sai da lista de aplicadas.
 */
const settleOrphans = async (
  options: ProvisionOptions,
  orphans: AppliedFunction[],
  survey: InstalledSurvey,
): Promise<AppliedFunction[]> => {
  if (orphans.length === 0) return [];

  blank();
  warn(`${orphans.length} function(s) are deployed and no installed extension needs them:`);
  bullets(orphans.map(describeApplied));
  info(`  read from every office in this project: ${survey.tenants} office(s), `
    + `${survey.extensions} installed extension(s).`);

  if (!options.prune) {
    // O custo mudou de descrição porque a descrição estava errada. Uma callable ociosa não custa nada;
    // um gatilho de Firestore não fica ocioso — ele segue disparando a cada gravação do escritório,
    // rodando o código de uma extensão que ninguém tem mais, e é esse efeito que faz a remoção valer
    // a pena antes de "algum dia".
    info('  a callable just sits there. A Firestore trigger does not: it keeps firing on every write,');
    info('  running the code of an extension nobody has any more. To remove them:');
    bullets(['microteia provision --prune']);
    blank();
    return orphans;
  }

  info(`  deleting ${orphans.length} orphan function(s)…`);
  const deleted = new Set<string>();
  for (const orphan of orphans) {
    try {
      await run(
        FIREBASE_BIN,
        ['functions:delete', orphan.name, '--project', options.projectId, '--region', options.region, '--force'],
        { cwd: options.install },
      );
      deleted.add(orphan.name);
    } catch {
      warn(`could not delete ${orphan.name}; it stays recorded as deployed`);
    }
  }
  success(`${deleted.size} orphan function(s) removed`);
  return orphans.filter((orphan) => !deleted.has(orphan.name));
};

/**
 * Índice órfão é RELATADO, nunca apagado às cegas: o `firebase deploy` não remove índice por conta, e a
 * API que remove pede o id GERADO do índice — apagar o errado custa uma consulta em produção, e listá-lo
 * custa três linhas de saída.
 *
 * O que mudou é que ele segue DECLARADO enquanto ninguém pedir o contrário. Antes ele caía fora do
 * arquivo, e a exclusão acabava sendo oferecida pelo `firebase` na publicação seguinte — uma pergunta
 * sobre a coleção de uma extensão, feita no meio de um upgrade, a quem está lendo saída de deploy.
 */
const reportOrphanIndexes = (
  projectId: string,
  orphans: FirestoreIndexSpec[],
  prune: boolean,
): void => {
  if (orphans.length === 0) return;

  blank();
  warn(`${orphans.length} composite index(es) belong to extensions that are no longer installed:`);
  bullets(orphans.map(describeIndex));

  if (!prune) {
    info('  they stay declared, so no deploy offers to delete them, and they cost only writes on the');
    info('  collections they cover. To let them go:');
    bullets(['microteia provision --prune']);
    blank();
    return;
  }

  warn('  --prune removed them from this installation, and nothing deleted them from the project:');
  info('  the delete API needs each index\'s generated id, and guessing wrong costs a query in');
  info('  production. The next index publish offers to delete them, and you answer it deliberately:');
  bullets([
    'microteia deploy --only indexes',
    `gcloud firestore indexes composite list --project=${projectId}`,
  ]);
  blank();
};

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
  applied: AppliedFunction[],
  parameters: Map<string, string>,
  indexes: FirestoreIndexSpec[],
): Promise<void> => {
  const state = serializeIndexState(indexes);

  /**
   * Índice que a codificação não representa sem ambiguidade fica de fora COM AVISO, em vez de voltar do
   * arquivo virado noutro índice. Só acontece com nome de coleção ou de campo que contenha um dos
   * separadores, o que exigiria acento grave no caminho do campo — e "só aconteceria" é como um defeito
   * silencioso começa.
   */
  if (state.skipped.length > 0) {
    warn(`${state.skipped.length} composite index(es) cannot be remembered across a kernel upgrade:`);
    bullets(state.skipped.map(describeIndex));
    info('  a collection or field name uses one of the separators. Rename it, or a future');
    info('  "microteia deploy" will offer to delete the index.');
  }

  await writeEnvironment(options.environmentFile, {
    ...options.environment,
    backend: {
      functions: serializeAppliedFunctions(applied),
      parameters: serializeParameterState(parameters),
      indexes: state.value,
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
  /**
   * Quem recusa não haver pacote no lugar é o `readInstalledManifest` abaixo, e com o comando que falta.
   * A pergunta aqui é outra: houve deploy? Provisionar sobe a function de uma EXTENSÃO, e fazer isso
   * contra um projeto que nunca recebeu o kernel entrega uma extensão pendurada num backend que não
   * existe.
   *
   * É aviso e não recusa porque uma instalação anterior ao campo `deployed` não tem como provar que foi
   * publicada — e recusar por falta de prova impediria de provisionar uma instalação que está no ar.
   */
  if (environment.kernel.deployed === null) {
    warn('there is no record of a kernel deploy in this installation.');
    info('  if this project has never had one, run "microteia deploy" first: provisioning gives the');
    info('  installed extensions their backend, not the platform itself.');
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
    all: hasFlag(args, 'all'),
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
