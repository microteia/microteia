import { capture } from '../shared/run.js';
import { blank, bullets, failure, info, pending, success, warn } from '../shared/ui.js';
import { FIREBASE_BIN, parseJson } from './firebaseCli.js';
import { failureReason } from './deployFunctions.js';

export interface DeployedFunction {
  name: string;
  region: string;
  /**
   * O carimbo que o PRÓPRIO `firebase` grava na function, no label `firebase-functions-hash`:
   * sha1 do diretório de fontes inteiro, mais as variáveis de ambiente resolvidas, mais as versões
   * de segredo. É o valor que ele compara consigo mesmo para pular uma function que não mudou num
   * deploy em lote (`calculateChangesets`), e é por isso que ele serve aqui: comparar por ele é
   * tomar a MESMA decisão que o `firebase deploy` tomaria, não uma parecida.
   *
   * `null` quando a function foi deployada por uma versão do CLI que não gravava o label — nesse
   * caso não há o que comparar, e ela sobe.
   */
  hash: string | null;
  /** `ACTIVE` é a única resposta que autoriza comparar: o resto está no meio de alguma coisa. */
  state: string;
  /** `gcfv1` e `gcfv2` empacotam fontes diferentes, então carimbam hashes diferentes. */
  platform: string;
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
      .map((entry) => ({
        name: String(entry.id ?? ''),
        region: String(entry.region ?? ''),
        hash: typeof entry.hash === 'string' && entry.hash !== '' ? entry.hash : null,
        state: typeof entry.state === 'string' ? entry.state : '',
        platform: typeof entry.platform === 'string' ? entry.platform : '',
      }))
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
): Promise<ReadonlySet<string>> => {
  if (orphans.length === 0) return new Set();

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
    return new Set(orphans.map((orphan) => orphan.name));
  }

  const plural = orphans.length === 1 ? 'copy' : 'copies';
  info(`  --prune: removing the ${orphans.length} old ${plural} before deploying.`);
  const standing = new Set<string>();

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
      standing.add(orphan.name);
    }
  }

  blank();
  return standing;
};

/**
 * O passo inteiro, para quem só quer chamá-lo antes de deployar. Devolve os nomes cuja cópia antiga
 * CONTINUA de pé, ou `null` quando não deu para verificar — e não bloqueia o deploy em nenhum dos dois
 * casos, pela mesma razão de `listDeployedFunctions`.
 *
 * O conjunto é o que autoriza o `--force` pontual de `deployFunctionsOneByOne`: com ele o `firebase`
 * aceita a política de repetição E apaga sem perguntar a cópia de outra região, e essa segunda decisão
 * é do escritório, pedida com `--prune`. Não saber equivale a ter cópia.
 */
export const clearRegionOrphans = async (
  projectId: string,
  wanted: string[],
  region: string,
  prune: boolean,
  /**
   * A listagem já feita, quando quem chama vai usá-la para outra coisa também. Perguntar duas vezes
   * a mesma coisa ao mesmo projeto não é caro, é ambíguo: as duas respostas podem divergir, e a
   * decisão passa a depender de qual delas o código olhou.
   */
  listed?: DeployedFunction[] | null,
): Promise<ReadonlySet<string> | null> => {
  const deployed = listed === undefined ? await listDeployedFunctions(projectId) : listed;
  if (deployed === null) return null;
  return settleRegionOrphans(projectId, regionOrphans(deployed, wanted, region), prune);
};
