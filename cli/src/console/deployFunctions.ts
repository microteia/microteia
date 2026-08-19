import { capture, sleep } from '../shared/run.js';
import { failure, info, pending, success, warn } from '../shared/ui.js';
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
 * A linha que EXPLICA a falha, tirada da saída do `firebase`.
 *
 * Existe porque imprimir só `fail  [13/23] auditNestedEntityChange` não deixa nada a fazer para quem
 * está instalando: se a segunda passada resolver, o motivo é descartado e nunca chega a ser visto; se
 * não resolver, ele só aparece no fim, depois de mais dez minutos de deploy. O motivo tem de sair no
 * momento da falha.
 *
 * A saída do `firebase` é ruidosa, então a busca é pelas linhas que carregam o diagnóstico — as de
 * `Error`, as de `functions[nome]` e as marcadas com o sinal de aviso dele.
 */
const REASON_LIMIT = 240;

export const failureReason = (output: string): string => {
  const lines = output.split('\n').map((line) => line.trim()).filter((line) => line !== '');
  const meaningful = lines.filter((line) => /(^|\s)(Error|error:|HTTP Error|functions\[|⚠|✖)/.test(line));
  const chosen = (meaningful.length > 0 ? meaningful : lines).slice(-1)[0] ?? 'no output from firebase';
  return chosen.length > REASON_LIMIT ? `${chosen.slice(0, REASON_LIMIT - 1)}…` : chosen;
};

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
): Promise<{ ok: boolean; output: string; seconds: number }> => {
  const args = ['deploy', '--only', `functions:${name}`, '--project', options.projectId];
  if (options.force) args.push('--force');

  const startedAt = Date.now();
  const result = await capture(FIREBASE_BIN, args, { cwd: options.cwd });
  return {
    ok: result.code === 0,
    output: `${result.stdout}${result.stderr}`.trim(),
    seconds: Math.round((Date.now() - startedAt) / 1000),
  };
};

export const deployFunctionsOneByOne = async (
  names: string[],
  options: FunctionDeployOptions,
): Promise<FunctionDeployReport> => {
  const deployed: string[] = [];
  let remaining = names;

  for (let pass = 1; pass <= 2 && remaining.length > 0; pass += 1) {
    if (pass === 2) {
      info(`\n  Retrying ${remaining.length} function(s). On a new project the Pub/Sub and Eventarc`);
      info('  service identities are created during the first deploy and do not propagate in time.');
    } else if (options.force) {
      // Só na PRIMEIRA instalação, que é o que `force` significa: é ali que o Firebase provisiona build
      // e Artifact Registry, e a primeira function leva vários minutos. Dizer isso ANTES é o que separa
      // "demorado" de "travado" para quem está olhando. Num `provision` de projeto já montado a dica
      // seria falsa, e por isso ela não aparece lá.
      info(`  the first of the ${remaining.length} takes the longest — on a new project Firebase sets`);
      info('  up the build infrastructure before it can deploy anything.');
    }

    const failedThisPass: string[] = [];
    const outputs = new Map<string, string>();

    for (let index = 0; index < remaining.length; index += 1) {
      const name = remaining[index];
      const label = `[${index + 1}/${remaining.length}] ${name}`;

      pending(label);
      const { ok, output, seconds } = await deployOne(name, options);

      if (ok) {
        success(`${label} (${seconds}s)`);
        deployed.push(name);
      } else {
        failure(`${label} (failed after ${seconds}s)`);
        // O motivo AGORA, não só no relatório final: numa instalação nova as functions de gatilho
        // falham na primeira passada por propagação de identidade de serviço, a segunda resolve, e sem
        // esta linha quem instala vê um "fail" que nunca é explicado.
        info(`        ${failureReason(output)}`);
        if (pass === 1) info('        retrying at the end of this pass');
        failedThisPass.push(name);
        outputs.set(name, output);
      }

      if (index < remaining.length - 1 && options.delaySeconds > 0) {
        await sleep(options.delaySeconds);
      }
    }

    remaining = failedThisPass;

    if (remaining.length > 0 && pass === 2) {
      return {
        deployed,
        failed: remaining.map((name) => ({ name, output: outputs.get(name) ?? '' })),
      };
    }
  }

  if (remaining.length > 0) warn(`${remaining.length} function(s) still pending.`);

  return { deployed, failed: [] };
};
