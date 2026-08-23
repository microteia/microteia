import { cpSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { KERNEL_VERSION } from '../../../domain/schema/plugin/kernelVersion';
import {
  PACKAGE_ADVISORY_BYTES,
  PACKAGE_MAX_BYTES,
} from '../../../domain/usecases/plugins/pluginReferences';
import { hostModuleNames, readHostTypes } from '../hostTypes';
import { authoringGuide } from './authoringGuide';
import {
  reconcileGitignore,
  reconcileMcpJson,
  reconcileTsconfig,
} from './reconcile';
import type { Reconciliation } from './reconcile';
import {
  workspaceAgentsMd,
  workspaceClaudeMd,
  workspaceDevDependencies,
  workspaceReadme,
  workspaceScripts,
} from './templates';

/**
 * `microteia-plugin sync` — põe em dia o que é gerado em `extensions/` a partir do SDK instalado.
 *
 * É a peça que faltava, e o que ela conserta não é um defeito: é uma classe deles. `AGENTS.md`,
 * `AUTHORING.md`, `tsconfig.json` e `.mcp.json` descrevem o que o kernel sabe fazer, e eram escritos
 * UMA vez, pelo `plugin-init` — que se recusa a rodar de novo. A instalação trocava de kernel e aqueles
 * textos continuavam descrevendo o contrato de meses antes, inclusive para a IA que os lê como
 * instrução. Nada reprovava, porque nada comparava.
 *
 * Três políticas, e a diferença entre elas é DE QUEM é o arquivo:
 *
 * | | |
 * |---|---|
 * | **Sobreposto** | `AGENTS.md`, `AUTHORING.md`, `examples/` — prosa e referência nossas, inteiras |
 * | **Conciliado** | `tsconfig.json`, `.mcp.json`, `.gitignore`, `package.json` — o autor escreve dentro |
 * | **Semeado** | `CLAUDE.md`, `README.md` — dele; nascem uma vez e nada os reescreve |
 *
 * Conciliar é acrescentar o que falta e NUNCA alterar o que divergir: quem decide o que fazer com uma
 * divergência é quem a escreveu, e o aviso diz o que ajustar. Sobrepor um `tsconfig.json` apagaria o
 * `path` que o autor acrescentou; sobrepor um `.mcp.json` apagaria os outros servidores que ele
 * registrou. Ver o cabeçalho de `reconcile.ts`.
 *
 * Idempotente por desenho: rodar duas vezes produz os mesmos bytes. É o que permite ao `unpack`
 * chamá-lo sozinho a cada troca de kernel, sem perguntar nada a ninguém.
 */

export interface SyncOptions {
  /** O diretório de extensões. Padrão: o diretório atual. */
  root?: string;
  /** `.microteia/install`, de onde saem os `examples/`. Padrão: busca a partir do `root`. */
  install?: string | null;
  /** Nome do escritório, para as sementes. Padrão: deduzido do `package.json` ou do diretório. */
  officeName?: string;
}

export interface SyncReport {
  kernelVersion: string;
  /** Prosa nossa, reescrita por inteiro. */
  rewritten: string[];
  /** Configuração que nasceu ou ganhou o que faltava, sem perder o que já tinha. */
  reconciled: string[];
  /**
   * Só as sementes do ESCRITÓRIO. Um arquivo conciliado que nasceu agora fica em `reconciled` e não
   * aqui, porque a mensagem das duas listas é diferente: estes nada reescreve, aqueles são completados
   * a cada troca de kernel.
   */
  seeded: string[];
  examples: number;
  /** Divergências entre o que a plataforma precisa e o que está no arquivo. Ninguém as resolve por ele. */
  warnings: string[];
  packageJson: 'missing' | 'present';
}

const readJson = (path: string): Record<string, unknown> =>
  JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;

/**
 * Sobe procurando o `microteia.yaml`: é ele, e não o `.microteia/`, que marca a raiz da instalação —
 * o diretório de extensões pode ter sido criado com `--dir` em qualquer lugar dentro dela.
 */
const findInstall = (root: string): string | null => {
  let current = resolve(root);
  for (let depth = 0; depth < 6; depth += 1) {
    if (existsSync(join(current, 'microteia.yaml'))) {
      const install = join(current, '.microteia', 'install');
      return existsSync(install) ? install : null;
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
};

/**
 * O nome só aparece nas duas sementes, e elas normalmente nascem pelo `plugin-init`, que o conhece. Um
 * `sync` manual não tem como saber, e o `package.json` que o Console semeou o carrega no `name`.
 */
const deduceOfficeName = (root: string, pkg: Record<string, unknown> | null): string => {
  const name = typeof pkg?.name === 'string' ? pkg.name : '';
  if (name.endsWith('-extensions')) return name.slice(0, -'-extensions'.length);
  if (name !== '') return name;
  return basename(resolve(root)) || 'this organization';
};

/** O caminho do tarball já está registrado na dependência — não há por que recebê-lo de novo. */
const sdkPathFrom = (pkg: Record<string, unknown> | null): string => {
  const dependencies = pkg?.dependencies;
  const declared = typeof dependencies === 'object' && dependencies !== null
    ? (dependencies as Record<string, unknown>)['@microteia/sdk']
    : undefined;
  return typeof declared === 'string' && declared.startsWith('file:')
    ? declared.slice('file:'.length)
    : '../.microteia/install/sdk/microteia-sdk.tgz';
};

const exampleIds = (install: string | null): string[] => {
  if (install === null) return [];
  const dir = join(install, 'sdk', 'examples');
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
};

/**
 * As extensões de primeira parte como referência, em FONTE e uma pasta cada — a mesma forma em que o
 * escritório escreve as dele. São SOBRESCRITAS: são nossas, e ficar com a versão de dois pacotes atrás
 * ao lado de uma instalação nova é pior que não tê-las.
 */
const copyExamples = (install: string | null, target: string): number => {
  if (install === null) return 0;
  const source = join(install, 'sdk', 'examples');
  if (!existsSync(source)) return 0;
  rmSync(target, { recursive: true, force: true });
  cpSync(source, target, { recursive: true });
  return readdirSync(target, { withFileTypes: true }).filter((entry) => entry.isDirectory()).length;
};

/**
 * O `package.json` segue a mesma regra dos outros conciliados: acrescenta o que falta, avisa o que
 * divergir, não sobrescreve nada.
 *
 * A tentação aqui é grande e é errada. Um script NOSSO que mudou de forma — foi o caso do
 * `sdk:refresh`, que carregava um `--no-save` que desfazia o próprio refresh — não é atualizado
 * sozinho, porque daqui não há como distinguir "o autor customizou" de "nós escrevemos isto numa
 * versão anterior". Entre desfazer trabalho dele em silêncio e pedir um ajuste com o valor certo na
 * mão, a segunda é a única que não perde nada.
 *
 * Uma `devDependency` que já existe também não é rebaixada — pode ter sido subida de propósito — e essa
 * não gera aviso: um range diferente do nosso normalmente o SATISFAZ, e avisar seria ruído.
 */
const reconcilePackageJson = (path: string, kernelVersion: string): Reconciliation => {
  const before = readFileSync(path, 'utf8');
  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(before) as Record<string, unknown>;
  } catch {
    return {
      action: 'unchanged',
      contents: null,
      warnings: ['package.json could not be read as JSON, so it was left alone. Fix it, then run "npm run sync".'],
    };
  }

  const warnings: string[] = [];
  const scripts = (pkg.scripts ?? {}) as Record<string, string>;
  const required = workspaceScripts(sdkPathFrom(pkg));

  const merged: Record<string, string> = { ...scripts };
  for (const [name, command] of Object.entries(required)) {
    const found = scripts[name];
    if (found === undefined) merged[name] = command;
    else if (found !== command) {
      warnings.push(
        `package.json: script "${name}" is "${found}", and the platform needs "${command}". `
        + 'Left as it is — adjust it by hand if that was not deliberate.',
      );
    }
  }
  pkg.scripts = merged;

  const devDependencies = (pkg.devDependencies ?? {}) as Record<string, string>;
  pkg.devDependencies = Object.fromEntries(
    Object.entries({ ...workspaceDevDependencies(), ...devDependencies }).sort(([a], [b]) => a.localeCompare(b)),
  );

  // Um carimbo nosso, informativo, que não tem como colidir com decisão de ninguém.
  pkg.microteia = { ...(pkg.microteia as Record<string, unknown> | undefined), kernelVersion };

  const after = `${JSON.stringify(pkg, null, 2)}\n`;
  return after === before
    ? { action: 'unchanged', contents: null, warnings }
    : { action: 'updated', contents: after, warnings };
};

/**
 * O `CLAUDE.md` já foi cópia byte a byte do `AGENTS.md`, e as instalações daquela época carregam essa
 * cópia até hoje: ele é SEMEADO, então nada o reescreve, e ficou descrevendo o contrato do kernel de
 * quando o diretório nasceu — dentro do arquivo que um assistente lê como instrução, ao lado de um
 * `AGENTS.md` reescrito que diz outra coisa.
 *
 * Não há como consertá-lo daqui, e é justo que não haja: é arquivo do escritório, e uma linha dele
 * pode ser dele. Mas dá para dizer, porque a versão do kernel dentro dele é uma afirmação que só o
 * `AGENTS.md` tem direito de fazer — quem o vê ali está vendo prosa nossa que envelheceu.
 */
const staleClaudeMdWarning = (root: string): string[] => {
  const path = join(root, 'CLAUDE.md');
  if (!existsSync(path)) return [];
  if (!readFileSync(path, 'utf8').includes('Kernel contract')) return [];
  return [
    'CLAUDE.md states a kernel contract version, which means it is a copy of an old AGENTS.md from '
    + 'before the two were split. Nothing rewrites CLAUDE.md, so that copy is now describing a '
    + 'platform you no longer have. Keep whatever you wrote in it, delete the rest, and run '
    + '"npm run sync" again to get the current CLAUDE.md — it imports AGENTS.md instead of copying it.',
  ];
};

export const syncWorkspace = (options: SyncOptions = {}): SyncReport => {
  const root = resolve(options.root ?? process.cwd());
  const packagePath = join(root, 'package.json');
  const pkg = existsSync(packagePath) ? readJson(packagePath) : null;

  const install = options.install === undefined ? findInstall(root) : options.install;
  const officeName = options.officeName ?? deduceOfficeName(root, pkg);
  const hostModules = hostModuleNames(readHostTypes(root));

  const rewritten: string[] = [];
  const reconciled: string[] = [];
  const seeded: string[] = [];
  const warnings: string[] = [];

  const rewrite = (name: string, contents: string): void => {
    writeFileSync(join(root, name), contents);
    rewritten.push(name);
  };

  /** Nasce e não se toca: é onde o escritório escreve, e um `sync` que apagasse aquilo seria perda. */
  const seed = (name: string, contents: string): void => {
    if (existsSync(join(root, name))) return;
    writeFileSync(join(root, name), contents);
    seeded.push(name);
  };

  const reconcile = (name: string, apply: (existing: string | null) => Reconciliation): void => {
    const path = join(root, name);
    const result = apply(existsSync(path) ? readFileSync(path, 'utf8') : null);
    if (result.contents !== null) writeFileSync(path, result.contents);
    if (result.action !== 'unchanged') reconciled.push(name);
    warnings.push(...result.warnings);
  };

  const documentInput = {
    kernelVersion: KERNEL_VERSION,
    hostModules,
    advisoryBytes: PACKAGE_ADVISORY_BYTES,
    maxBytes: PACKAGE_MAX_BYTES,
  };
  rewrite('AGENTS.md', workspaceAgentsMd(documentInput));
  rewrite('AUTHORING.md', authoringGuide(documentInput));

  reconcile('tsconfig.json', reconcileTsconfig);
  reconcile('.mcp.json', reconcileMcpJson);
  reconcile('.gitignore', reconcileGitignore);
  if (pkg !== null) reconcile('package.json', () => reconcilePackageJson(packagePath, KERNEL_VERSION));

  seed('CLAUDE.md', workspaceClaudeMd(officeName));
  warnings.push(...staleClaudeMdWarning(root));
  seed('README.md', workspaceReadme({
    officeName,
    kernelVersion: KERNEL_VERSION,
    examples: exampleIds(install),
  }));

  const examples = copyExamples(install, join(root, 'examples'));

  return {
    kernelVersion: KERNEL_VERSION,
    rewritten,
    reconciled,
    seeded,
    examples,
    warnings,
    packageJson: pkg === null ? 'missing' : 'present',
  };
};
