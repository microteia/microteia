/**
 * O registro que a hidratação pôs no lugar de um id de referência leva o id GRAVADO consigo, numa
 * chave de símbolo. É ela que permite à leitura que TERMINA na referência devolver o id — `caseId`
 * lido sozinho é o que está armazenado, mesmo quando outra leitura da mesma automação navegou
 * `caseId.court` e o registro já está ali.
 *
 * Símbolo, e enumerável: some do `JSON`, do `Object.keys` e da gravação no Firestore, e sobrevive ao
 * espalhamento (`{ ...registro }`) que a materialização faz ao descer um nível.
 */
export const STORED_REFERENCE_ID = Symbol.for('microteia.storedReferenceId');

type Tagged = Record<string | symbol, unknown>;

export const tagStoredReference = (record: Record<string, unknown>, id: string): Record<string, unknown> => {
  (record as Tagged)[STORED_REFERENCE_ID] = id;
  return record;
};

const storedIdOf = (value: unknown): string | undefined => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const id = (value as Tagged)[STORED_REFERENCE_ID];
  return typeof id === 'string' ? id : undefined;
};

/** O valor como está gravado: o registro hidratado volta a ser o id; a lista deles, a lista de ids. */
export const readAsStored = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    if (!value.some((item) => storedIdOf(item) !== undefined)) return value;
    return value.map((item) => storedIdOf(item) ?? item);
  }
  return storedIdOf(value) ?? value;
};
