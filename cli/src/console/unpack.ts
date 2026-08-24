import { access, cp, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { flagValue, hasFlag, requiredFlag } from '../shared/args.js';
import type { ParsedArgs } from '../shared/args.js';
import { CLI_VERSION } from '../shared/paths.js';
import { run } from '../shared/run.js';
import { blank, bullets, heading, info, success, warn } from '../shared/ui.js';
import { compareVersions } from '../kernel/manifest.js';
import type { KernelManifest } from '../kernel/manifest.js';
import { ENVIRONMENT_FILE, readEnvironment, writeEnvironment } from './environment.js';
import { describeIndex, parseIndexState, restoreDeclaredIndexes } from './backendIndexes.js';
import { refreshAuthoringWorkspace } from './pluginWorkspace.js';
import { workspacePath } from './workspace.js';
import { ensureOfficeEnv, ensureRootGitignore, officeEnvName } from './backendEnv.js';
import { readOfficeFunctions } from './customFunctions.js';
import {
  INSTALLATION_GUIDE,
  INSTALLATION_README,
  installationGuide,
  installationReadme,
} from '../vendor/installationDocs.js';
import { refreshChangelogs } from '../vendor/changelogs.js';
import { fetchKernel } from './channel.js';

/**
 * `microteia unpack` — põe o pacote em `.microteia/install`, e nada mais.
 *
 * Era um passo dentro do `deploy`, e juntar os dois custava duas coisas. A primeira é que trocar de
 * kernel obrigava a publicar tudo: quem quisesse só o hosting — porque functions, rules e índices não
 * mudaram naquela versão — não tinha como pedir isso, já que o `--only` vinha depois da troca do
 * pacote no mesmo comando. A segunda é que não havia momento entre "o pacote chegou" e "o pacote foi
 * publicado" para PREENCHER as configurações que o pacote declara — e é justamente esse o momento em
 * que se descobre que existe um parâmetro novo.
 *
 * Separado, o fluxo é: `unpack` traz o kernel e escreve o que faltar no `.env.<projectId>` da raiz;
 * quem instala preenche o que precisa; `deploy --only …` publica o que interessa.
 *
 * Não toca no Firebase. É seguro rodar a qualquer momento.
 */

/**
 * O que sobrevive à troca do kernel dentro de `.microteia/`.
 *
 * `functions/node_modules` é o que evita reinstalar ~250 pacotes a cada upgrade — é cache, não conteúdo.
 * `functions/custom` NÃO está mais aqui: ele passou a ser DERIVADO, montado no deploy a partir de
 * `functions/` e `extensions/<plugin>/functions/`, que ficam fora de `.microteia/`. Uma exceção a menos
 * nesta lista é uma coisa a menos que depende de alguém não mexer nela.
 */
const PRESERVED = ['functions/node_modules'];

const exists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

/**
 * Leva o que sobrevive ao upgrade para o staging — MOVENDO, não copiando.
 *
 * Copiar estourava o limite de descritores do processo no macOS: o único item preservado é
 * `functions/node_modules`, que são ~250 pacotes e dezenas de milhares de arquivos, e o `cp` recursivo
 * abre muitos ao mesmo tempo. O sintoma era intermitente e ilegível — `ENFILE: file table overflow`
 * apontando um diretório qualquer de dentro do `@google-cloud/firestore` —, e o mesmo comando passava
 * na tentativa seguinte.
 *
 * Mover é estritamente melhor, e não só por causa disso: a origem é apagada três linhas abaixo, então
 * a cópia nunca teve para que existir. O que era proporcional ao tamanho do `node_modules` passou a ser
 * uma operação só.
 *
 * O `cp` fica como recurso para o único caso em que `rename` não pode funcionar: origem e destino em
 * sistemas de arquivos diferentes (`EXDEV`). Aqui os dois estão sob `.microteia/`, então é caminho
 * morto — e é justamente por isso que ele não pode ser a via normal.
 */
const preserve = async (from: string, to: string): Promise<void> => {
  try {
    await rename(from, to);
  } catch (error) {
    if ((error as { code?: string }).code !== 'EXDEV') throw error;
    await cp(from, to, { recursive: true });
  }
};

export const installPath = (root: string): string => join(workspacePath(root), 'install');

const stagingPath = (root: string): string => join(workspacePath(root), 'staging');

/**
 * O Console que o pacote exige. Vale para o pacote que ACABOU de ser extraído e para o que já está no
 * lugar, e por isso não mora em nenhum dos dois.
 */
const assertConsoleCanInstall = (manifest: KernelManifest): void => {
  if (compareVersions(CLI_VERSION, manifest.minimumCliVersion) < 0) {
    throw new Error(
      `This package needs Microteia Console ${manifest.minimumCliVersion} or newer; this is ${CLI_VERSION}.\n`
      + 'Update it with "npm i -g @microteia/console".',
    );
  }
};

/**
 * Lê o manifesto do pacote já desempacotado, recusando com o comando que falta em vez do `ENOENT` cru.
 * É a porta pela qual o `deploy` descobre que não há o que publicar.
 */
export const readInstalledManifest = async (root: string): Promise<KernelManifest> => {
  const path = join(installPath(root), 'manifest.json');
  if (!await exists(path)) {
    throw new Error(
      'No unpacked Microteia package found in this installation.\n'
      + 'Run "microteia unpack --version latest" first.',
    );
  }

  const manifest = JSON.parse(await readFile(path, 'utf8')) as KernelManifest;
  assertConsoleCanInstall(manifest);
  return manifest;
};

/**
 * Extrai para o `staging`, e só isso. A instalação anterior fica INTACTA.
 *
 * Extrair e trocar era um passo só, e a troca vinha antes de o manifesto ser lido — então um pacote que
 * exige um Console mais novo apagava o `install/` da versão que funcionava e só depois recusava,
 * deixando a instalação sem kernel nenhum. Enquanto o tarball chegava à mão isso era raro; com o
 * `--version` lendo o canal, um Console desatualizado encontra um pacote novo na primeira tentativa.
 */
const stage = async (tarball: string, root: string): Promise<string> => {
  const staging = stagingPath(root);

  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });
  await run('tar', ['-xzf', tarball, '-C', staging]);

  return staging;
};

/** O manifesto do que foi extraído, conferido ANTES de a instalação anterior ser tocada. */
const readStagedManifest = async (staging: string): Promise<KernelManifest> => {
  const path = join(staging, 'manifest.json');
  if (!await exists(path)) {
    throw new Error(
      'This file does not look like a Microteia package: it carries no manifest.json.',
    );
  }

  const manifest = JSON.parse(await readFile(path, 'utf8')) as KernelManifest;
  assertConsoleCanInstall(manifest);
  return manifest;
};

/**
 * Troca o pacote, preservando o que é do escritório. O pacote é substituído por inteiro — é isso que faz
 * o upgrade ser confiável —, então o que não pode ser perdido é movido de volta explicitamente, em vez
 * de o extrator "mesclar" por cima e deixar restos da versão anterior.
 *
 * A partir daqui não há como voltar atrás, e é por isso que tudo o que pode recusar já recusou.
 */
const commit = async (root: string, staging: string): Promise<string> => {
  const install = installPath(root);

  for (const relative of PRESERVED) {
    const previous = join(install, relative);
    if (!await exists(previous)) continue;

    await rm(join(staging, relative), { recursive: true, force: true });
    await preserve(previous, join(staging, relative));
    info(`  kept ${relative} from the previous install`);
  }

  await rm(install, { recursive: true, force: true });
  await rename(staging, install);
  return install;
};

/** As extensões de exemplo que este pacote carrega, para o guia listá-las. */
const exampleIds = async (install: string): Promise<string[]> => {
  try {
    const entries = await readdir(join(install, 'sdk', 'examples'), { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  } catch {
    return [];
  }
};

/**
 * De onde o pacote vem — e as duas formas existem por razões diferentes.
 *
 * `--version` é o caminho normal: o Console lê o catálogo, baixa e confere. `--kernel` é o caminho de
 * quem tem o arquivo — rede fechada, entrega por outro meio, um pacote que ainda não foi publicado — e
 * ele não é legado: enquanto instalar depender de um download, uma máquina sem acesso ao catálogo não
 * consegue instalar nada, e isso é uma dependência que não vale a pena ter.
 */
type KernelSource = { kind: 'file'; path: string } | { kind: 'channel'; version: string };

const kernelSource = (args: ParsedArgs): KernelSource => {
  const path = flagValue(args, 'kernel');
  const version = flagValue(args, 'version');

  if (path !== undefined && version !== undefined) {
    throw new Error('Pass either --version or --kernel, not both: they are two ways to name one package.');
  }
  if (path !== undefined) return { kind: 'file', path: resolve(path) };
  if (version !== undefined) return { kind: 'channel', version };

  // Uma bandeira sem valor é erro de digitação, e dizer "falta --version" a quem acabou de escrever
  // `--version` manda a pessoa procurar o problema onde ele não está.
  if (hasFlag(args, 'version')) {
    throw new Error('--version needs a number, or the word "latest".');
  }
  if (hasFlag(args, 'kernel')) {
    throw new Error('--kernel needs the path to a package file.');
  }

  throw new Error(
    'Missing --version or --kernel.\n'
    + '  microteia unpack --version latest        takes the newest published version\n'
    + '  microteia unpack --version 9.8.2         takes one exact version\n'
    + '  microteia unpack --kernel <package>.tgz  takes a file you already have',
  );
};

export const unpack = async (args: ParsedArgs): Promise<void> => {
  const file = resolve(hasFlag(args, 'file') ? requiredFlag(args, 'file') : join(process.cwd(), ENVIRONMENT_FILE));
  const root = dirname(file);
  const source = kernelSource(args);

  const environment = await readEnvironment(file);
  const projectId = environment.firebase.projectId;

  heading(`Unpacking Microteia into ${environment.project.name}`);

  const tarball = source.kind === 'file'
    ? source.path
    : (await fetchKernel(source.version)).path;

  /**
   * Extrair, conferir, e só então trocar. A recusa limpa o `staging` que abriu: 7 MB extraídos que
   * ninguém vai usar são lixo, e deixá-los sugere que algo foi instalado.
   */
  const staging = await stage(tarball, root);
  const manifest = await readStagedManifest(staging).catch(async (error: unknown) => {
    await rm(staging, { recursive: true, force: true });
    throw error;
  });
  const install = await commit(root, staging);

  const baselineCount = (manifest.baselineFunctions ?? manifest.functions).length;
  success(
    `kernel ${manifest.version} (contract ${manifest.kernelVersion}), ${baselineCount} baseline function(s)`
    + `, ${manifest.functions.length - baselineCount} claimed by extensions`,
  );

  if (manifest.sdk !== undefined) {
    info(`  authoring SDK ${manifest.sdk.version} included — see "microteia plugin-init"`);
  }

  /**
   * O `microteia.yaml` passa a dizer o que está no lugar, e é AQUI que ele é gravado. Ele só era
   * escrito no fim do `deploy`, então entre desempacotar e publicar o arquivo anunciava a versão
   * anterior — e o `MICROTEIA.md`, reescrito três linhas abaixo, já anunciava a nova. Duas fontes
   * no mesmo diretório discordando é o tipo de coisa que se descobre pela dúvida de alguém.
   *
   * `deployed` fica para o `deploy`. Numa instalação anterior a este campo ele nasce do `version` que
   * estava lá: aquele número foi gravado por um `deploy`, então é o que já foi publicado — sem isso, o
   * `provision` diria "nenhum kernel publicado" a uma instalação que está no ar.
   */
  const deployed = environment.kernel.deployed ?? environment.kernel.version;
  await writeEnvironment(file, {
    ...environment,
    kernel: { version: manifest.version, deployed },
  });
  success(`recorded kernel ${manifest.version} in ${ENVIRONMENT_FILE}`);
  if (deployed !== null && deployed !== manifest.version) {
    info(`  ${deployed} is still what the project runs — "microteia deploy" is what changes that`);
  }

  /**
   * E os índices das extensões voltam ao arquivo que acabou de ser substituído.
   *
   * O pacote traz só a baseline: o que uma extensão reivindica sai dela no `pack`, para não viajar até
   * quem não instalou a extensão. Como este comando apaga `install/` inteiro, sem este passo o arquivo
   * volta à baseline e a publicação de índices seguinte acha no projeto índices que o arquivo não
   * declara — e PERGUNTA se pode apagá-los, no meio de um upgrade.
   *
   * Quem apaga é quem repara, e antes de qualquer comando poder publicar o arquivo incompleto.
   */
  const recorded = parseIndexState(environment.backend.indexes);
  if (recorded.length > 0) {
    const restored = await restoreDeclaredIndexes(install, manifest.baselineIndexes ?? [], recorded);
    success(`kept ${recorded.length} composite index(es) of installed extensions in firestore.indexes.json`);
    if (restored.length > 0) {
      info('  this package does not declare them, and publishing indexes would have offered to');
      info('  delete them from the project:');
      bullets(restored.map(describeIndex));
    }
  }

  // A região é do PACOTE, não do arquivo: as Cloud Functions são compiladas com ela fixa.
  if (projectId !== null && environment.firebase.region !== manifest.requires.functionsRegion) {
    warn(
      `this package is compiled for region ${manifest.requires.functionsRegion}; `
      + `the installation recorded ${environment.firebase.region}.`,
    );
  }

  // Os dois documentos da raiz. O `MICROTEIA.md` é reescrito sempre — é o que permite a ele carregar os
  // números DESTE pacote em vez de uma cópia deles. O `README.md` nasce e nunca é tocado: é do escritório.
  const examples = await exampleIds(install);
  await writeFile(join(root, INSTALLATION_GUIDE), installationGuide(environment.project.name, manifest, examples));
  success(`wrote ${INSTALLATION_GUIDE}`);

  if (!await exists(join(root, INSTALLATION_README))) {
    await writeFile(join(root, INSTALLATION_README), installationReadme(environment.project.name));
    success(`created ${INSTALLATION_README} — it is yours, and nothing rewrites it`);
  }

  /**
   * E os dois históricos técnicos, sobrepostos pela mesma razão que o `MICROTEIA.md`: eles prometem
   * estar atuais.
   *
   * Cada um vem do artefato que ele descreve — o do kernel de dentro do pacote, o do Console do binário
   * que está rodando. É o que impede qualquer um dos dois de falar de uma versão que não está aqui, e
   * era exatamente o que acontecia com os guias de `extensions/` enquanto o Console os escrevia.
   *
   * A ausência avisa e não interrompe: num pacote anterior a esta capacidade o do kernel não existe, e
   * trocar de kernel não pode falhar por causa de um documento.
   */
  const changelogs = await refreshChangelogs(root, install);
  if (changelogs.written.length > 0) success(`wrote ${changelogs.written.join(' and ')}`);
  for (const name of changelogs.missing) {
    warn(`this package carries no ${name}, so the previous one was left in place`);
  }

  /**
   * E o diretório de autoria, se ele existir — pela MESMA razão que o `MICROTEIA.md` é reescrito aqui.
   *
   * O que há em `extensions/` além das extensões do escritório é documentação do que o kernel sabe
   * fazer, e ela era escrita uma única vez, pelo `plugin-init`. Trocava-se de kernel e ela continuava
   * descrevendo o contrato anterior — para o autor e para a IA que a lê como instrução —, sem nada
   * reprovar, porque nada comparava. Vem antes do retorno de instalação não conectada de propósito:
   * escrever extensão não depende de haver projeto Firebase.
   */
  await refreshAuthoringWorkspace(root, environment.project.name);

  blank();

  if (projectId === null) {
    info('This installation is not connected to a Firebase project yet.');
    bullets(['microteia connect --project <firebase-project-id>', 'microteia deploy']);
    blank();
    return;
  }

  const gitignore = await ensureRootGitignore(root);
  if (gitignore === 'created') success('created .gitignore');
  else if (gitignore === 'appended') success('added ".env.*" to .gitignore — the settings file is a credential');

  /**
   * Os parâmetros do PACOTE mais os que as functions do escritório declaram. A união importa porque o
   * `firebase-functions` valida os `defineString` globalmente: um parâmetro sem linha no arquivo recusa
   * o deploy de todas as functions, e não só das que o leem.
   *
   * A leitura é tolerante de propósito. Este comando é o que troca de kernel, e um diretório de function
   * pela metade — ninguém escreve o `index.ts` primeiro — não pode impedir um upgrade que nada tem com
   * ele. Quem RECUSA por isso é o `deploy`, no momento em que a montagem de fato importa.
   */
  const office = await readOfficeFunctions(root).catch((error: unknown) => {
    warn(`could not read your own Cloud Functions: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`);
    info('  their settings are not listed below. "microteia deploy" refuses until this is fixed.');
    return { parameters: [] as typeof manifest.backendParameters };
  });

  const settings = await ensureOfficeEnv(
    root,
    projectId,
    [...manifest.backendParameters, ...office.parameters],
  );

  if (settings.created) {
    success(`created ${officeEnvName(projectId)} with ${settings.added.length} setting(s), all empty`);
  } else if (settings.added.length > 0) {
    success(`added ${settings.added.length} new setting(s) to ${officeEnvName(projectId)}: ${settings.added.join(', ')}`);
  } else {
    info(`${officeEnvName(projectId)} already declares every setting this package needs`);
  }

  blank();
  info('Next:');
  bullets([
    `fill in what you need in ${officeEnvName(projectId)} (optional features stay empty)`,
    'microteia deploy                                  (everything)',
    'microteia deploy --only hosting                   (just the application)',
    'microteia deploy --only rules,indexes,functions   (just the backend)',
  ]);
  blank();
};
