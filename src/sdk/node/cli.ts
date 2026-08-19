#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { KERNEL_VERSION } from '../../domain/schema/plugin/kernelVersion';
import { buildPlugin } from './compile';
import { messageBundlesOf } from '../../domain/schema/i18n/extensionPoints';
import { describeMessage, describeWith } from './messages';
import { installationRegion, scaffoldFunction, scaffoldPlugin } from './scaffold';
import { askerFor } from './prompt';
import { serveMcp } from './mcp';

/**
 * `microteia-plugin` — a ferramenta de quem escreve extensão fora deste repositório.
 *
 * Ela existe para que o `.json` que a plataforma instala continue sendo o artefato, e não a fonte: o
 * autor escreve TypeScript, com tipos e autocomplete, e o `check` recusa aqui exatamente o que a
 * instalação recusaria lá — a MESMA porta de validação, não uma segunda aproximação dela.
 *
 * Sem dependência de framework de CLI, pelo mesmo motivo do Console: uma ferramenta que se instala na
 * máquina de um escritório é mais confiável quanto menos ela arrasta.
 */

interface Args {
  positional: string[];
  flags: Set<string>;
  values: Map<string, string>;
}

const parseArgs = (argv: string[]): Args => {
  const positional: string[] = [];
  const flags = new Set<string>();
  const values = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      positional.push(token);
      continue;
    }
    const name = token.slice(2);
    if (name.includes('=')) {
      const [key, ...rest] = name.split('=');
      values.set(key, rest.join('='));
      continue;
    }
    const next = argv[index + 1];
    if (next !== undefined && !next.startsWith('--')) {
      values.set(name, next);
      index += 1;
    } else {
      flags.add(name);
    }
  }

  return { positional, flags, values };
};

const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

const say = (line = ''): void => { process.stdout.write(`${line}\n`); };
const problem = (line: string): void => { process.stderr.write(`${RED}x${RESET} ${line}\n`); };
const done = (line: string): void => { say(`${GREEN}ok${RESET} ${line}`); };
const warn = (line: string): void => { say(`${YELLOW}!${RESET} ${line}`); };

/** O `plugin.ts` a compilar: o que foi passado, ou o do diretório atual. */
const entryFrom = (args: Args): string => {
  const given = args.positional[1] ?? args.values.get('entry');
  return resolve(given ?? 'plugin.ts');
};

interface RenderableIssue {
  source: string;
  message: string;
  messageParams?: Record<string, string>;
}

const describeIssues = (
  issues: RenderableIssue[],
  describe: (message: string, params?: Record<string, string>) => string = describeMessage,
): void => {
  for (const issue of issues) {
    say(`  ${DIM}${issue.source.padEnd(9)}${RESET} ${describe(issue.message, issue.messageParams)}`);
  }
};

const build = (args: Args, write: boolean): number => {
  const entry = entryFrom(args);
  const result = buildPlugin({ entry, exportName: args.values.get('export') });
  const { manifest } = result.package;
  // O pacote traz os próprios textos; usá-los aqui é o que faz o terminal mostrar o nome da extensão
  // em vez da chave dele.
  const describe = describeWith(messageBundlesOf(manifest.contributes ?? []));

  say(`${BOLD}${describe(manifest.name)}${RESET} ${manifest.id} ${DIM}v${manifest.version}${RESET}`);

  const counts: string[] = [];
  const push = (label: string, value: number): void => { if (value > 0) counts.push(`${value} ${label}`); };
  push('screen(s)', result.package.screens?.length ?? 0);
  push('workflow(s)', result.package.workflows.length);
  push('action(s)', result.package.actions?.length ?? 0);
  push('script(s)', result.package.scripts?.length ?? 0);
  push('view(s)', result.package.views?.length ?? 0);
  push('migration(s)', result.package.migrations?.length ?? 0);
  if (counts.length > 0) say(`  ${DIM}${counts.join(', ')}${RESET}`);

  if (result.issues.length > 0) {
    say();
    problem(`${result.issues.length} problem(s) - this package would be refused on install:`);
    describeIssues(result.issues, describe);
    if (!write) return 1;
    if (!args.flags.has('force')) {
      say();
      say(`${DIM}Nothing written. Pass --force to write the .json anyway and inspect it.${RESET}`);
      return 1;
    }
  }

  if (!write) {
    say();
    done('no problems found.');
    return 0;
  }

  const outDir = args.values.get('out') ?? dirname(entry);
  const file = join(outDir, `${manifest.id}.json`);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(file, result.json);

  const kb = Math.round(Buffer.byteLength(result.json) / 1024);
  say();
  done(`${file} ${DIM}(${kb} KB)${RESET}`);
  if (result.issues.length > 0) warn('written with problems, because --force was given.');
  if ((result.package.views?.length ?? 0) > 0 || result.package.startup !== undefined) {
    say();
    say(`${DIM}This package carries code. After importing it, an administrator has to open the${RESET}`);
    say(`${DIM}source and trust it before the views run - see AUTHORING.md, "Code trust".${RESET}`);
  }
  return 0;
};

/**
 * `create` — o guia que produz uma extensão.
 *
 * Pergunta o que a extensão VAI SER, porque disso depende o que faz sentido gerar: uma extensão que só
 * traz uma automação não deveria nascer com uma tela e uma página em código para apagar. Toda pergunta
 * aceita ser respondida por flag, e sem terminal ele não pergunta nada — é o que o mantém usável em CI,
 * num script, ou por uma IA.
 */
const createPlugin = async (args: Args): Promise<number> => {
  const workspace = args.values.get('dir') ?? process.cwd();
  const asker = askerFor(args.values, args.flags.has('yes'));

  try {
    say(`${BOLD}A new Microteia extension${RESET} ${DIM}(kernel contract ${KERNEL_VERSION})${RESET}`);
    say();

    const id = args.positional[1] ?? await asker.text({
      key: 'id',
      text: 'id',
      hint: 'Reverse-DNS, lowercase. Permanent — it is how an update finds what to update. Use a domain you control.',
    }, 'com.example.hello');
    const name = await asker.text(
      { key: 'name', text: 'name', hint: 'What a person sees in the Extensions list.' },
      'Hello',
    );
    const summary = await asker.text(
      { key: 'summary', text: 'summary', hint: 'One line, shown next to the name.' },
      'What this extension does, in one line.',
    );
    const publisher = await asker.text({ key: 'publisher', text: 'publisher' }, 'Your organization');

    say();
    asker.note('What should it carry? Each answer adds only what it needs — nothing to delete afterwards.');
    const screen = await asker.confirm({
      key: 'entity',
      text: 'an entity of its own?',
      hint: 'A collection and its fields. The platform draws the list, the detail, the form and the filters.',
    }, true);
    const view = await asker.confirm({
      key: 'view',
      text: 'a page written in code?',
      hint: 'A real .tsx file, type-checked. It installs inert until an administrator trusts the source.',
    }, false);
    const functions = await asker.confirm({
      key: 'functions',
      text: 'Cloud Functions of its own?',
      hint: 'Written in <plugin>/functions/ and gathered by "microteia deploy".',
    }, false);

    await asker.close();

    const result = scaffoldPlugin(
      { id, name, summary, publisher, screen, view, functions },
      workspace,
      args.flags.has('force'),
    );

    const folder = basename(result.directory);
    say();
    done(`created ${folder}/ ${DIM}(${result.files.length} files)${RESET}`);
    for (const file of result.files) say(`    ${DIM}${folder}/${file}${RESET}`);

    say();
    say('Next:');
    say(`  ${DIM}npx tsc --noEmit${RESET}`);
    say(`  ${DIM}npx microteia-plugin check ${folder}/plugin.ts${RESET}`);
    say(`  ${DIM}npx microteia-plugin build ${folder}/plugin.ts${RESET}`);

    if (functions) {
      say();
      warn('this extension declares Cloud Functions.');
      say(`  ${DIM}They are written in ${folder}/functions/ and gathered by "microteia deploy".${RESET}`);
      say(`  ${DIM}For types while you write them: npm i -D firebase-functions firebase-admin${RESET}`);
      say(`  ${DIM}Add another with: npx microteia-plugin create function --plugin ${folder}${RESET}`);
    }
    if (view) {
      say();
      say(`  ${DIM}A package that carries code installs inert: an administrator reviews the source and${RESET}`);
      say(`  ${DIM}trusts it before the view runs. See AUTHORING.md, "Code trust".${RESET}`);
    }
    return 0;
  } finally {
    await asker.close();
  }
};

/** `create function` — acrescenta uma Cloud Function a uma extensão que já existe. */
const createFunction = async (args: Args): Promise<number> => {
  const workspace = args.values.get('dir') ?? process.cwd();
  const asker = askerFor(args.values, args.flags.has('yes'));

  try {
    const plugins = readdirSync(workspace, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(join(workspace, entry.name, 'plugin.ts')))
      .map((entry) => entry.name);

    if (plugins.length === 0) {
      problem('No extension found here. Create one first: npx microteia-plugin create');
      return 1;
    }

    const folder = args.values.get('plugin') ?? await asker.choose(
      { key: 'plugin', text: 'which extension does this function belong to?' },
      plugins.map((value) => ({ value, label: value })),
      plugins[0],
    );

    if (!plugins.includes(folder)) {
      problem(`"${folder}" is not an extension here. Found: ${plugins.join(', ')}`);
      return 1;
    }

    const action = await asker.text({
      key: 'action',
      text: 'what does it do?',
      hint: 'A short verb phrase; it becomes the function name.',
    }, 'sync');

    const directory = join(workspace, folder);
    const id = pluginIdOf(directory) ?? `com.example.${folder}`;
    const region = installationRegion(workspace);
    await asker.close();

    const name = scaffoldFunction(directory, id, action, region);

    done(`created ${folder}/functions/${name}.ts ${DIM}(region ${region})${RESET}`);
    say();
    warn(`declare it in ${folder}/plugin.ts, under manifest.backend.functions:`);
    say(`  ${DIM}backend: { functions: ['${name}'] }${RESET}`);
    say(`  ${DIM}Without that, the installation deploys it everywhere instead of only where this${RESET}`);
    say(`  ${DIM}extension is installed — and "microteia pack" refuses a package whose counts disagree.${RESET}`);
    return 0;
  } finally {
    await asker.close();
  }
};

/** O id declarado no `plugin.ts`, para o nome da function sair do id e não do nome da pasta. */
const pluginIdOf = (directory: string): string | null => {
  try {
    const source = readFileSync(join(directory, 'plugin.ts'), 'utf8');
    return /NAMESPACE = '([^']+)'/.exec(source)?.[1] ?? null;
  } catch {
    return null;
  }
};

const create = async (args: Args): Promise<number> =>
  args.positional[1] === 'function' ? createFunction(args) : createPlugin(args);

interface Command {
  name: string;
  usage: string;
  summary: string;
  run: (args: Args) => number | Promise<number>;
}

const COMMANDS: Command[] = [
  {
    name: 'create',
    usage:
      'microteia-plugin create [<com.example.id>] [--dir <path>] [--force] [--yes]\n'
      + '  microteia-plugin create function [--plugin <folder>] [--yes]',
    summary: 'Create an extension, guided by a few questions. "create function" adds a Cloud Function.',
    run: create,
  },
  {
    name: 'check',
    usage: 'microteia-plugin check [plugin.ts] [--export <name>]',
    summary: 'Compile and validate without writing. This is the gate - run it before publishing.',
    run: (args) => build(args, false),
  },
  {
    name: 'build',
    usage: 'microteia-plugin build [plugin.ts] [--out <dir>] [--export <name>] [--force]',
    summary: 'Compile to the .json the platform installs.',
    run: (args) => build(args, true),
  },
  {
    name: 'mcp',
    usage: 'microteia-plugin mcp [--root <path>]',
    summary: 'Serve this workspace to an AI assistant over MCP (stdio).',
    run: (args) => serveMcp(args.values.get('root') ?? process.cwd()),
  },
];

const version = (): string => {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '../../../package.json'), 'utf8')) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
};

const help = (): void => {
  say(`${BOLD}Microteia plugin SDK${RESET} ${version()} ${DIM}(kernel contract ${KERNEL_VERSION})${RESET}`);
  say();
  say('Author Microteia extensions in TypeScript. The .json is the artifact, not the source.');
  say();
  for (const command of COMMANDS) say(`  ${command.name.padEnd(7)}${command.summary}`);
  say();
  say('Run "microteia-plugin <command> --help" for usage.');
  say();
};

const main = async (): Promise<number> => {
  const [name] = process.argv.slice(2);

  if (name === undefined || name === 'help' || name === '--help' || name === '-h') {
    help();
    return 0;
  }
  if (name === '--version' || name === '-v') {
    say(version());
    return 0;
  }

  const command = COMMANDS.find((candidate) => candidate.name === name);
  if (command === undefined) {
    problem(`Unknown command "${name}".`);
    help();
    return 1;
  }

  const args = parseArgs(process.argv.slice(2));
  if (args.flags.has('help')) {
    say();
    say(command.usage);
    say();
    say(command.summary);
    say();
    return 0;
  }

  return command.run(args);
};

main()
  .then((code) => { process.exitCode = code; })
  .catch((error: unknown) => {
    problem(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
