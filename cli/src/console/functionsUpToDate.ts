import { blank, info, success, warn } from '../shared/ui.js';
import { deployFunctionsOneByOne } from './deployFunctions.js';
import type { FunctionDeployOptions, FunctionDeployReport } from './deployFunctions.js';
import { listDeployedFunctions } from './regionOrphans.js';
import type { DeployedFunction } from './regionOrphans.js';

/**
 * O deploy que não sobe de novo o que o projeto já roda.
 *
 * O `firebase` sabe responder isso, e sempre soube: ele grava em cada function o label
 * `firebase-functions-hash` — sha1 do diretório de fontes INTEIRO, mais as variáveis de ambiente
 * resolvidas, mais as versões de segredo — e num deploy em lote pula toda function cujo carimbo
 * gravado é igual ao que o código atual produz. O que desliga esse pulo é justamente o
 * `--only functions:<nome>` com que o Console deploya: `planner.js` só pula endpoint que
 * `!targetedByOnly`, e nomear a function no `--only` a marca. Deployar uma a uma não é opcional (em
 * lote estoura a quota de CPU do projeto), então o pulo teve de ser reconstruído aqui.
 *
 * **Não é um mecanismo de detecção novo, e essa é a decisão inteira.** Não há digest nosso, não há
 * lista de insumos que alguém possa esquecer de atualizar, não há estado guardado que possa divergir
 * do projeto. O carimbo é do `firebase`: calculado por ele, gravado por ele na function, lido do
 * projeto a cada execução. Comparar por ele é tomar a MESMA decisão que o `firebase deploy` tomaria.
 *
 * O que faltava é o outro lado da comparação: o carimbo que o código de AGORA produziria. Calculá-lo
 * aqui exigiria reimplementar o algoritmo dele — e uma reimplementação que envelhece em silêncio é
 * exatamente o que não se quer num comando que decide NÃO publicar. Em vez disso ele é OBSERVADO: as
 * functions são agrupadas pelo carimbo que carregam, UMA de cada grupo é deployada, e o carimbo que
 * ela volta carregando é o carimbo do código de agora. Voltou igual, o grupo inteiro é byte a byte o
 * que o projeto já roda; voltou diferente, o grupo inteiro sobe.
 *
 * A sonda ser MEMBRO do grupo é o que faz a conclusão valer para os outros: duas functions com o
 * mesmo carimbo antigo têm, além da mesma fonte e do mesmo ambiente, o mesmo conjunto de segredos —
 * é a terceira parcela do hash. Uma sonda de fora do grupo não provaria isso.
 *
 * Ler o carimbo da sonda logo depois de ela subir depende de o `functions:list` já enxergar o que o
 * deploy acabou de gravar. Não é uma aposta nossa: é a MESMA leitura de que o `firebase deploy`
 * depende para montar o `haveBackend` com que ele decide o que pular, e o comando só retorna depois
 * de a operação do Google ter terminado.
 *
 * O custo do pior caso é o comportamento de hoje; o do caso bom é uma function em vez de 28.
 *
 * O que ele NÃO enxerga — porque o `firebase deploy` em lote também não — é configuração trocada por
 * fora, pelo console do Google: memória, timeout, concorrência, política de invocação. Para isso
 * existe `--all`. O alcance das callables continua conferido em TODAS a cada deploy, inclusive nas
 * que não subiram, e é ele que acusa uma concessão de IAM removida por fora.
 */
const ACTIVE = 'ACTIVE';

/** As functions que o projeto roda com exatamente o mesmo carimbo. */
export interface HashGroup {
  hash: string;
  platform: string;
  names: string[];
}

export interface DeployPlan {
  /**
   * Sem carimbo com que comparar: ausente do projeto, em outra região, no meio de um deploy, ou
   * deployada por um CLI que não gravava o label. Sobem sempre — não saber nunca vira pular.
   */
  unverifiable: string[];
  groups: HashGroup[];
}

const SEPARATOR = ' ';

export const planFunctionDeploy = (
  wanted: string[],
  deployed: DeployedFunction[] | null,
  region: string,
): DeployPlan => {
  if (deployed === null) return { unverifiable: [...wanted], groups: [] };

  const byName = new Map<string, DeployedFunction>();
  for (const entry of deployed) {
    if (entry.region === region) byName.set(entry.name, entry);
  }

  const unverifiable: string[] = [];
  const grouped = new Map<string, string[]>();

  for (const name of wanted) {
    const entry = byName.get(name);
    if (entry === undefined || entry.state !== ACTIVE || entry.hash === null) {
      unverifiable.push(name);
      continue;
    }

    // A plataforma entra na chave porque `gcfv1` e `gcfv2` empacotam fontes diferentes e carimbam
    // hashes diferentes: o carimbo de uma nunca fala pela outra.
    const key = `${entry.platform}${SEPARATOR}${entry.hash}`;
    const names = grouped.get(key);
    if (names === undefined) grouped.set(key, [name]);
    else names.push(name);
  }

  const groups = [...grouped.entries()].map(([key, names]) => {
    const [platform, hash] = key.split(SEPARATOR);
    return { hash, platform, names };
  });

  return { unverifiable, groups };
};

export interface UpToDateReport extends FunctionDeployReport {
  /** Não subiram porque o projeto já roda exatamente este código. */
  skipped: string[];
  /**
   * O carimbo antigo de cada grupo sondado, e o que a sonda dele voltou carregando. É o que deixa o
   * provisionamento decidir sobre as functions de extensão sem sondar de novo: elas estão no MESMO
   * codebase, então o carimbo de agora é o mesmo.
   */
  refreshed: Map<string, string>;
}

const merge = (left: FunctionDeployReport, right: FunctionDeployReport): FunctionDeployReport => ({
  deployed: [...left.deployed, ...right.deployed],
  failed: [...left.failed, ...right.failed],
  notices: [...new Set([...left.notices, ...right.notices])],
});

const plural = (count: number, singular: string): string => (count === 1 ? singular : `${singular}s`);

export interface UpToDateContext {
  /** A listagem que o comando já fez, para não perguntar duas vezes a mesma coisa ao projeto. */
  deployed: DeployedFunction[] | null;
  region: string;
  /** `--all`: sobe todas, sem perguntar ao projeto o que ele já roda. */
  all: boolean;
}

export const deployFunctionsThatChanged = async (
  wanted: string[],
  options: FunctionDeployOptions,
  context: UpToDateContext,
): Promise<UpToDateReport> => {
  const plain = async (names: string[]): Promise<UpToDateReport> => ({
    ...(await deployFunctionsOneByOne(names, options)),
    skipped: [],
    refreshed: new Map<string, string>(),
  });

  if (wanted.length === 0) return plain(wanted);

  if (context.all) {
    info(`  --all: deploying all ${wanted.length}, without asking the project what it already runs.`);
    return plain(wanted);
  }

  const plan = planFunctionDeploy(wanted, context.deployed, context.region);
  if (plan.groups.length === 0) {
    // Nada com que comparar. Numa instalação nova é o caso normal, e é o certo: não há nada lá.
    return plain(wanted);
  }

  const comparable = plan.groups.reduce((count, group) => count + group.names.length, 0);
  const probes = plan.groups.map((group) => group.names[0]);
  const candidates = comparable - probes.length;

  info(`  ${comparable} of the ${wanted.length} already run in this project carrying a Firebase stamp`);
  info(`  of the source, settings and secrets they were built with. Deploying ${probes.length} reference`);
  info(`  ${plural(probes.length, 'function')} first (${probes.join(', ')}): if the stamp comes back`);
  info(`  unchanged, the other ${candidates} are what the project already runs and are left alone.`);
  info('  It is the same comparison "firebase deploy" makes when it deploys in bulk.');
  blank();

  // As sondas primeiro: é o que se aprende com elas que decide o resto.
  const first = await deployFunctionsOneByOne([...probes, ...plan.unverifiable], options);

  const fresh = await listDeployedFunctions(options.projectId);
  const freshByName = new Map<string, DeployedFunction>();
  for (const entry of fresh ?? []) {
    if (entry.region === context.region) freshByName.set(entry.name, entry);
  }

  const refreshed = new Map<string, string>();
  const skipped: string[] = [];
  const rest: string[] = [];
  let unconfirmed = 0;

  for (const group of plan.groups) {
    const [probe, ...others] = group.names;
    if (others.length === 0) continue;

    const entry = freshByName.get(probe);
    const stamp = first.deployed.includes(probe) && entry !== undefined && entry.state === ACTIVE
      ? entry.hash
      : null;

    if (stamp === null) {
      // Não deu para ler o carimbo novo da sonda: a resposta é subir, que é o que se fazia antes
      // deste mecanismo existir. Não saber nunca vira pular.
      unconfirmed += others.length;
      rest.push(...others);
      continue;
    }

    refreshed.set(group.hash, stamp);
    if (stamp === group.hash) skipped.push(...others);
    else rest.push(...others);
  }

  blank();
  if (skipped.length > 0) {
    success(`${skipped.length} ${plural(skipped.length, 'function')} already up to date — same source,`);
    info('        settings and secrets as what this project runs. Not deployed.');
  }
  if (unconfirmed > 0) {
    warn(`could not read the new stamp of ${unconfirmed} ${plural(unconfirmed, 'function')}: deploying them.`);
  }
  if (rest.length > 0) {
    info(`  ${rest.length} ${plural(rest.length, 'function')} changed and go up now.`);
  }
  blank();

  const second = await deployFunctionsOneByOne(rest, options);
  return { ...merge(first, second), skipped, refreshed };
};

/**
 * A function de extensão que o projeto roda e que este pacote não constrói mais assim.
 *
 * Ela existe porque o provisionamento sempre decidiu por NOME: uma function já aplicada só voltava
 * para a fila quando um parâmetro dela mudava de valor. Editar o código em
 * `extensions/<plugin>/functions/` não movia nada — a fonte mudava, o pacote era remontado, e a
 * function seguia rodando a versão anterior sem que comando nenhum a alcançasse.
 *
 * O carimbo responde isso de graça, e sem sondar nada: a function de extensão está no MESMO codebase
 * da baseline, então o carimbo que a sonda do `deploy` acabou de observar é o dela também.
 */
export interface OutdatedFunctions {
  /** Não estão rodando em lugar nenhum do projeto, apesar de a lista de nomes dizer que subiram. */
  absent: string[];
  /** Estão lá, e carregam um carimbo anterior ao que este pacote constrói. */
  stale: string[];
}

export const outdatedByStamp = (
  applied: string[],
  deployed: DeployedFunction[] | null,
  region: string,
  /** Carimbo antigo -> carimbo de agora, observado pelas sondas. Ausente: não há o que concluir. */
  refreshed: Map<string, string> | undefined,
): OutdatedFunctions => {
  if (deployed === null) return { absent: [], stale: [] };

  const byName = new Map<string, DeployedFunction>();
  const running = new Set<string>();
  for (const entry of deployed) {
    // A ausência é perguntada ao projeto INTEIRO, e não à região do pacote: uma function que o
    // escritório escreveu de propósito noutra região está rodando, e devolvê-la à fila por não estar
    // aqui a redeployaria em toda execução, para sempre. É a mesma distinção que `regionOrphans` faz
    // ao casar por nome-que-vai-subir em vez de por região diferente da esperada.
    if (entry.state === ACTIVE) running.add(entry.name);
    if (entry.region === region) byName.set(entry.name, entry);
  }

  const absent: string[] = [];
  const stale: string[] = [];

  for (const name of applied) {
    if (!running.has(name)) {
      absent.push(name);
      continue;
    }

    const entry = byName.get(name);
    if (entry === undefined || entry.state !== ACTIVE) continue;

    // Sem carimbo, ou sem o carimbo de agora com que compará-lo, não há conclusão a tirar — e a
    // ausência de conclusão mantém o comportamento anterior a este mecanismo, que é não mexer.
    if (entry.hash === null || refreshed === undefined) continue;

    const now = refreshed.get(entry.hash);
    if (now !== undefined && now !== entry.hash) stale.push(name);
  }

  return { absent, stale };
};
