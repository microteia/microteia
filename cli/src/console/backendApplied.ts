import { asArray, asMap, asString, asTimestamp, getDocument, patchFields } from './firestoreRest.js';
import type { FirestoreTypedValue } from './firestoreRest.js';
import { CLI_VERSION } from '../shared/paths.js';

/**
 * O que o PROJETO tem aplicado, devolvido ao banco onde a aplicação pode ler.
 *
 * O carimbo mora em cada cópia instalada (`backendState`), e o `provision` o grava nas cópias que
 * existem no momento em que roda. A cópia que chega DEPOIS — o segundo escritório que atualiza para a
 * versão que o primeiro já pôs no ar — ficava "Backend pendente" até alguém rodar o comando de novo, e o
 * comando não decidia nada: a aprovação por hash já é do projeto e as functions já estavam no ar. Ele
 * só copiava um registro.
 *
 * Este documento é esse registro, uma vez por projeto: para cada extensão, o fingerprint que o projeto
 * roda. A tela libera a cópia cujo fingerprint está aqui. Quem afirma continua sendo só o Console — a
 * regra de `backend_state` nega escrita ao cliente.
 */
export const BACKEND_APPLIED_PATH = '/backend_state/applied';

export interface AppliedEntry {
  pluginId: string;
  fingerprint: string;
  approvedHash?: string;
  approvedBy?: string;
}

/** O que uma cópia exige, na forma mínima que as contas abaixo precisam. */
export interface FingerprintClaim {
  pluginId: string;
  fingerprint: string;
}

/**
 * Os campos do documento, montados sem tocar na rede.
 *
 * Lista e não mapa por `pluginId` porque o id tem pontos, e ponto em chave de mapa vira caminho de
 * campo no Firestore. A FORMA é contrato com o kernel, versionado à parte — é o que o teste confere.
 */
export const backendAppliedFields = (
  entries: readonly AppliedEntry[],
  writtenAt: Date,
): Record<string, FirestoreTypedValue> => ({
  writtenAt: asTimestamp(writtenAt),
  consoleVersion: asString(CLI_VERSION),
  extensions: asArray(entries.map((entry) => asMap({
    pluginId: asString(entry.pluginId),
    fingerprint: asString(entry.fingerprint),
    ...(entry.approvedHash !== undefined ? { approvedHash: asString(entry.approvedHash) } : {}),
    ...(entry.approvedBy !== undefined ? { approvedBy: asString(entry.approvedBy) } : {}),
  }))),
});

/**
 * O documento lido, defensivo pelo mesmo motivo do lado do kernel: pode ter sido escrito por um Console
 * de outra versão. Entrada sem id ou sem fingerprint não libera nada, então é descartada.
 */
export const parseBackendApplied = (data: Record<string, unknown> | null): AppliedEntry[] => {
  const list = data?.extensions;
  if (!Array.isArray(list)) return [];
  return list.flatMap((item): AppliedEntry[] => {
    if (typeof item !== 'object' || item === null) return [];
    const fields = item as Record<string, unknown>;
    if (typeof fields.pluginId !== 'string' || fields.pluginId === '') return [];
    if (typeof fields.fingerprint !== 'string' || fields.fingerprint === '') return [];
    return [{
      pluginId: fields.pluginId,
      fingerprint: fields.fingerprint,
      ...(typeof fields.approvedHash === 'string' ? { approvedHash: fields.approvedHash } : {}),
      ...(typeof fields.approvedBy === 'string' ? { approvedBy: fields.approvedBy } : {}),
    }];
  });
};

export const appliedEntryOf = (
  entries: readonly AppliedEntry[],
  claim: FingerprintClaim,
): AppliedEntry | undefined =>
  entries.find((entry) => entry.pluginId === claim.pluginId && entry.fingerprint === claim.fingerprint);

/**
 * O que continua verdadeiro aconteça o que acontecer nesta execução.
 *
 * Só fica a entrada de extensão ainda instalada E com o fingerprint da cópia mais nova — a que o
 * deploy vai pôr no ar. A extensão que saiu de todo escritório pode ter a function apagada pelo
 * `--prune`; a versão superada pode ter o código trocado pelo deploy. Nos dois casos a entrada
 * anunciaria no ar o que talvez não esteja, e uma cópia nova nasceria liberada contra uma function que
 * não existe — o defeito que parece CORS e que a pendência existe para impedir.
 *
 * Só REMOVE: acrescentar é do fim da execução, quando o deploy já respondeu.
 */
export const reduceBackendApplied = (
  entries: readonly AppliedEntry[],
  newest: readonly FingerprintClaim[],
): AppliedEntry[] => {
  const standing = new Map(newest.map((claim) => [claim.pluginId, claim.fingerprint]));
  return entries.filter((entry) => standing.get(entry.pluginId) === entry.fingerprint);
};

/**
 * `[]` quando o documento não existe. Leitura recusada também vira `[]`, com aviso de quem chama: o
 * que se perde é só o atalho — sem entradas, nada é materializado, e a redução grava a lista vazia,
 * que é a resposta segura para "não sei o que o projeto tem".
 */
export const readBackendApplied = async (projectId: string): Promise<AppliedEntry[]> =>
  parseBackendApplied(await getDocument(projectId, BACKEND_APPLIED_PATH));

export const writeBackendApplied = async (
  projectId: string,
  entries: readonly AppliedEntry[],
): Promise<void> => {
  await patchFields(projectId, BACKEND_APPLIED_PATH, backendAppliedFields(entries, new Date()));
};
