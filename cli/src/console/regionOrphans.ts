import { capture } from '../shared/run.js';
import { blank, bullets, failure, info, pending, success, warn } from '../shared/ui.js';
import { FIREBASE_BIN, parseJson } from './firebaseCli.js';
import { failureReason } from './deployFunctions.js';

export interface DeployedFunction {
  name: string;
  region: string;
}

/**
 * A cópia da mesma function numa região que o pacote não usa mais.
 *
 * Mudar a região de uma Cloud Function não move nada: o Firebase cria a nova e a antiga fica. A
 * partir daí o `firebase deploy --only functions:<nome>` PARA — o filtro `--only` casa por id e
 * ignora região (`endpointMatchesFilter`), então a cópia velha entra no plano como algo a apagar, e
 * apagar exige confirmação que este deploy não tem como dar. A recusa é a mesma em toda tentativa.
 *
 * E o deploy travado é o menor dos dois problemas. Enquanto as duas cópias existem, um gatilho de
 * Firestore dispara NAS DUAS a cada gravação: linha de auditoria em dobro, agregado contado duas
 * vezes, evento de workflow publicado duas vezes. Isso não aparece em lugar nenhum como erro.
 */
export interface RegionOrphan {
  name: string;
  region: string;
}

/**
 * Devolve `null` quando não deu para perguntar — conta sem permissão de listar, projeto fora do ar.
 * Não saber não é motivo para impedir um deploy que talvez funcionasse: a verificação existe para
 * explicar uma falha, não para criar uma.
 */
export const listDeployedFunctions = async (projectId: string): Promise<DeployedFunction[] | null> => {
  const result = await capture(FIREBASE_BIN, ['functions:list', '--project', projectId, '--json']);
  if (result.code !== 0) return null;

  try {
    const parsed = parseJson(result.stdout) as { result?: unknown };
    if (!Array.isArray(parsed.result)) return null;

    return parsed.result
      .filter((entry): entry is Record<string, unknown> => entry !== null && typeof entry === 'object')
      .map((entry) => ({ name: String(entry.id ?? ''), region: String(entry.region ?? '') }))
      .filter((entry) => entry.name !== '' && entry.region !== '');
  } catch {
    return null;
  }
};

/**
 * Só o que ESTE deploy vai tocar. Casar por "região diferente da esperada" acusaria também uma
 * function que o escritório escreveu de propósito em outra região; casar pelos nomes que estão para
 * subir é exatamente o conjunto que o `firebase` vai querer apagar, nem um a mais.
 */
export const regionOrphans = (
  deployed: DeployedFunction[],
  wanted: string[],
  region: string,
): RegionOrphan[] => {
  const names = new Set(wanted);
  return deployed
    .filter((entry) => names.has(entry.name) && entry.region !== region)
    .map((entry) => ({ name: entry.name, region: entry.region }))
    .sort((left, right) => (left.name === right.name
      ? left.region.localeCompare(right.region)
      : left.name.localeCompare(right.name)));
};

export const deleteCommand = (projectId: string, orphan: RegionOrphan): string =>
  `firebase functions:delete ${orphan.name} --region ${orphan.region} --project ${projectId} --force`;

/**
 * Avisa por padrão e só apaga com `--prune`, como `settleOrphans` faz com a function que perdeu dono.
 * Apagar uma Cloud Function é irreversível e é do escritório, não nosso: o comando tem de ser pedido.
 */
export const settleRegionOrphans = async (
  projectId: string,
  orphans: RegionOrphan[],
  prune: boolean,
): Promise<boolean> => {
  if (orphans.length === 0) return true;

  blank();
  warn(`${orphans.length} function(s) are still deployed in a region this package no longer uses:`);
  bullets(orphans.map((orphan) => `${orphan.name} (${orphan.region})`));
  info('  Changing the region of a function does not move it: Firebase created the new one and left');
  info('  the old one behind. The deploy of each of these will refuse to run — it would have to');
  info('  delete the old copy first, and it has no terminal to ask. Every attempt answers the same.');
  info('  While both copies exist, a Firestore trigger fires TWICE on every write: audit rows,');
  info('  aggregates and workflow events are all counted twice, and nothing reports that as an error.');

  if (!prune) {
    info('  To remove them:');
    bullets(['microteia deploy --prune']);
    info('  or one at a time:');
    bullets(orphans.map((orphan) => deleteCommand(projectId, orphan)));
    blank();
    return false;
  }

  const plural = orphans.length === 1 ? 'copy' : 'copies';
  info(`  --prune: removing the ${orphans.length} old ${plural} before deploying.`);
  let cleared = true;

  for (const orphan of orphans) {
    const label = `${orphan.name} (${orphan.region})`;
    pending(label);
    const result = await capture(FIREBASE_BIN, [
      'functions:delete', orphan.name,
      '--region', orphan.region,
      '--project', projectId,
      '--force',
    ]);

    if (result.code === 0) {
      success(`${label} removed`);
    } else {
      failure(`${label} could not be removed`);
      info(`        ${failureReason(`${result.stdout}${result.stderr}`)}`);
      info(`        ${deleteCommand(projectId, orphan)}`);
      cleared = false;
    }
  }

  blank();
  return cleared;
};

/**
 * O passo inteiro, para quem só quer chamá-lo antes de deployar. Devolve `true` quando o caminho está
 * livre — inclusive quando não deu para verificar, pela mesma razão de `listDeployedFunctions`.
 */
export const clearRegionOrphans = async (
  projectId: string,
  wanted: string[],
  region: string,
  prune: boolean,
): Promise<boolean> => {
  const deployed = await listDeployedFunctions(projectId);
  if (deployed === null) return true;
  return settleRegionOrphans(projectId, regionOrphans(deployed, wanted, region), prune);
};
