import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import type { Interface } from 'node:readline/promises';
import { flagValue, hasFlag } from '../shared/args.js';
import type { ParsedArgs } from '../shared/args.js';
import { blank, bullets, heading, info, success, warn } from '../shared/ui.js';
import { run } from '../shared/run.js';
import { ENVIRONMENT_FILE, readEnvironment } from './environment.js';
import { WORKSPACE_DIR } from './workspace.js';
import {
  SDK_TARBALL,
  isValidNamespace,
  isValidPrefix,
  suggestPrefix,
  workspacePackageJson,
} from '../vendor/pluginWorkspaceTemplates.js';
import type { WorkspaceIdentity } from '../vendor/pluginWorkspaceTemplates.js';

/**
 * `microteia plugin-init` — prepara `extensions/`, onde o escritório escreve extensão em TypeScript.
 *
 * Não é um deploy e não toca no projeto Firebase: escreve uma semente, chama o `npm` e delega o resto
 * ao SDK. É deliberadamente o mesmo desenho de `functions/custom/`: o diretório fica FORA de
 * `.microteia/`, é do escritório, e o upgrade não o toca.
 *
 * O que este comando NÃO faz mais é escrever documentação. `AGENTS.md`, `AUTHORING.md`, `tsconfig.json`
 * e `.mcp.json` descrevem o que o kernel sabe fazer, e por isso saem do SDK — que viaja no mesmo pacote
 * que aquelas capacidades. Enquanto saíam daqui, ficavam parados na versão do Console que rodou uma vez,
 * meses antes, e ninguém tinha como notar.
 */

export const EXTENSIONS_DIR = 'extensions';

/** O binário do SDK, dentro do próprio workspace. Ver `workspaceMcpJson` para o porquê de não ser `npx`. */
const SDK_CLI = 'node_modules/@microteia/sdk/lib/sdk/node/cli.js';

const exists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

interface KernelSdkInfo {
  version: string;
  kernelVersion: string;
  path: string;
}

interface PackagedManifest {
  version: string;
  kernelVersion: string;
  sdk?: { version: string; kernelVersion: string; path: string };
}

/**
 * Acha o SDK no pacote desempacotado. O manifesto o declara desde a versão que passou a carregá-lo; um
 * pacote anterior a ela não tem SDK, e dizer isso é melhor que escrever um `package.json` apontando
 * para um caminho que não existe.
 */
const locateSdk = async (root: string): Promise<KernelSdkInfo> => {
  const installDir = join(root, WORKSPACE_DIR, 'install');
  const manifestPath = join(installDir, 'manifest.json');

  if (!await exists(manifestPath)) {
    throw new Error('No installed Microteia package found. Run "microteia unpack --version latest" first.');
  }

  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as PackagedManifest;
  const sdkDir = join(installDir, 'sdk');

  if (manifest.sdk === undefined || !await exists(join(sdkDir, SDK_TARBALL))) {
    throw new Error(
      `The installed package (${manifest.version}) does not carry the authoring SDK.\n`
      + 'Install a newer Microteia package, then run this again.',
    );
  }

  return {
    version: manifest.sdk.version,
    kernelVersion: manifest.sdk.kernelVersion,
    path: join(sdkDir, SDK_TARBALL),
  };
};

/**
 * Traz o SDK do pacote instalado e manda ELE reescrever o que é gerado no diretório.
 *
 * Os três passos são um só movimento, e a ordem é o que faz cada um valer:
 *
 * 1. `npm install <tarball>` pelo CAMINHO. Um `npm install` puro diria "up to date": o caminho não leva
 *    versão e o lock guarda a impressão digital do anterior — era assim que um escritório passava meses
 *    compilando contra um contrato que a instalação já não tinha.
 * 2. `microteia-plugin sync`, do SDK que acabou de chegar. É ele que sabe o que o kernel faz.
 * 3. `npm install`, porque o passo 2 pode ter acrescentado uma devDependency que o kernel novo exige.
 *
 * Duas decisões do passo 1 vêm de teste, não de leitura, e sem elas o movimento se desfaz sozinho:
 *
 * - **Sem `--no-save`.** Com ele o pacote NOVO é extraído e o `package-lock.json` fica no anterior — e
 *   aí o passo 3 reinstala o antigo, silenciosamente, desfazendo o passo 1. Pior: mesmo sem o passo 3,
 *   o próximo `npm install` que alguém rodasse faria a mesma reversão. Salvar é o que casa lock e
 *   `node_modules`.
 * - **Caminho RELATIVO ao diretório.** O `npm` reescreve a dependência com o caminho que recebeu; um
 *   absoluto entraria no `package.json`, e o motivo de ele ser relativo é a instalação poder ser movida
 *   ou versionada. Sendo relativo, a linha sai idêntica à que já estava lá.
 *
 * Usado pelo `plugin-init` e pelo `unpack` — o mesmo caminho, para que não exista um "init" que faz uma
 * coisa e um "upgrade" que faz outra.
 */
export const syncAuthoringWorkspace = async (
  directory: string,
  sdkPath: string,
  installDir: string,
  officeName: string,
): Promise<void> => {
  const tarball = relative(directory, sdkPath);
  await run('npm', ['install', '--no-audit', '--no-fund', tarball], { cwd: directory });
  await run('node', [SDK_CLI, 'sync', '--install', installDir, '--office', officeName], { cwd: directory });
  await run('npm', ['install', '--no-audit', '--no-fund'], { cwd: directory });
};

/**
 * Depois de trocar de kernel, põe `extensions/` em dia — se ele existir. Chamado pelo `unpack`.
 *
 * A falha aqui NÃO derruba o comando. Trocar de kernel é a operação principal, e um `npm` sem rede não
 * pode impedi-la: o pior resultado possível é uma instalação pela metade porque a documentação de um
 * diretório opcional não pôde ser reescrita. O aviso diz o comando que resolve.
 */
export const refreshAuthoringWorkspace = async (root: string, officeName: string): Promise<boolean> => {
  const directory = join(root, EXTENSIONS_DIR);
  if (!await exists(join(directory, 'package.json'))) return false;

  const installDir = join(root, WORKSPACE_DIR, 'install');
  try {
    const sdk = await locateSdk(root);
    await syncAuthoringWorkspace(directory, sdk.path, installDir, officeName);
    success(`${EXTENSIONS_DIR}/ is on the new contract (${sdk.kernelVersion})`);
    return true;
  } catch (error: unknown) {
    warn(`could not update ${EXTENSIONS_DIR}/: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`);
    info(`  run "npm run sdk:refresh" in ${EXTENSIONS_DIR}/ — until then its guides describe the previous contract.`);
    return false;
  }
};

/**
 * O que um `--force` anterior deixou gravado: reescrever a semente não é motivo para perguntar de novo —
 * e o prefixo, uma vez usado, não pode mudar.
 */
const existingIdentity = async (directory: string): Promise<Partial<WorkspaceIdentity>> => {
  try {
    const pkg = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8')) as {
      microteia?: { namespace?: unknown; publisher?: unknown; prefix?: unknown };
    };
    const { namespace, publisher, prefix } = pkg.microteia ?? {};
    return {
      ...(typeof namespace === 'string' && isValidNamespace(namespace) ? { namespace } : {}),
      ...(typeof publisher === 'string' && publisher.trim() !== '' ? { publisher: publisher.trim() } : {}),
      ...(typeof prefix === 'string' && isValidPrefix(prefix) ? { prefix } : {}),
    };
  } catch {
    return {};
  }
};

const invalidNamespace = (namespace: string): Error => new Error(
  `"${namespace}" is not a valid namespace. Use reverse-DNS, lowercase, from a domain your organization`
  + ' controls — for example: --namespace com.acme',
);

const invalidPrefix = (prefix: string): Error => new Error(
  `"${prefix}" is not a valid prefix. Use 2 to 8 lowercase letters or digits, starting with a letter`
  + ' — for example: --prefix acme',
);

type Ask = (label: string, suggestion?: string) => Promise<string>;

/** Com sugestão, Enter a aceita — é o que torna a sugestão uma resposta, e não só um exemplo. */
const asker = (rl: Interface): Ask => async (label, suggestion) => {
  const answer = (await rl.question(suggestion === undefined ? `${label}: ` : `${label} [${suggestion}]: `)).trim();
  return answer === '' && suggestion !== undefined ? suggestion : answer;
};

/**
 * Namespace, publisher e prefix — os três valem para TODA extensão do diretório, e por isso são
 * perguntados aqui, uma vez, e não no primeiro `create`: quem chegava a ele de um agente via o prefixo
 * ser escolhido por quem não podia escolhê-lo.
 *
 * O namespace é OBRIGATÓRIO e não tem padrão: qualquer padrão seria um prefixo que não é do escritório,
 * e o id que nasce dele é permanente. Sem terminal, só a flag o responde. Publisher e prefix, sem
 * terminal e sem flag, ficam para o `create` — que já sabe perguntá-los.
 */
const resolveIdentity = async (args: ParsedArgs, directory: string, officeName: string): Promise<WorkspaceIdentity> => {
  const stored = await existingIdentity(directory);
  const given = {
    namespace: flagValue(args, 'namespace')?.trim() ?? stored.namespace,
    publisher: flagValue(args, 'publisher')?.trim() ?? stored.publisher,
    prefix: flagValue(args, 'prefix')?.trim() ?? stored.prefix,
  };
  if (given.namespace !== undefined && !isValidNamespace(given.namespace)) throw invalidNamespace(given.namespace);
  if (given.prefix !== undefined && !isValidPrefix(given.prefix)) throw invalidPrefix(given.prefix);
  if (given.publisher === '') throw new Error('The publisher cannot be empty — for example: --publisher "Acme Legal"');

  if (!process.stdin.isTTY) {
    if (given.namespace === undefined) {
      throw new Error(
        'A namespace is required: every extension written in this directory is named below it, and its ids\n'
        + 'are permanent. Pass it with --namespace, for example: microteia plugin-init --namespace com.acme',
      );
    }
    return { namespace: given.namespace, publisher: given.publisher, prefix: given.prefix };
  }

  if (given.namespace !== undefined && given.publisher !== undefined && given.prefix !== undefined) {
    return { namespace: given.namespace, publisher: given.publisher, prefix: given.prefix };
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = asker(rl);
  try {
    let namespace = given.namespace;
    if (namespace === undefined) {
      blank();
      info('NAMESPACE — every extension written here is named below it: "billing" becomes com.acme.billing.');
      info('Use the reverse-DNS of a domain your organization controls. The ids are permanent, so choose one');
      info('that is yours.');
      namespace = await ask('namespace');
      if (!isValidNamespace(namespace)) throw invalidNamespace(namespace);
    }

    let publisher = given.publisher;
    if (publisher === undefined) {
      blank();
      info('PUBLISHER — who answers for these extensions. It is shown as the author of each one on the');
      info('Extensions screen of every office that installs it. A name, not an id.');
      publisher = await ask('publisher', officeName);
      if (publisher === '') throw new Error('The publisher cannot be empty.');
    }

    let prefix = given.prefix;
    if (prefix === undefined) {
      blank();
      info('PREFIX — starts every name your extensions create: acme_clients for a collection, acme-notify for');
      info('an automation. It keeps two publishers who both pick "clients" from colliding in the same office.');
      info('2 to 8 lowercase letters or digits. It never changes: a new prefix would rename the collections');
      info('and leave their records behind. The suggestion comes from the namespace.');
      prefix = await ask('prefix', suggestPrefix(namespace));
      if (!isValidPrefix(prefix)) throw invalidPrefix(prefix);
    }

    blank();
    return { namespace, publisher, prefix };
  } finally {
    rl.close();
  }
};

export const pluginInit = async (args: ParsedArgs): Promise<void> => {
  const file = resolve(flagValue(args, 'file') ?? join(process.cwd(), ENVIRONMENT_FILE));
  const root = dirname(file);
  const environment = await readEnvironment(file);

  const directory = resolve(flagValue(args, 'dir') ?? join(root, EXTENSIONS_DIR));
  const force = hasFlag(args, 'force');

  if (await exists(join(directory, 'package.json')) && !force) {
    throw new Error(
      `${relative(root, directory)}/package.json already exists.\n`
      + 'Nothing to do: "microteia unpack" keeps its generated files up to date, and "npm run sync"\n'
      + 'in that directory does it by hand. Use --force only to rewrite the seed itself.',
    );
  }

  const sdk = await locateSdk(root);
  const installDir = join(root, WORKSPACE_DIR, 'install');
  heading(`Extension authoring for "${environment.project.name}"`);

  const identity = await resolveIdentity(args, directory, environment.project.name);
  const { namespace } = identity;

  await mkdir(directory, { recursive: true });

  // O caminho do tarball é relativo, para que o diretório continue válido se a instalação inteira for
  // movida — o que acontece assim que alguém a versiona num repositório do escritório.
  await writeFile(
    join(directory, 'package.json'),
    workspacePackageJson(environment.environment.id, relative(directory, sdk.path), identity),
  );
  success(`wrote the seed package.json (namespace ${namespace}`
    + `${identity.publisher === undefined ? '' : `, publisher "${identity.publisher}"`}`
    + `${identity.prefix === undefined ? '' : `, prefix ${identity.prefix}`})`);
  if (identity.publisher === undefined || identity.prefix === undefined) {
    info('  publisher and prefix not given — "npm run create" asks for them once, and records them there.');
  }

  blank();
  info('Installing @microteia/sdk and writing the guides...');
  await syncAuthoringWorkspace(directory, sdk.path, installDir, environment.project.name);

  blank();
  info(`Extension authoring ready in ${relative(root, directory)}/ (kernel contract ${sdk.kernelVersion}).`);
  info(`Every extension created there is ${namespace}.<name> — recorded in package.json, under microteia.`);
  bullets([
    `cd ${relative(process.cwd(), directory) || '.'}`,
    'npm run create',
    'npx tsc --noEmit && npm run check -- hello/plugin.ts',
    'npm run build -- hello/plugin.ts',
  ]);
  blank();
  info('Read AUTHORING.md first. An AI assistant in this directory reads AGENTS.md and CLAUDE.md, and');
  info('can query this installation through the MCP server registered in .mcp.json.');
  blank();
  info('CLAUDE.md and README.md are yours — nothing rewrites them. Everything else in there is');
  info('generated, and "microteia unpack" rewrites it whenever this installation takes a new version,');
  info('so the guides never describe a contract the platform no longer has.');
  blank();
};
