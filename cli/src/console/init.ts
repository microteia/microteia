import { access, mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { flagValue, hasFlag } from '../shared/args.js';
import type { ParsedArgs } from '../shared/args.js';
import { blank, bullets, heading, info, success } from '../shared/ui.js';
import { DEFAULT_FUNCTIONS_REGION } from '../kernel/manifest.js';
import { ENVIRONMENT_FILE, slug, writeEnvironment } from './environment.js';
import type { Environment } from './environment.js';
import { WORKSPACE_DIR } from './workspace.js';
import { ensureRootGitignore } from './backendEnv.js';

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
    kernel: { version: null, deployed: null },
    backend: { functions: null, parameters: null, indexes: null },
  };

  await writeEnvironment(file, environment);

  // O diretório de trabalho guarda o pacote desempacotado e a configuração resolvida. Ele é local à
  // instalação e não deve ir para repositório nenhum.
  const workspace = join(directory, WORKSPACE_DIR);
  await mkdir(workspace, { recursive: true });
  await writeFile(join(workspace, '.gitignore'), '*\n');

  // Este diretório é o REPOSITÓRIO de quem mantém a instalação: é onde ficam o registro do ambiente,
  // as extensões que ele escreve e as configurações de backend. O `.gitignore` nasce com ele porque a
  // configuração de backend é credencial, e uma credencial commitada por omissão nossa é o pior
  // desfecho possível.
  const gitignore = await ensureRootGitignore(directory);

  heading(`Microteia installation "${name}"`);
  success(`created ${ENVIRONMENT_FILE}`);
  if (gitignore === 'created') success('created .gitignore');
  else if (gitignore === 'appended') success('added ".env.*" to .gitignore');
  blank();
  info('Next:');
  bullets([
    'microteia connect --project <your-firebase-project-id>',
    'microteia unpack --kernel <microteia-kernel-x.y.z.tgz>',
    'microteia deploy',
  ]);
  blank();
};
