import { access, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { flagValue, hasFlag } from '../shared/args.js';
import type { ParsedArgs } from '../shared/args.js';
import { blank, bullets, heading, info, success, warn } from '../shared/ui.js';
import { run } from '../shared/run.js';
import { ENVIRONMENT_FILE, readEnvironment } from './environment.js';
import { WORKSPACE_DIR } from './workspace.js';
import { authoringGuide } from '../vendor/authoringGuide.js';
import type { ExtensionPointRow } from '../vendor/authoringGuide.js';
import {
  SDK_TARBALL,
  workspaceAgentsMd,
  workspaceGitignore,
  workspaceMcpJson,
  workspacePackageJson,
  workspaceReadme,
  workspaceTsconfig,
} from '../vendor/pluginWorkspaceTemplates.js';

/**
 * `microteia plugin init` — prepara `extensions/`, onde o escritório escreve extensão em TypeScript.
 *
 * Não é um deploy e não toca no projeto Firebase: escreve arquivos e chama o `npm`. É deliberadamente
 * o mesmo desenho de `functions/custom/` — o diretório fica FORA de `.microteia/`, é do escritório, e o
 * upgrade não o toca. O que o upgrade troca é o SDK dentro do pacote, e um `npm install` aqui traz a
 * versão nova; é por isso que o caminho do tarball não leva número de versão.
 *
 * O Console continua sem dependência de npm nenhuma: o que esta função faz é escrever texto.
 */

export const EXTENSIONS_DIR = 'extensions';

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
    throw new Error(
      'No installed Microteia package found. Run "microteia deploy --kernel <package>.tgz" first.',
    );
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

interface SdkMetadata {
  points: ExtensionPointRow[];
  hostModules: string[];
}

/**
 * O manual é escrito com a lista de pontos e de módulos do SDK INSTALADO, não com uma cópia dela: um
 * texto que descreve um contrato diferente do que está na máquina é pior que texto nenhum.
 *
 * Por isso ele é lido de `node_modules`, DEPOIS do `npm install`, e não do pacote: no pacote o SDK é um
 * tarball, e o que interessa é o que de fato ficou instalado.
 */
const readSdkMetadata = async (sdkDir: string): Promise<SdkMetadata> => {
  const types = await readFile(join(sdkDir, 'types/microteia-host.d.ts'), 'utf8');
  const hostModules = [...types.matchAll(/declare module '([^']+)'/g)].map((match) => match[1]);

  // O Console é ESM e o SDK é CommonJS por desenho — `createRequire` é a ponte. Ler o SDK INSTALADO,
  // em vez de uma cópia da lista de pontos, é o que garante que o manual descreva o contrato que está
  // na máquina: um texto que fala de outro contrato é pior que texto nenhum.
  const requireSdk = createRequire(import.meta.url);
  const sdk = requireSdk(join(sdkDir, 'lib/sdk/index.js')) as {
    UI_EXTENSION_POINTS: ExtensionPointRow[];
    DATA_EXTENSION_POINTS: ExtensionPointRow[];
    I18N_EXTENSION_POINTS: ExtensionPointRow[];
    THEME_EXTENSION_POINTS: ExtensionPointRow[];
  };

  return {
    hostModules,
    points: [
      ...sdk.UI_EXTENSION_POINTS,
      ...sdk.DATA_EXTENSION_POINTS,
      ...sdk.I18N_EXTENSION_POINTS,
      ...sdk.THEME_EXTENSION_POINTS,
    ],
  };
};

/** As extensões de primeira parte, como referência de autoria — o melhor material que existe. */
/**
 * As extensões de primeira parte como referência, em FONTE e uma pasta cada — a mesma forma em que o
 * escritório escreve as dele. Viajavam como `.json`, que é o artefato e não ensina como se chega nele.
 *
 * São SOBRESCRITAS a cada `plugin-init`: são nossas, e ficar com a versão de dois pacotes atrás ao lado de
 * uma instalação nova é pior que não tê-las.
 */
const copyExamples = async (installDir: string, target: string): Promise<number> => {
  const source = join(installDir, 'sdk/examples');
  if (!await exists(source)) return 0;
  await rm(target, { recursive: true, force: true });
  await cp(source, target, { recursive: true });
  const entries = await readdir(target, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).length;
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
      + 'Use --force to rewrite the scaffolding (your own extension folders are never touched).',
    );
  }

  const sdk = await locateSdk(root);
  const installDir = join(root, WORKSPACE_DIR, 'install');

  heading(`Extension authoring for "${environment.project.name}"`);

  await mkdir(directory, { recursive: true });

  // O caminho do tarball é relativo, para que o diretório continue válido se a instalação inteira for
  // movida — o que acontece assim que alguém a versiona num repositório do escritório.
  const tarball = relative(directory, sdk.path);

  await writeFile(
    join(directory, 'package.json'),
    workspacePackageJson(environment.environment.id, tarball, sdk.kernelVersion),
  );
  await writeFile(join(directory, 'tsconfig.json'), workspaceTsconfig());
  await writeFile(join(directory, '.gitignore'), workspaceGitignore());
  await writeFile(join(directory, '.mcp.json'), workspaceMcpJson());

  const agents = workspaceAgentsMd(sdk.kernelVersion);
  await writeFile(join(directory, 'AGENTS.md'), agents);
  // O mesmo conteúdo com o nome que o Claude Code procura. Dois arquivos e não um link simbólico:
  // link não sobrevive a um `git clone` no Windows, e este diretório é feito para ser versionado.
  await writeFile(join(directory, 'CLAUDE.md'), agents);
  await writeFile(
    join(directory, 'README.md'),
    workspaceReadme(environment.project.name, sdk.kernelVersion),
  );

  success('wrote the authoring workspace');

  const examples = await copyExamples(installDir, join(directory, 'examples'));
  if (examples > 0) success(`copied ${examples} first-party extension(s) into examples/, as source`);
  else warn('this package carries no examples/ — the guide still describes every mechanism');

  blank();
  info('Installing @microteia/sdk...');
  await run('npm', ['install', '--no-audit', '--no-fund'], { cwd: directory });

  // O manual sai por último, escrito com o que o `npm install` acabou de pôr em `node_modules`.
  const metadata = await readSdkMetadata(join(directory, 'node_modules/@microteia/sdk'));
  await writeFile(
    join(directory, 'AUTHORING.md'),
    authoringGuide(sdk.kernelVersion, metadata.points, metadata.hostModules),
  );
  success(`wrote AUTHORING.md (${metadata.points.length} extension points, ${metadata.hostModules.length} modules)`);

  blank();
  info(`Extension authoring ready in ${relative(root, directory)}/ (kernel contract ${sdk.kernelVersion}).`);
  bullets([
    `cd ${relative(process.cwd(), directory) || '.'}`,
    'npx microteia-plugin new com.example.hello',
    'npx tsc --noEmit && npx microteia-plugin check hello/plugin.ts',
    'npx microteia-plugin build hello/plugin.ts',
  ]);
  blank();
  info('Read AUTHORING.md first. An AI assistant in this directory reads AGENTS.md and can query');
  info('this installation through the MCP server registered in .mcp.json.');
  blank();
  info('After taking a new platform version, run "npm run sdk:refresh" here — not "npm install",');
  info('which keeps the SDK you already have (the tarball path carries no version, so npm sees no');
  info('change). Skipping it is silent: your extensions keep compiling, against the wrong contract.');
  blank();
};
