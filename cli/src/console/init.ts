import { access, mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { flagValue, hasFlag } from '../shared/args.js';
import type { ParsedArgs } from '../shared/args.js';
import { blank, bullets, heading, info, success } from '../shared/ui.js';
import { DEFAULT_FUNCTIONS_REGION } from '../kernel/manifest.js';
import { ENVIRONMENT_FILE, slug, writeEnvironment } from './environment.js';
import type { Environment } from './environment.js';
import { WORKSPACE_DIR } from './workspace.js';

const exists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

export const init = async (args: ParsedArgs): Promise<void> => {
  const file = resolve(flagValue(args, 'file') ?? join(process.cwd(), ENVIRONMENT_FILE));
  const directory = dirname(file);

  if (await exists(file) && !hasFlag(args, 'force')) {
    throw new Error(`${file} already exists. Use --force to overwrite it.`);
  }

  const name = flagValue(args, 'name') ?? basename(directory);
  const id = flagValue(args, 'id') ?? slug(name);

  if (id === '') throw new Error('Could not derive an environment id. Pass --id explicitly.');

  const environment: Environment = {
    project: { name },
    environment: { id, name },
    firebase: { projectId: null, region: DEFAULT_FUNCTIONS_REGION },
    kernel: { version: null },
    backend: { functions: null, parameters: null },
  };

  await writeEnvironment(file, environment);

  // O diretório de trabalho guarda o pacote desempacotado e a configuração resolvida. Ele é local à
  // instalação e não deve ir para repositório nenhum.
  const workspace = join(directory, WORKSPACE_DIR);
  await mkdir(workspace, { recursive: true });
  await writeFile(join(workspace, '.gitignore'), '*\n');

  heading(`Microteia installation "${name}"`);
  success(`created ${ENVIRONMENT_FILE}`);
  blank();
  info('Next:');
  bullets([
    'microteia connect --project <your-firebase-project-id>',
    'microteia deploy --kernel <microteia-kernel-x.y.z.tgz>',
  ]);
  blank();
};
