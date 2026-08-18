import { capture, sleep } from '../shared/run.js';
import { failure, info, success, warn } from '../shared/ui.js';
import { FIREBASE_BIN } from './firebaseCli.js';

export interface FunctionDeployOptions {
  projectId: string;
  cwd: string;
  delaySeconds: number;
  /** `--force` deixa o Firebase configurar sozinho a política de limpeza do Artifact Registry. */
  force: boolean;
}

export interface FunctionDeployReport {
  deployed: string[];
  failed: { name: string; output: string }[];
}

/**
 * O deploy é UMA A UMA, e não `--only functions` de uma vez, porque em lote ele estoura a quota de
 * CPU do projeto — o motivo pelo qual `scripts/deploy-functions-individually.cjs` existe deste lado.
 * O cliente bate exatamente na mesma parede, com a diferença de que ele não tem o script.
 *
 * A segunda passada não é teimosia: numa instalação nova as identidades de serviço do Pub/Sub e do
 * Eventarc são criadas DURANTE o primeiro deploy e não propagam a tempo, então toda function de
 * gatilho falha enquanto as callables sobem normalmente. Repetir resolve, e sem isso a primeira
 * instalação parece quebrada quando está apenas incompleta.
 */
const deployOne = async (
  name: string,
  options: FunctionDeployOptions,
): Promise<{ ok: boolean; output: string }> => {
  const args = ['deploy', '--only', `functions:${name}`, '--project', options.projectId];
  if (options.force) args.push('--force');

  const result = await capture(FIREBASE_BIN, args, { cwd: options.cwd });
  return { ok: result.code === 0, output: `${result.stdout}${result.stderr}`.trim() };
};

export const deployFunctionsOneByOne = async (
  names: string[],
  options: FunctionDeployOptions,
): Promise<FunctionDeployReport> => {
  const deployed: string[] = [];
  let pending = names;

  for (let pass = 1; pass <= 2 && pending.length > 0; pass += 1) {
    if (pass === 2) {
      info(`\n  Retrying ${pending.length} function(s). On a new project the Pub/Sub and Eventarc`);
      info('  service identities are created during the first deploy and do not propagate in time.');
    }

    const failedThisPass: string[] = [];
    const outputs = new Map<string, string>();

    for (let index = 0; index < pending.length; index += 1) {
      const name = pending[index];
      const label = `[${index + 1}/${pending.length}] ${name}`;

      const { ok, output } = await deployOne(name, options);

      if (ok) {
        success(label);
        deployed.push(name);
      } else {
        failure(label);
        failedThisPass.push(name);
        outputs.set(name, output);
      }

      if (index < pending.length - 1 && options.delaySeconds > 0) {
        await sleep(options.delaySeconds);
      }
    }

    pending = failedThisPass;

    if (pending.length > 0 && pass === 2) {
      return {
        deployed,
        failed: pending.map((name) => ({ name, output: outputs.get(name) ?? '' })),
      };
    }
  }

  if (pending.length > 0) warn(`${pending.length} function(s) still pending.`);

  return { deployed, failed: [] };
};
