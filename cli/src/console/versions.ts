import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CLI_VERSION } from '../shared/paths.js';
import { ENVIRONMENT_FILE, parseEnvironment } from './environment.js';
import { installPath } from './unpack.js';

/**
 * O que `microteia --version` responde.
 *
 * O Console tem versão PRÓPRIA e deliberadamente independente do kernel — é ela que o
 * `minimumCliVersion` do pacote confere. Só que quem pergunta a versão quase nunca quer saber da
 * ferramenta: quer saber que Microteia está rodando ali. Responder um número só, e justamente o que
 * não é o do produto, manda procurar no `MICROTEIA.md` o que a pergunta já era.
 *
 * As duas do kernel são lidas de fontes DIFERENTES de propósito. A que está no lugar vem do manifesto
 * do pacote desempacotado, que é o artefato; a publicada vem do `microteia.yaml`, que é registro do que
 * um comando fez. Ler as duas do mesmo lugar seria não poder mostrar que elas divergem — e divergir é o
 * estado normal entre `unpack` e `deploy`.
 */
const readJson = async <T>(path: string): Promise<T | null> => {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch {
    return null;
  }
};

/**
 * Como o relatório descobre se há versão nova. É INJETADO, e não chamado daqui: `--version` é o primeiro
 * comando que se roda quando algo está estranho, e a resposta que se cola num pedido de ajuda. Ele
 * responde sobre a instalação, não sobre a rede — quem quiser a checagem passa o `newerThan`, e quem
 * está testando ou offline não paga por ela.
 */
export type NewerLookup = (version: string | null) => Promise<{ version: string } | null>;

export const versionReport = async (directory: string, newer?: NewerLookup): Promise<string[]> => {
  const lines = [`Microteia Console ${CLI_VERSION}`];

  const source = await readFile(join(directory, ENVIRONMENT_FILE), 'utf8').catch(() => null);
  if (source === null) return lines;

  /**
   * Um `microteia.yaml` ilegível não pode fazer `--version` falhar: ele é o primeiro comando que se
   * roda quando algo está estranho, e é a resposta que se cola num pedido de ajuda.
   */
  const environment = (() => {
    try {
      return parseEnvironment(source);
    } catch {
      return null;
    }
  })();
  if (environment === null) {
    lines.push(`This installation's ${ENVIRONMENT_FILE} could not be read.`);
    return lines;
  }

  const manifest = await readJson<{ version?: string; kernelVersion?: string }>(
    join(installPath(directory), 'manifest.json'),
  );
  const inPlace = manifest?.version ?? environment.kernel.version;
  const deployed = environment.kernel.deployed;

  lines.push(`Installation      ${environment.project.name}`);
  lines.push(`Firebase project  ${environment.firebase.projectId ?? 'not connected'}`);
  lines.push(`Kernel in place   ${inPlace ?? 'none — run "microteia unpack --version latest"'}`);
  lines.push(`Kernel deployed   ${deployed ?? 'none — run "microteia deploy"'}`);

  if (manifest?.kernelVersion !== undefined) {
    lines.push(`Plugin contract   ${manifest.kernelVersion}`);
  }

  if (inPlace !== null && deployed !== null && inPlace !== deployed) {
    lines.push('');
    lines.push(`${inPlace} is in place and ${deployed} is what the project runs. "microteia deploy" publishes it.`);
  }

  /**
   * E o que o canal oferece, quando há canal alcançável. Vem por último porque é a única linha que
   * depende de rede: se ela faltar, tudo acima continua sendo a resposta inteira.
   */
  const available = newer === undefined ? null : await newer(inPlace);
  if (available !== null) {
    lines.push('');
    lines.push(`Kernel ${available.version} is published. "microteia unpack --version latest" takes it.`);
  }

  return lines;
};
