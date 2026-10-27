import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { hasFlag, requiredFlag } from '../shared/args.js';
import type { ParsedArgs } from '../shared/args.js';
import { capture, run } from '../shared/run.js';
import type { CaptureResult } from '../shared/run.js';
import { blank, bullets, failure, heading, info, success, warn } from '../shared/ui.js';
import { ENVIRONMENT_FILE, readEnvironment } from './environment.js';
import { readInstalledManifest } from './unpack.js';

/**
 * A permissão de ASSINAR sessões — a que `createCustomToken` usa. Duas features abrem sessão pelo servidor:
 * a entrada do portal por provedor de identidade e a verificação em duas etapas dos membros. Sem a
 * permissão, o provedor confirma a pessoa ou o código confere, e a entrada falha mesmo assim, com
 * `iam.serviceAccounts.signBlob` negado no log da function.
 *
 * São duas coisas no projeto do escritório: a API IAM Service Account Credentials habilitada, e o papel
 * Service Account Token Creator concedido à conta das functions SOBRE ELA MESMA.
 *
 * O Console não as faz sozinho no `deploy`: é alteração de permissão no projeto de outra pessoa, e
 * acontece num comando que diz o que vai mudar e pergunta antes. O `deploy` só CONFERE, e sugere este.
 */

export const IAM_CREDENTIALS_API = 'iamcredentials.googleapis.com';

export const TOKEN_CREATOR_ROLE = 'roles/iam.serviceAccountTokenCreator';

/**
 * A function cuja conta se lê. Uma do kernel que de fato assina — se ela roda com uma conta própria, é
 * essa que precisa da permissão, e escrever de cor a conta padrão do Compute erraria em silêncio.
 */
export const SIGNING_FUNCTION = 'secondFactor';

const GCLOUD_BIN = 'gcloud';

export type Gcloud = (args: string[]) => Promise<CaptureResult>;

export type AccountSource = 'function' | 'default';

export interface SigningCheck {
  account: string;
  source: AccountSource;
  /** `null` quando não deu para saber — permissão de leitura faltando, `gcloud` ausente. */
  apiEnabled: boolean | null;
  granted: boolean | null;
}

/** A conta padrão das functions de 2ª geração quando nenhuma foi configurada. */
export const defaultComputeAccount = (projectNumber: string): string =>
  `${projectNumber}-compute@developer.gserviceaccount.com`;

/**
 * A conta que a function usa, no JSON do `gcloud functions describe`. A 2ª geração a põe em
 * `serviceConfig`; a 1ª, na raiz. Vazio é "não sei", e não "a padrão": a padrão é decidida por quem chama.
 */
export const serviceAccountFromDescribe = (json: string): string | null => {
  try {
    const parsed = JSON.parse(json) as { serviceConfig?: { serviceAccountEmail?: unknown }; serviceAccountEmail?: unknown };
    const account = parsed.serviceConfig?.serviceAccountEmail ?? parsed.serviceAccountEmail;
    return typeof account === 'string' && account.includes('@') ? account : null;
  } catch {
    return null;
  }
};

/** A política IAM da conta concede a ela mesma criar token? */
export const policyGrantsSelfSigning = (json: string, account: string): boolean => {
  const parsed = JSON.parse(json) as { bindings?: Array<{ role?: unknown; members?: unknown; condition?: unknown }> };
  const member = `serviceAccount:${account}`;
  return (parsed.bindings ?? []).some((binding) =>
    binding.role === TOKEN_CREATOR_ROLE
    && binding.condition === undefined
    && Array.isArray(binding.members)
    && binding.members.includes(member));
};

export const enableApiArgs = (projectId: string): string[] =>
  ['services', 'enable', IAM_CREDENTIALS_API, `--project=${projectId}`];

export const grantArgs = (projectId: string, account: string): string[] => [
  'iam', 'service-accounts', 'add-iam-policy-binding', account,
  `--member=serviceAccount:${account}`,
  `--role=${TOKEN_CREATOR_ROLE}`,
  `--project=${projectId}`,
];

export const gcloudLine = (args: string[]): string => [GCLOUD_BIN, ...args].join(' ');

/**
 * A conta que as functions usam: lida da function publicada e, só se não houver uma, a padrão do
 * Compute a partir do número do projeto.
 */
export const resolveRuntimeAccount = async (
  projectId: string,
  region: string,
  gcloud: Gcloud,
): Promise<{ account: string; source: AccountSource }> => {
  const described = await gcloud([
    'functions', 'describe', SIGNING_FUNCTION, `--region=${region}`, `--project=${projectId}`, '--format=json',
  ]);
  const fromFunction = described.code === 0 ? serviceAccountFromDescribe(described.stdout) : null;
  if (fromFunction) return { account: fromFunction, source: 'function' };

  const project = await gcloud(['projects', 'describe', projectId, '--format=value(projectNumber)']);
  const projectNumber = project.stdout.trim();
  if (project.code !== 0 || !/^\d+$/.test(projectNumber)) {
    throw new Error(
      `Could not read the project number of ${projectId}.${project.stderr.trim() === '' ? '' : `\n  ${project.stderr.trim()}`}`,
    );
  }
  return { account: defaultComputeAccount(projectNumber), source: 'default' };
};

/** Só LÊ. É o que o `deploy` usa para avisar, e o que este comando usa antes e depois de mudar. */
export const checkSessionSigning = async (projectId: string, region: string, gcloud: Gcloud): Promise<SigningCheck> => {
  const { account, source } = await resolveRuntimeAccount(projectId, region, gcloud);

  const services = await gcloud([
    'services', 'list', '--enabled', `--project=${projectId}`,
    `--filter=config.name=${IAM_CREDENTIALS_API}`, '--format=value(config.name)',
  ]);
  const apiEnabled = services.code === 0 ? services.stdout.trim() === IAM_CREDENTIALS_API : null;

  const policy = await gcloud(['iam', 'service-accounts', 'get-iam-policy', account, `--project=${projectId}`, '--format=json']);
  let granted: boolean | null = null;
  if (policy.code === 0) {
    try {
      granted = policyGrantsSelfSigning(policy.stdout, account);
    } catch {
      granted = null;
    }
  }

  return { account, source, apiEnabled, granted };
};

/** O que falta, como comandos — os que este comando roda, e os que se entregam a quem tem o papel. */
export const missingSteps = (projectId: string, check: SigningCheck): string[][] => [
  ...(check.apiEnabled === true ? [] : [enableApiArgs(projectId)]),
  ...(check.granted === true ? [] : [grantArgs(projectId, check.account)]),
];

/** Nunca quebra quem chama: sem `gcloud`, o `spawn` falha, e a resposta é "não deu para ler". */
export const gcloudCapture: Gcloud = (args) =>
  capture(GCLOUD_BIN, args).catch((error: unknown) => ({
    code: -1,
    stdout: '',
    stderr: error instanceof Error ? error.message : String(error),
  }));

const isPermissionError = (error: unknown): boolean =>
  error instanceof Error && /PERMISSION_DENIED|403|does not have .*permission|setIamPolicy/i.test(error.message);

const confirm = async (question: string): Promise<boolean> => {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return /^(y|yes)$/i.test((await rl.question(`${question} [y/N] `)).trim());
  } finally {
    rl.close();
  }
};

const regionOf = async (root: string, recorded: string): Promise<string> => {
  try {
    return (await readInstalledManifest(root)).requires.functionsRegion;
  } catch {
    return recorded;
  }
};

/**
 * `microteia grant-signing` — confere a permissão de assinar sessões e, com confirmação, a concede.
 *
 * `--check` só confere. `--yes` dispensa a pergunta (para quem roda num script, e sabe o que roda).
 * Sem terminal e sem `--yes`, recusa: concordar por omissão com uma mudança de permissão é o que este
 * comando existe para não fazer.
 */
export const grantSigning = async (args: ParsedArgs): Promise<void> => {
  const file = resolve(hasFlag(args, 'file') ? requiredFlag(args, 'file') : join(process.cwd(), ENVIRONMENT_FILE));
  const root = dirname(file);
  const environment = await readEnvironment(file);
  const projectId = environment.firebase.projectId;
  if (projectId === null) {
    throw new Error('This installation is not connected yet. Run "microteia connect --project <id>".');
  }
  const region = await regionOf(root, environment.firebase.region);

  heading(`Session signing in ${projectId}`);
  info('Signing in to the portal with an identity provider, and confirming the code of two-step');
  info('verification, open a session the server signs. The functions\' account must be allowed to do it.');
  blank();

  const before = await checkSessionSigning(projectId, region, gcloudCapture);
  info(`  account: ${before.account}`);
  info(before.source === 'function'
    ? `  (read from the deployed function ${SIGNING_FUNCTION})`
    : `  (the default compute account — ${SIGNING_FUNCTION} is not deployed yet, or could not be read)`);
  const state = (value: boolean | null) => (value === null ? 'could not be read' : value ? 'yes' : 'no');
  info(`  ${IAM_CREDENTIALS_API} enabled: ${state(before.apiEnabled)}`);
  info(`  ${TOKEN_CREATOR_ROLE} on itself: ${state(before.granted)}`);
  blank();

  const steps = missingSteps(projectId, before);
  if (steps.length === 0) {
    success('the functions can sign sessions — nothing to change');
    return;
  }

  info(hasFlag(args, 'check') ? 'To grant it, run "microteia grant-signing", or:' : 'This will run:');
  bullets(steps.map(gcloudLine));
  if (before.apiEnabled === null || before.granted === null) {
    warn('part of the current state could not be read; running a step that is already done changes nothing.');
  }
  if (hasFlag(args, 'check')) return;

  blank();
  if (!hasFlag(args, 'yes')) {
    if (!process.stdin.isTTY) {
      throw new Error('Not running in a terminal. Re-run with --yes to apply, or run the commands above.');
    }
    if (!(await confirm('Apply these changes?'))) {
      info('Nothing was changed.');
      return;
    }
  }

  try {
    for (const step of steps) await run(GCLOUD_BIN, step);
  } catch (error) {
    if (!isPermissionError(error)) throw error;
    blank();
    failure('the account signed in to gcloud may not change permissions in this project.');
    info('  It needs Owner, or Service Account Admin plus Service Usage Admin. Ask someone who has them');
    info('  to run:');
    bullets(steps.map(gcloudLine));
    throw new Error('Session signing was not granted.', { cause: error });
  }

  // IAM é eventualmente consistente: a releitura logo depois pode não refletir a concessão ainda.
  const after = await checkSessionSigning(projectId, region, gcloudCapture);
  blank();
  if (after.apiEnabled !== false && after.granted !== false) {
    success('the functions can sign sessions');
  } else {
    warn('the change was accepted but does not show yet — IAM can take a minute. Check again with');
    warn('  microteia grant-signing --check');
  }
};
