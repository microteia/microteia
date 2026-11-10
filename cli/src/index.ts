#!/usr/bin/env node
import { parseArgs } from './shared/args.js';
import type { ParsedArgs } from './shared/args.js';
import { CLI_VERSION } from './shared/paths.js';
import { blank, failure, heading, info } from './shared/ui.js';
import { pack } from './vendor/pack.js';
import { packConsole } from './vendor/packConsole.js';
import { publish } from './vendor/publish.js';
import { init } from './console/init.js';
import { connect } from './console/connect.js';
import { unpack } from './console/unpack.js';
import { deploy } from './console/deploy.js';
import { provision } from './console/provision.js';
import { exportCatalog } from './console/exportCatalog.js';
import { grantSigning } from './console/sessionSigning.js';
import { pluginInit } from './console/pluginWorkspace.js';
import { versionReport } from './console/versions.js';
import { newerThan } from './console/channel.js';

interface Command {
  name: string;
  usage: string;
  summary: string;
  audience: 'office' | 'publisher';
  execute: (args: ParsedArgs) => Promise<void>;
}

const COMMANDS: Command[] = [
  {
    name: 'init',
    usage: 'microteia init [--name <office>] [--id <environment-id>] [--force]',
    summary: 'Create a Microteia installation in this directory.',
    audience: 'office',
    execute: init,
  },
  {
    name: 'connect',
    usage: 'microteia connect --project <firebase-project-id> [--no-create-web-app]',
    summary: 'Bind this installation to a Firebase project you own.',
    audience: 'office',
    execute: connect,
  },
  {
    name: 'unpack',
    usage: 'microteia unpack --version <latest|x.y.z> | --kernel <package.tgz>',
    summary: 'Put a Microteia version in place, without publishing anything.',
    audience: 'office',
    execute: unpack,
  },
  {
    name: 'deploy',
    usage: 'microteia deploy [--only rules,indexes,functions,hosting] [--delay <seconds>] [--prune] [--all]',
    summary: 'Publish the package that is in place to the connected Firebase project.',
    audience: 'office',
    execute: deploy,
  },
  {
    name: 'provision',
    usage: 'microteia provision [--prune] [--delay <seconds>] [--all]',
    summary: 'Give the installed extensions the Cloud Functions and indexes they ask for.',
    audience: 'office',
    execute: provision,
  },
  {
    name: 'grant-signing',
    usage: 'microteia grant-signing [--check] [--yes]',
    summary: 'Let the functions sign sessions (portal identity providers, two-step verification).',
    audience: 'office',
    execute: grantSigning,
  },
  {
    name: 'export-catalog',
    usage: 'microteia export-catalog --tenant <tenantId> [--output <path>]',
    summary: 'Write what an office has — screens, lists, extensions — for the authoring tools to read.',
    audience: 'office',
    execute: exportCatalog,
  },
  {
    name: 'plugin-init',
    usage: 'microteia plugin-init --namespace <com.acme> [--publisher <name>] [--prefix <acme>] [--dir <path>] [--force]',
    summary: 'Prepare "extensions/", to author extensions in TypeScript in your editor.',
    audience: 'office',
    execute: pluginInit,
  },
  {
    name: 'pack',
    usage: 'microteia pack [--output <dir>] [--skip-verify]',
    summary: 'Build an installable Microteia package from this repository.',
    audience: 'publisher',
    execute: pack,
  },
  {
    name: 'pack-console',
    usage: 'microteia pack-console [--output <dir>]',
    summary: 'Build a standalone copy of this Console, to run outside the repository.',
    audience: 'publisher',
    execute: packConsole,
  },
  {
    name: 'publish',
    usage: 'microteia publish [--kernel-only|--console-only] [--repo <owner/name>] [--otp <code>] [--dry-run]',
    summary: 'Release what pack and pack-console built, so an office can download it. Push first: the kernel is tagged on its commit.',
    audience: 'publisher',
    execute: publish,
  },
];

const printHelp = (): void => {
  heading(`Microteia Console ${CLI_VERSION}`);
  info('Install and update Microteia in a Firebase project you own.\n');

  const office = COMMANDS.filter((command) => command.audience === 'office');
  const publisher = COMMANDS.filter((command) => command.audience === 'publisher');

  // A largura sai do NOME mais longo, não de um número escrito à mão: `pack-console` e
  // `plugin-init` já estouravam o 10 fixo, e o help saía com nome e resumo colados.
  const width = Math.max(...COMMANDS.map((command) => command.name.length)) + 2;

  if (office.length > 0) {
    info('Installing:');
    for (const command of office) info(`  ${command.name.padEnd(width)}${command.summary}`);
    blank();
  }

  if (publisher.length > 0) {
    info('Publishing:');
    for (const command of publisher) info(`  ${command.name.padEnd(width)}${command.summary}`);
    blank();
  }

  info('Run "microteia <command> --help" for usage.\n');
};

const main = async (): Promise<number> => {
  const argv = process.argv.slice(2);
  const [name, ...rest] = argv;

  if (name === undefined || name === '--help' || name === '-h' || name === 'help') {
    printHelp();
    return 0;
  }

  if (name === '--version' || name === '-v') {
    for (const line of await versionReport(process.cwd(), newerThan)) info(line);
    return 0;
  }

  const command = COMMANDS.find((candidate) => candidate.name === name);

  if (command === undefined) {
    failure(`Unknown command "${name}".`);
    printHelp();
    return 1;
  }

  const args = parseArgs(rest);

  if (args.flags.has('help')) {
    info(`\n${command.usage}\n\n${command.summary}\n`);
    return 0;
  }

  await command.execute(args);
  return 0;
};

main()
  .then((code) => { process.exitCode = code; })
  .catch((error: unknown) => {
    blank();
    failure(error instanceof Error ? error.message : String(error));
    blank();
    process.exitCode = 1;
  });
