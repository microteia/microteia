import { asArray, asInteger, asMap, asString, asTimestamp, patchFields } from './firestoreRest.js';
import type { FirestoreTypedValue } from './firestoreRest.js';
import { CLI_VERSION } from '../shared/paths.js';

/**
 * O que o provisionamento descobriu, devolvido para o banco — onde a APLICAÇÃO pode ler.
 *
 * O `provision` é o único ponto do sistema capaz de dizer "esta Cloud Function não tem mais dono": a
 * resposta exige varrer todos os escritórios do projeto e comparar com o registro de aplicadas. Ele
 * dizia isso no terminal e guardava a conclusão no `microteia.yaml` — um arquivo na máquina de quem
 * rodou o comando. Quem clicou em Desinstalar, na aplicação, nunca ficava sabendo de nada; e quem lê a
 * tela de Extensões não é necessariamente quem tem acesso ao projeto Firebase.
 *
 * O efeito era o mesmo em toda instalação: o `--prune` continua sendo um ato explícito — e isso está
 * certo, apagar é destrutivo e irreversível —, mas ninguém tinha como saber que ele era necessário. O
 * mecanismo inteiro dependia de alguém lembrar.
 *
 * A tela de Extensões já mostra o selo "Backend pendente" para o caso da INSTALAÇÃO. Este documento é o
 * par que faltava, o da RETIRADA, e não inventa caminho novo: o Console já escreve no banco pela REST
 * (é assim que `backendState` é carimbado), e o pacote já tem uma coleção global de espelho somente
 * leitura escrita só com credencial de administrador (`workflow_step_catalog`).
 */

/**
 * Um documento só, de nome fixo. A órfã é um fato do PROJETO — não de um escritório —, então guardá-la
 * por tenant seria guardar a mesma resposta N vezes e deixar N maneiras de ela divergir.
 */
export const BACKEND_RESIDUE_PATH = '/backend_state/current';

export interface OrphanFunctionRecord {
  name: string;
  /** O plugin que a reivindicava quando ela subiu. Vazio numa instalação anterior ao registro com dono. */
  owner: string;
}

export interface BackendResidueInput {
  /** Quando a varredura aconteceu. É o que permite a quem lê saber se a informação é de hoje. */
  scannedAt: Date;
  /** Escritórios lidos, e cópias de extensão lidas: a contagem que SUSTENTA a afirmação. */
  tenants: number;
  extensions: number;
  functions: OrphanFunctionRecord[];
  /** O índice órfão, na forma legível que o relatório do terminal também usa. */
  indexes: string[];
}

/**
 * Os campos do documento, montados sem tocar na rede.
 *
 * Separado da escrita porque é a FORMA que é contrato: ela é lida pelo kernel, que é versionado à parte
 * do Console. Um campo renomeado aqui é uma tela que deixa de avisar, em silêncio — e é essa a
 * verificação que o teste faz.
 */
export const backendResidueFields = (
  input: BackendResidueInput,
): Record<string, FirestoreTypedValue> => ({
  scannedAt: asTimestamp(input.scannedAt),
  consoleVersion: asString(CLI_VERSION),
  tenants: asInteger(input.tenants),
  extensions: asInteger(input.extensions),
  orphanFunctions: asArray(input.functions.map((entry) => asMap({
    name: asString(entry.name),
    owner: asString(entry.owner),
  }))),
  orphanIndexes: asArray(input.indexes.map((entry) => asString(entry))),
});

/**
 * Escreve o resíduo, SEMPRE — inclusive quando não há nenhum.
 *
 * Escrever só quando há órfã deixaria o aviso na tela depois de o `--prune` já ter resolvido, e um aviso
 * que não sai é um aviso que se aprende a ignorar. Como todos os campos são escritos a cada execução, a
 * lista vazia é o que apaga a anterior.
 */
export const writeBackendResidue = async (
  projectId: string,
  input: BackendResidueInput,
): Promise<void> => {
  await patchFields(projectId, BACKEND_RESIDUE_PATH, backendResidueFields(input));
};
