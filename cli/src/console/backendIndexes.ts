import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { indexKey } from '../kernel/backendShape.js';
import type { FirestoreIndexField, FirestoreIndexSpec } from '../kernel/backendShape.js';

/**
 * Quais índices compostos de EXTENSÃO já foram declarados neste projeto, guardados na raiz.
 *
 * Existe pelo mesmo motivo que `backend.functions`: o estado tem de sobreviver ao `unpack`. O que
 * havia era só o `firestore.indexes.json` de dentro de `.microteia/install/`, que o `unpack` apaga
 * inteiro — e o pacote traz apenas a BASELINE, porque o que a extensão reivindica sai dela no `pack`.
 *
 * O efeito era este, e chegou a acontecer: provisiona-se (o índice da extensão entra no arquivo e é
 * criado no projeto), desativa-se a extensão (o índice fica, e é o certo), troca-se de kernel, e o
 * `microteia deploy` roda `firebase deploy --only firestore:indexes` contra um arquivo que voltou à
 * baseline. O `firebase` acha no projeto índices que o arquivo não declara e PERGUNTA se pode apagar,
 * no meio de um upgrade — e responder "sim" leva embora o índice de uma extensão que ainda pode voltar.
 * Pior: `reportOrphanIndexes` lia a mesma memória apagada, então o aviso que existe para o órfão não
 * passar em branco emudecia exatamente ali.
 */

const ENTRY_SEPARATOR = ';';
const FIELD_SEPARATOR = ',';
const SCOPE_SEPARATOR = '/';
const GROUP_SCOPE = 'group';

/**
 * A marca de ordenação é o ÚLTIMO caractere do campo, e não um separador: é o que permite um campo
 * chamado `order-date` — o `-` no meio não decide nada. `?` é o campo sem ordenação nem `arrayConfig`,
 * que o Firestore recusa no deploy mas o manifesto de uma extensão pode declarar; representá-lo é mais
 * barato que uma exceção, e faz a ida e volta ser exata para todo índice que exista.
 */
const MARKS = {
  ASCENDING: '+',
  DESCENDING: '-',
  CONTAINS: '*',
  NONE: '?',
} as const;

const encodeField = (field: FirestoreIndexField): string | null => {
  if (field.arrayConfig !== undefined && field.order !== undefined) return null;
  if (field.arrayConfig !== undefined) return `${field.fieldPath}${MARKS.CONTAINS}`;
  if (field.order === 'DESCENDING') return `${field.fieldPath}${MARKS.DESCENDING}`;
  if (field.order === 'ASCENDING') return `${field.fieldPath}${MARKS.ASCENDING}`;
  return `${field.fieldPath}${MARKS.NONE}`;
};

const decodeField = (token: string): FirestoreIndexField | null => {
  const path = token.slice(0, -1);
  if (path === '') return null;

  switch (token.slice(-1)) {
    case MARKS.CONTAINS: return { fieldPath: path, arrayConfig: 'CONTAINS' };
    case MARKS.DESCENDING: return { fieldPath: path, order: 'DESCENDING' };
    case MARKS.ASCENDING: return { fieldPath: path, order: 'ASCENDING' };
    case MARKS.NONE: return { fieldPath: path };
    default: return null;
  }
};

const MARK_VALUES: string[] = Object.values(MARKS);

/**
 * O que a codificação não consegue representar sem ambiguidade. Um nome de coleção não pode conter `/`
 * (o Firestore não permite) e um caminho de campo com `;`, `,` ou `:` só apareceria entre acentos
 * graves — mas "só apareceria" é como um defeito silencioso começa, então aqui ele é DETECTADO e o
 * índice fica de fora da memória com aviso, em vez de voltar do arquivo virado noutro índice.
 */
const representable = (index: FirestoreIndexSpec): boolean => {
  const reserved = [ENTRY_SEPARATOR, FIELD_SEPARATOR, ':', SCOPE_SEPARATOR];
  if (reserved.some((token) => index.collectionGroup.includes(token))) return false;
  if (index.collectionGroup === '') return false;

  return index.fields.every((field) => {
    const encoded = encodeField(field);
    if (encoded === null) return false;
    if (reserved.some((token) => field.fieldPath.includes(token))) return false;
    return !MARK_VALUES.includes(field.fieldPath.slice(-1));
  });
};

export const encodeIndex = (index: FirestoreIndexSpec): string => {
  const scope = index.queryScope === 'COLLECTION_GROUP' ? `${SCOPE_SEPARATOR}${GROUP_SCOPE}` : '';
  const fields = index.fields.map(encodeField).join(FIELD_SEPARATOR);
  return `${index.collectionGroup}${scope}:${fields}`;
};

export const decodeIndex = (entry: string): FirestoreIndexSpec | null => {
  const separator = entry.indexOf(':');
  if (separator <= 0) return null;

  const head = entry.slice(0, separator);
  const tail = entry.slice(separator + 1);
  if (tail === '') return null;

  const group = head.endsWith(`${SCOPE_SEPARATOR}${GROUP_SCOPE}`);
  const collectionGroup = group ? head.slice(0, -(GROUP_SCOPE.length + 1)) : head;
  if (collectionGroup === '' || collectionGroup.includes(SCOPE_SEPARATOR)) return null;

  const fields = tail.split(FIELD_SEPARATOR).map(decodeField);
  if (fields.some((field) => field === null)) return null;

  return {
    collectionGroup,
    queryScope: group ? 'COLLECTION_GROUP' : 'COLLECTION',
    fields: fields as FirestoreIndexField[],
  };
};

/**
 * Entrada que não decodifica é DESCARTADA, não fatal. O pior caso de descartar é a memória de um índice
 * se perder, que é exatamente o comportamento anterior a este módulo; o pior caso de lançar é um
 * `microteia.yaml` editado à mão impedir um upgrade — e o arquivo fica ao lado das Cloud Functions do
 * escritório, então ele É editado à mão.
 */
export const parseIndexState = (raw: string | null): FirestoreIndexSpec[] => {
  const indexes = new Map<string, FirestoreIndexSpec>();

  for (const entry of (raw ?? '').split(ENTRY_SEPARATOR)) {
    const trimmed = entry.trim();
    if (trimmed === '') continue;

    const index = decodeIndex(trimmed);
    if (index !== null) indexes.set(indexKey(index), index);
  }

  return [...indexes.values()];
};

export interface IndexStateOutcome {
  value: string | null;
  skipped: FirestoreIndexSpec[];
}

export const serializeIndexState = (indexes: FirestoreIndexSpec[]): IndexStateOutcome => {
  const entries = new Map<string, string>();
  const skipped: FirestoreIndexSpec[] = [];

  for (const index of indexes) {
    if (!representable(index)) {
      skipped.push(index);
      continue;
    }
    entries.set(indexKey(index), encodeIndex(index));
  }

  const value = [...entries.values()].sort();
  return { value: value.length === 0 ? null : value.join(ENTRY_SEPARATOR), skipped };
};

/** Uma linha legível, para o relatório — é ela que o operador lê, não o escalar do `microteia.yaml`. */
export const describeIndex = (index: FirestoreIndexSpec): string => {
  const scope = index.queryScope === 'COLLECTION_GROUP' ? ' (collection group)' : '';
  return `${index.collectionGroup}${scope}: ${index.fields.map((field) => field.fieldPath).join(', ')}`;
};

export interface IndexesFile {
  indexes: FirestoreIndexSpec[];
  fieldOverrides?: unknown[];
}

const indexFilePath = (install: string): string => join(install, 'firestore.indexes.json');

export const readIndexFile = async (install: string): Promise<IndexesFile> =>
  JSON.parse(await readFile(indexFilePath(install), 'utf8')) as IndexesFile;

export const writeIndexFile = async (install: string, file: IndexesFile): Promise<void> => {
  await writeFile(indexFilePath(install), `${JSON.stringify(file, null, 2)}\n`);
};

export interface Convergence {
  desired: FirestoreIndexSpec[];
  missing: FirestoreIndexSpec[];
  changed: boolean;
}

/**
 * `baseline ∪ manter`, na ordem em que chega — reescrever a partir da baseline, e não acrescentar ao que
 * está lá, é o que faz um índice sair do arquivo quando ele deixa de ser pedido E de ser lembrado.
 * `missing` é o que o arquivo ainda não declarava, e é ele que decide se vale chamar o `firebase`.
 */
export const convergeIndexes = (
  current: FirestoreIndexSpec[],
  baseline: FirestoreIndexSpec[],
  keep: FirestoreIndexSpec[],
): Convergence => {
  const desired: FirestoreIndexSpec[] = [];
  const present = new Set<string>();

  for (const index of [...baseline, ...keep]) {
    const key = indexKey(index);
    if (present.has(key)) continue;
    present.add(key);
    desired.push(index);
  }

  const declared = new Set(current.map(indexKey));
  const missing = desired.filter((index) => !declared.has(indexKey(index)));

  return { desired, missing, changed: missing.length > 0 || current.length !== desired.length };
};

/**
 * Devolve ao arquivo recém-desempacotado o que a instalação já tinha declarado. É o `unpack` que apaga
 * `install/`, e é ele que repara — antes de qualquer comando poder rodar `firebase deploy` contra um
 * arquivo incompleto. Não toca no Firebase: só reescreve o arquivo.
 */
export const restoreDeclaredIndexes = async (
  install: string,
  baseline: FirestoreIndexSpec[],
  recorded: FirestoreIndexSpec[],
): Promise<FirestoreIndexSpec[]> => {
  const file = await readIndexFile(install);
  const convergence = convergeIndexes(file.indexes, baseline, recorded);
  if (!convergence.changed) return [];

  await writeIndexFile(install, { ...file, indexes: convergence.desired });
  return convergence.missing;
};
