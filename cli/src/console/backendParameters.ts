import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { BackendClaim } from '../kernel/backendShape.js';

/**
 * O valor de um parâmetro de backend é carimbado no deploy de CADA function: o `firebase-functions`
 * resolve os `defineString` e grava o resultado como variável de ambiente da function que está
 * subindo. Quem preenche `functions/.env.<projectId>` DEPOIS da instalação não alcança function
 * nenhuma — ela continua rodando com a string vazia que o `ensureBackendEnv` escreveu, e a falha
 * aparece só no runtime da feature.
 *
 * O provisionamento não notava isso porque o estado que ele guardava era só QUAIS functions subiram,
 * nunca COM QUAIS VALORES. Este módulo é a outra metade: uma impressão digital por parâmetro no
 * `microteia.yaml`, comparada a cada execução. Parâmetro que mudou torna obsoletas as functions da
 * extensão que o declara, e elas voltam para a fila de deploy mesmo já estando aplicadas.
 */

/**
 * Os parâmetros PREENCHIDOS do arquivo de ambiente. Linha sem valor é ausência: é assim que o
 * `ensureBackendEnv` grava o que ainda falta, e tratá-la como valor faria toda instalação nova nascer
 * com uma mudança pendente.
 */
export const parseBackendEnv = (content: string): Map<string, string> => {
  const values = new Map<string, string>();

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;

    const name = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (name === '' || value === '') continue;
    values.set(name, value);
  }

  return values;
};

export const readBackendEnv = async (install: string, projectId: string): Promise<Map<string, string>> => {
  const content = await readFile(join(install, 'functions', `.env.${projectId}`), 'utf8').catch(() => null);
  return content === null ? new Map() : parseBackendEnv(content);
};

/**
 * A impressão digital é SALGADA com o projeto e o nome do parâmetro. O `microteia.yaml` fica ao lado
 * das Cloud Functions do escritório e não guarda credencial: um sha256 puro de um valor curto seria
 * uma consulta de dicionário, e um salgado não é. Doze hexadecimais bastam para detectar mudança e
 * não reconstroem valor nenhum.
 */
export const parameterDigest = (projectId: string, name: string, value: string): string =>
  createHash('sha256').update(`${projectId} ${name} ${value}`).digest('hex').slice(0, 12);

export const parameterDigests = (
  projectId: string,
  values: Map<string, string>,
  tracked: string[],
): Map<string, string> => {
  const digests = new Map<string, string>();

  for (const name of tracked) {
    const value = values.get(name);
    if (value === undefined) continue;
    digests.set(name, parameterDigest(projectId, name, value));
  }

  return digests;
};

/**
 * `NOME:digest` separado por vírgula, no mesmo escalar de `backend.functions` e pelo mesmo motivo: o
 * leitor de YAML daqui entende mapas de dois níveis e escalares, e trazer sequências para guardar meia
 * dúzia de pares seria pagar caro pela generalidade.
 */
export const parseParameterState = (raw: string | null): Map<string, string> => {
  const state = new Map<string, string>();

  for (const entry of (raw ?? '').split(',')) {
    const trimmed = entry.trim();
    if (trimmed === '') continue;

    const separator = trimmed.lastIndexOf(':');
    if (separator <= 0) continue;
    state.set(trimmed.slice(0, separator), trimmed.slice(separator + 1));
  }

  return state;
};

export const serializeParameterState = (state: Map<string, string>): string | null => {
  const entries = [...state.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, digest]) => `${name}:${digest}`);
  return entries.length === 0 ? null : entries.join(',');
};

/**
 * O que mudou entre o que foi aplicado e o que está no arquivo agora — incluindo o parâmetro que
 * ESVAZIOU, porque a function deployada continua carregando o valor antigo e convergir é reescrevê-la
 * com o que o arquivo diz.
 */
export const changedParameters = (
  recorded: Map<string, string>,
  current: Map<string, string>,
  tracked: string[],
): string[] => tracked.filter((name) => recorded.get(name) !== current.get(name)).sort();

/** As functions das extensões que declaram algum destes parâmetros. */
export const functionsDeclaringParameters = (claims: BackendClaim[], names: string[]): string[] => {
  const wanted = new Set(names);
  return [...new Set(
    claims
      .filter((claim) => (claim.backend.parameters ?? []).some((name) => wanted.has(name)))
      .flatMap((claim) => claim.backend.functions ?? []),
  )].sort();
};
