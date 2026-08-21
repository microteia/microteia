import { captureOrThrow } from '../shared/run.js';

/**
 * Leitura e escrita de documento pela REST do Firestore.
 *
 * Por que existe: o `provision` precisa saber o que o escritório INSTALOU, e isso só está no banco do
 * escritório. O `firebase` não tem comando para ler nem gravar um documento, então o caminho é a API
 * com o token de quem está na máquina.
 *
 * O Console continua sem autenticação própria e sem ver credencial: o token vem do `gcloud`, que já é
 * requisito de quem instala (é ele que cria o App Engine). Nada é guardado — o token é pedido a cada
 * execução e vive só na memória do processo.
 */
const HOST = 'https://firestore.googleapis.com/v1';
const GCLOUD_BIN = 'gcloud';

export interface FirestoreDocument {
  name: string;
  fields: Record<string, unknown>;
}

let cachedToken: string | null = null;

export const accessToken = async (): Promise<string> => {
  if (cachedToken !== null) return cachedToken;
  try {
    cachedToken = (await captureOrThrow(GCLOUD_BIN, ['auth', 'print-access-token'])).trim();
  } catch {
    throw new Error(
      'Could not get a Google access token. Sign in once with: gcloud auth login\n'
      + '  (the Console never stores credentials — it asks gcloud every time)',
    );
  }
  if (cachedToken === '') throw new Error('gcloud returned an empty access token. Run: gcloud auth login');
  return cachedToken;
};

/**
 * `X-Goog-User-Project` diz de qual projeto é a cota. Sem ele, uma credencial de usuário é recusada
 * com uma mensagem sobre "quota project" que não menciona o que fazer.
 */
const request = async (
  projectId: string,
  path: string,
  init: { method: string; body?: unknown; query?: Record<string, string | string[]> } = { method: 'GET' },
): Promise<Record<string, unknown>> => {
  const token = await accessToken();
  const url = new URL(`${HOST}/projects/${projectId}/databases/(default)/documents${path}`);
  for (const [key, value] of Object.entries(init.query ?? {})) {
    for (const item of Array.isArray(value) ? value : [value]) url.searchParams.append(key, item);
  }

  const response = await fetch(url, {
    method: init.method,
    headers: {
      authorization: `Bearer ${token}`,
      'x-goog-user-project': projectId,
      ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });

  const text = await response.text();
  if (!response.ok) {
    const detail = text.slice(0, 400);
    if (response.status === 403) {
      throw new Error(
        `Firestore refused the request for ${projectId} (403). The signed-in gcloud account needs `
        + `access to the project's database.\n  ${detail}`,
      );
    }
    throw new Error(`Firestore answered ${response.status} for ${path}.\n  ${detail}`);
  }

  return text === '' ? {} : (JSON.parse(text) as Record<string, unknown>);
};

/** Um valor tipado da REST virando valor de JavaScript. Timestamp vira string ISO, que é o que basta. */
export const decodeValue = (value: unknown): unknown => {
  if (typeof value !== 'object' || value === null) return undefined;
  const typed = value as Record<string, unknown>;
  if ('stringValue' in typed) return typed.stringValue;
  if ('booleanValue' in typed) return typed.booleanValue;
  if ('integerValue' in typed) return Number(typed.integerValue);
  if ('doubleValue' in typed) return typed.doubleValue;
  if ('timestampValue' in typed) return typed.timestampValue;
  if ('nullValue' in typed) return null;
  if ('arrayValue' in typed) {
    const values = (typed.arrayValue as { values?: unknown[] } | undefined)?.values ?? [];
    return values.map(decodeValue);
  }
  if ('mapValue' in typed) return decodeFields((typed.mapValue as { fields?: Record<string, unknown> })?.fields ?? {});
  return undefined;
};

export const decodeFields = (fields: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]));

/**
 * Os documentos de uma coleção, seguindo a paginação até o fim.
 *
 * Sem máscara de campo, e de propósito: mascarar um caminho aninhado (`package.manifest`) funciona até
 * uma versão da API discordar da forma, e o sintoma seria uma extensão sumindo do provisionamento sem
 * erro. Documento de extensão é grande, mas são poucos por escritório, e isto roda uma vez por comando.
 */
export const listDocuments = async (
  projectId: string,
  path: string,
): Promise<FirestoreDocument[]> => {
  const documents: FirestoreDocument[] = [];
  let pageToken: string | undefined;

  do {
    const page = await request(projectId, path, {
      method: 'GET',
      query: { pageSize: '300', ...(pageToken === undefined ? {} : { pageToken }) },
    });
    for (const entry of (page.documents as FirestoreDocument[] | undefined) ?? []) {
      documents.push({ name: entry.name, fields: entry.fields ?? {} });
    }
    pageToken = page.nextPageToken as string | undefined;
  } while (pageToken !== undefined);

  return documents;
};

export const documentId = (document: FirestoreDocument): string =>
  document.name.slice(document.name.lastIndexOf('/') + 1);

/** Um valor com o tipo que a REST espera, montado por quem sabe o que o campo é. */
export type FirestoreTypedValue = { stringValue: string } | { timestampValue: string };

export const asString = (value: string): FirestoreTypedValue => ({ stringValue: value });

/**
 * Data como DATA, e não como texto que se parece com uma.
 *
 * O tipo do valor gravado é escolhido aqui e lido do outro lado do produto, meses depois, por quem não
 * viu esta linha. Gravar uma data como `stringValue` custou um botão que não funcionava: a tela lia o
 * texto, exibia certo, e só falhava ao gravar de volta. O `timestampValue` fecha essa porta — e é
 * também o que permite ordenar e comparar o campo no banco. A REST exige RFC 3339 em UTC, que é
 * exatamente o que `toISOString` devolve.
 */
export const asTimestamp = (value: Date): FirestoreTypedValue => ({ timestampValue: value.toISOString() });

/**
 * Grava UM campo de mapa, com `updateMask` — o resto do documento não é tocado. É o que permite o
 * Console carimbar o estado sem conhecer (nem arriscar reescrever) o pacote inteiro que vive ao lado.
 */
export const patchMapField = async (
  projectId: string,
  path: string,
  field: string,
  entries: Record<string, FirestoreTypedValue>,
): Promise<void> => {
  await request(projectId, path, {
    method: 'PATCH',
    query: { 'updateMask.fieldPaths': field },
    body: { fields: { [field]: { mapValue: { fields: entries } } } },
  });
};
