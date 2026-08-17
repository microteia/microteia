#!/usr/bin/env node
import { parseArgs } from './shared/args.js';
import type { ParsedArgs } from './shared/args.js';
import { CLI_VERSION } from './shared/paths.js';
import { blank, failure, heading, info } from './shared/ui.js';
import { pack } from './vendor/pack.js';

interface Command {
  name: string;
  usage: string;
  summary: string;
  audience: 'office' | 'publisher';
  execute: (args: ParsedArgs) => Promise<void>;
}

const COMMANDS: Command[] = [
  {
    name: 'pack',
    usage: 'microteia pack [--output <dir>] [--skip-verify]',
    summary: 'Build an installable Microteia package from this repository.',
    audience: 'publisher',
    execute: pack,
  },
];

const printHelp = (): void => {
  heading(`Microteia Console ${CLI_VERSION}`);
  info('Install and update Microteia in a Firebase project you own.\n');

  const office = COMMANDS.filter((command) => command.audience === 'office');
  const publisher = COMMANDS.filter((command) => command.audience === 'publisher');

  if (office.length > 0) {
    info('Installing:');
    for (const command of office) info(`  ${command.name.padEnd(10)}${command.summary}`);
    blank();
  }

  if (publisher.length > 0) {
    info('Publishing:');
    for (const command of publisher) info(`  ${command.name.padEnd(10)}${command.summary}`);
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
    info(CLI_VERSION);
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
