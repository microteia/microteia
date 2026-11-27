import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { flagValue, hasFlag } from '../shared/args.js';
import type { ParsedArgs } from '../shared/args.js';
import { repoRoot } from '../shared/paths.js';
import { run } from '../shared/run.js';
import { blank, heading, step, success } from '../shared/ui.js';
import { DEFAULT_FUNCTIONS_REGION, exportedFunctionNames } from '../kernel/manifest.js';
import {
  DEFAULT_FUNCTION_BATCH,
  reportFailures,
  reportNotices,
  writeFunctionsDeployConfig,
} from '../console/deployFunctions.js';
import { deployFunctionsThatChanged } from '../console/functionsUpToDate.js';
import { clearRegionOrphans, listDeployedFunctions } from '../console/regionOrphans.js';
import { assertInsideRepository } from './repository.js';

/**
 * O deploy das Cloud Functions nos NOSSOS projetos (`microteia-dev` e `curatino`) pelo MESMO caminho
 * do Console: em lotes, compilando uma vez, e pulando o que o projeto já roda com o mesmo carimbo.
 *
 * Ele substituiu `scripts/deploy-functions-individually.cjs` e os `firebase deploy --only` dos grupos
 * `deploy:*`. Eram três implementações do mesmo deploy, e o que se aprendia numa — a recusa de política
 * de repetição, o motivo da falha, a segunda passada — chegava às outras quando alguém lembrava. Os
 * grupos continuam no `package.json`, agora como filtro deste comando.
 *
 * Por NOME, sempre, inclusive quando sobe tudo: o `microteia-dev` tem functions de outro módulo que
 * este código não declara, e um `firebase deploy --only functions` inteiro aborta pedindo para
 * apagá-las.
 */
const TARGETS: Record<string, string> = { dev: 'dev', prod: 'prod' };

const listFlag = (args: ParsedArgs, name: string): string[] =>
  (flagValue(args, name) ?? '')
    .split(',')
    .map((entry) => entry.trim().replace(/^functions:/, ''))
    .filter((entry) => entry !== '');

/**
 * O `lib/` é apagado antes de compilar porque o `tsc` não apaga a saída de um módulo removido: o
 * `.js` dele continuava no diretório, subia com as functions e mudava o carimbo de todas a cada
 * remoção. O `tsbuildinfo` vai junto, ou o `tsc -b` acharia que não há nada a emitir.
 */
export const cleanFunctionsBuild = async (root: string): Promise<void> => {
  await rm(join(root, 'functions', 'lib'), { recursive: true, force: true });
  await rm(join(root, 'functions', 'tsconfig.tsbuildinfo'), { force: true });
};

export const deployOwnFunctions = async (args: ParsedArgs): Promise<void> => {
  await assertInsideRepository('deploy-functions');
  const root = repoRoot;

  const targetName = flagValue(args, 'target') ?? process.env.TARGET ?? 'dev';
  const project = TARGETS[targetName];
  if (project === undefined) throw new Error(`Unknown target "${targetName}". Use dev or prod.`);

  const exported = exportedFunctionNames(await readFile(join(root, 'functions/src/index.ts'), 'utf8'));
  const only = listFlag(args, 'only');
  const skip = new Set(listFlag(args, 'skip'));
  const unknown = [...only, ...skip].filter((name) => !exported.includes(name));
  if (unknown.length > 0) throw new Error(`Not exported by functions/src/index.ts: ${unknown.join(', ')}`);

  const names = (only.length > 0 ? only : exported).filter((name) => !skip.has(name));
  const batchSize = Number.parseInt(flagValue(args, 'batch') ?? String(DEFAULT_FUNCTION_BATCH), 10);
  const delaySeconds = Number.parseInt(flagValue(args, 'delay') ?? '0', 10);

  heading(`Cloud Functions -> ${targetName} (${names.length}, ${batchSize} per command)`);

  step(1, 3, 'Compiling the Cloud Functions once');
  await cleanFunctionsBuild(root);
  await run('npm', ['run', 'build:functions'], { cwd: root });

  step(2, 3, 'Asking the project what it already runs');
  const deployed = await listDeployedFunctions(project);
  const standingCopies = await clearRegionOrphans(project, names, DEFAULT_FUNCTIONS_REGION, false, deployed);

  step(3, 3, 'Deploying');
  const config = await writeFunctionsDeployConfig(root);
  try {
    const report = await deployFunctionsThatChanged(names, {
      projectId: project,
      cwd: root,
      delaySeconds,
      force: hasFlag(args, 'force'),
      standingCopies,
      config,
      batchSize,
    }, { deployed, region: DEFAULT_FUNCTIONS_REGION, all: hasFlag(args, 'all') });

    blank();
    success(`${report.deployed.length} deployed, ${report.skipped.length} already up to date`);
    reportNotices(report.notices);
    if (report.failed.length > 0) {
      blank();
      reportFailures(report.failed);
      throw new Error(`${report.failed.length} function(s) did not go up: ${report.failed.map((entry) => entry.name).join(', ')}`);
    }
  } finally {
    await rm(config, { force: true });
  }
};
