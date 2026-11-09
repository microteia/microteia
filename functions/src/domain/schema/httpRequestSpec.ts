// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/httpRequestSpec.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

import type { InputMapping } from '../entities/Workflow';
import type { MapFieldMapping } from './mapSpec';
import type { SettingsProperty } from './settings';

/**
 * O passo "Chamar API (HTTP)" — a especificação, a validação e a montagem da requisição.
 *
 * Mora no domínio COMPARTILHADO pelo mesmo motivo de `querySpec.ts`: o construtor visual valida antes
 * de salvar, o motor valida antes de chamar, e o portão do pacote valida antes de instalar — com a
 * MESMA função. Três implementações discordariam justamente no caso que importa.
 *
 * Cada valor (URL, parâmetro, cabeçalho, campo do corpo) é um `InputMapping`, e por isso pode vir de
 * qualquer origem que um input de passo aceita: fixo, evento, expressão, saída de passo anterior ou
 * variável. A especificação em si é gravada como `Literal` — como a consulta e o objeto montado.
 */

export const HTTP_REQUEST_STEP_ID = 'http-request';

/** O kernel a partir do qual o passo existe. Pacote que admite kernel anterior reprova no portão. */
export const HTTP_REQUEST_SINCE_KERNEL = '2.101.0';

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export const HTTP_BODY_KINDS = ['none', 'json', 'json-from', 'form', 'text'] as const;
export type HttpBodyKind = (typeof HTTP_BODY_KINDS)[number];

export const HTTP_RESPONSE_TYPES = ['auto', 'json', 'text'] as const;
export type HttpResponseType = (typeof HTTP_RESPONSE_TYPES)[number];

/**
 * `sync` espera a resposta e a entrega ao passo seguinte; `async` põe o pedido numa fila durável e o
 * fluxo segue sem esperar — o resultado chega, se o autor quiser, a OUTRA automação (o callback).
 * Ausente é `sync`: é o que toda especificação gravada antes do modo assíncrono quer dizer.
 */
export const HTTP_REQUEST_MODES = ['sync', 'async'] as const;
export type HttpRequestMode = (typeof HTTP_REQUEST_MODES)[number];

/** O kernel a partir do qual `mode: 'async'` e o callback existem. Ver `HTTP_REQUEST_SINCE_KERNEL`. */
export const HTTP_ASYNC_SINCE_KERNEL = '2.103.0';

export type HttpRequestBody =
  | { kind: 'none' }
  /** Cada campo vira uma chave do objeto; `cliente.nome` aninha, como os parâmetros de um fluxo. */
  | { kind: 'json'; fields: MapFieldMapping[] }
  /** O objeto inteiro vem pronto — tipicamente a saída de um "Montar Objeto". */
  | { kind: 'json-from'; value: InputMapping }
  | { kind: 'form'; fields: MapFieldMapping[] }
  | { kind: 'text'; contentType: string; value: InputMapping };

export interface HttpRequestSpec {
  method: HttpMethod;
  /** Pode trazer marcadores `{nome}`, preenchidos por `pathParams` com encoding. */
  url: InputMapping;
  pathParams?: MapFieldMapping[];
  query?: MapFieldMapping[];
  headers?: MapFieldMapping[];
  body?: HttpRequestBody;
  /** Quanto o passo espera pela resposta. Limitado também pelo orçamento de tempo da execução. */
  timeoutSeconds?: number;
  /**
   * `true` (padrão): status fora de 2xx, tempo esgotado ou falha de rede falham o passo. `false`: o
   * passo termina com `ok: false` e o fluxo decide numa Condição pelo `status`.
   */
  failOnHttpError?: boolean;
  responseType?: HttpResponseType;
  /**
   * Um exemplo da resposta, em JSON. Não é enviado a lugar nenhum: serve para o editor oferecer
   * `body.<caminho>` no autocomplete, que de outro modo só conheceria o `body` inteiro.
   */
  responseSample?: string;
  /**
   * A CHAVE de uma credencial de integração do escritório (Configurações › Credenciais de integração).
   * O segredo é posto pelo servidor, na hora da chamada — nunca passa pela automação, pelo histórico
   * nem pelo pacote da extensão.
   */
  connection?: string;
  mode?: HttpRequestMode;
  /**
   * Só no modo assíncrono: quantas vezes a fila tenta DE NOVO depois da primeira, quando a falha é
   * passageira (rede, tempo esgotado, 408, 429, 5xx). Uma resposta 4xx não se repete — ela diria o
   * mesmo na segunda vez.
   */
  retries?: number;
}

export const isAsyncHttpSpec = (spec: Pick<HttpRequestSpec, 'mode'> | null | undefined): boolean => spec?.mode === 'async';

export const HTTP_CONNECTION_KEY_PATTERN = '^[a-z][a-z0-9-]{1,39}$';
const CONNECTION_KEY_RE = new RegExp(HTTP_CONNECTION_KEY_PATTERN);

/**
 * Os tetos do passo. O da resposta é baixo de propósito: o motor grava as saídas de cada passo no
 * histórico da execução, e um documento do Firestore não passa de 1 MiB — uma resposta grande perderia
 * a execução inteira, e não só o passo.
 */
export const HTTP_TIMEOUT_MIN_SECONDS = 1;
export const HTTP_TIMEOUT_MAX_SECONDS = 120;
export const HTTP_TIMEOUT_DEFAULT_SECONDS = 15;
/**
 * O teto quando a porta que roda a automação não informa orçamento de tempo (a retomada de uma
 * espera, por exemplo). Sem orçamento, ninguém sabe quanto a function ainda tem — e o teto curto é o
 * que não deixa a chamada ser cortada no meio sem registro.
 */
export const HTTP_TIMEOUT_WITHOUT_BUDGET_SECONDS = 30;
export const HTTP_RESPONSE_MAX_BYTES = 100 * 1024;
export const HTTP_MAX_FIELDS = 50;

export const HTTP_RETRIES_MAX = 5;
export const HTTP_RETRIES_DEFAULT = 3;
/**
 * O pedido enfileirado é GRAVADO (o documento da fila), e um documento do Firestore não passa de 1 MiB.
 * O teto fica bem abaixo disso porque o mesmo documento leva cabeçalhos e os parâmetros do callback.
 */
export const HTTP_ASYNC_REQUEST_MAX_BYTES = 256 * 1024;
/**
 * Espera antes de cada nova tentativa, em minutos. Quem acorda a fila é o relógio do kernel (a cada
 * 5 min), então o primeiro intervalo vale, na prática, até a próxima volta dele.
 */
export const HTTP_RETRY_DELAYS_MINUTES: readonly number[] = [1, 5, 15, 60, 180];
/** O teto do `Retry-After` que o servidor pede: além disso, a fila usaria o tempo dele como sumiço. */
export const HTTP_RETRY_AFTER_MAX_SECONDS = 60 * 60;
/**
 * O parâmetro em que o fluxo de callback recebe o resultado da chamada. O nome é fixo — é o contrato
 * entre a fila e a automação que a escuta —, e por isso um parâmetro do callback com este nome é
 * sobreposto pelo resultado.
 */
export const HTTP_CALLBACK_RESPONSE_PARAM = 'response';
/** O input do passo que nomeia o fluxo de callback. É o mesmo id que o "Chamar Workflow" usa — ver o catálogo. */
export const HTTP_CALLBACK_INPUT = 'targetWorkflowId';
/** A fila do modo assíncrono, em `tenants/{t}/…`. Só o servidor lê e grava. */
export const HTTP_DISPATCHES_COLLECTION = 'http_dispatches';
/** Quanto tempo o pedido fica guardado depois de criado (TTL do Firestore em `expiresAt`). */
export const HTTP_DISPATCH_RETENTION_DAYS = 7;
/** O pedido em `queued` que ninguém pegou nesse tempo volta para a fila — o gatilho pode ter falhado. */
export const HTTP_DISPATCH_UNCLAIMED_MINUTES = 10;

/** A única saída do passo no modo assíncrono: o resto só existe quando a resposta chega. */
export const HTTP_ASYNC_OUTPUT_IDS: readonly string[] = ['dispatchId'];

/** Se uma saída do catálogo existe no modo da especificação. O editor só oferece o que o passo publica. */
export const isHttpOutputOfMode = (spec: Pick<HttpRequestSpec, 'mode'> | null | undefined, outputId: string): boolean =>
  isAsyncHttpSpec(spec) === HTTP_ASYNC_OUTPUT_IDS.includes(outputId);

/**
 * Cabeçalhos que o motor controla. `host` e os de enquadramento decidiriam PARA ONDE e COMO a
 * requisição vai — fora da lista de domínios permitidos —, e `accept-encoding` é fixado em `identity`
 * para a resposta comprimida não furar o teto de tamanho.
 */
export const HTTP_FORBIDDEN_HEADERS: readonly string[] = [
  'host', 'content-length', 'connection', 'transfer-encoding', 'keep-alive', 'upgrade', 'te',
  'trailer', 'accept-encoding', 'expect',
];

const FORBIDDEN_HEADER_PREFIXES = ['proxy-', 'sec-'];

/**
 * Nome de cabeçalho que costuma carregar segredo. Com valor FIXO, o segredo ficaria gravado na
 * definição da automação — e viajaria no pacote da extensão que a leva.
 */
const SENSITIVE_HEADER = /(^authorization$|^cookie$|token|secret|api[-_]?key|password|credential)/i;

export const isSensitiveHeaderName = (name: string): boolean => SENSITIVE_HEADER.test(name.trim());

/** RFC 9110: `token`. Fora disso o nome é recusado, em vez de chegar torto ao servidor. */
const HEADER_NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

export const isForbiddenHeaderName = (name: string): boolean => {
  const lower = name.trim().toLowerCase();
  return HTTP_FORBIDDEN_HEADERS.includes(lower) || FORBIDDEN_HEADER_PREFIXES.some((prefix) => lower.startsWith(prefix));
};

const PLACEHOLDER = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

/** Os marcadores `{nome}` de uma URL. */
export const urlPlaceholders = (url: string): string[] =>
  [...new Set([...url.matchAll(PLACEHOLDER)].map((match) => match[1]))];

export interface HttpRequestSpecIssue {
  field: string;
  error: string;
  errorParams?: Record<string, string>;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isMapping = (value: unknown): value is InputMapping =>
  isPlainObject(value) && typeof value.kind === 'string';

const literalText = (mapping: InputMapping | undefined): string | null =>
  mapping?.kind === 'Literal' && typeof mapping.value === 'string' ? mapping.value : null;

const fieldListIssues = (
  fields: unknown,
  field: string,
  { header }: { header?: boolean } = {},
): HttpRequestSpecIssue[] => {
  if (fields === undefined) return [];
  if (!Array.isArray(fields)) return [{ field, error: '@core.automation/step.http.issue.fields' }];
  if (fields.length > HTTP_MAX_FIELDS) {
    return [{ field, error: '@core.automation/step.http.issue.too-many', errorParams: { max: String(HTTP_MAX_FIELDS) } }];
  }
  const issues: HttpRequestSpecIssue[] = [];
  const seen = new Set<string>();
  fields.forEach((entry: unknown, index) => {
    const at = `${field}[${index}]`;
    const name = isPlainObject(entry) && typeof entry.name === 'string' ? entry.name.trim() : '';
    if (!name) {
      issues.push({ field: at, error: '@core.automation/step.http.issue.name-empty' });
      return;
    }
    if (!isPlainObject(entry) || !isMapping(entry.value)) {
      issues.push({ field: at, error: '@core.automation/step.http.issue.value', errorParams: { name } });
    }
    // Cabeçalho não diferencia caixa; parâmetro de query repetido é legítimo (`?id=1&id=2`), e por isso
    // só o cabeçalho e o corpo recusam a repetição.
    const key = header ? name.toLowerCase() : name;
    if (field !== 'query' && seen.has(key)) {
      issues.push({ field: at, error: '@core.automation/step.http.issue.duplicate', errorParams: { name } });
    }
    seen.add(key);
    if (header && !HEADER_NAME.test(name)) {
      issues.push({ field: at, error: '@core.automation/step.http.issue.header-name', errorParams: { name } });
    } else if (header && isForbiddenHeaderName(name)) {
      issues.push({ field: at, error: '@core.automation/step.http.issue.header-forbidden', errorParams: { name } });
    }
  });
  return issues;
};

const bodyIssues = (method: HttpMethod, body: unknown): HttpRequestSpecIssue[] => {
  if (body === undefined) return [];
  if (!isPlainObject(body) || !(HTTP_BODY_KINDS as readonly string[]).includes(String(body.kind))) {
    return [{ field: 'body', error: '@core.automation/step.http.issue.body-kind' }];
  }
  if (body.kind === 'none') return [];
  if (method === 'GET') return [{ field: 'body', error: '@core.automation/step.http.issue.body-get' }];
  switch (body.kind) {
    case 'json':
    case 'form':
      return fieldListIssues(body.fields ?? [], 'body.fields');
    case 'json-from':
      return isMapping(body.value) ? [] : [{ field: 'body.value', error: '@core.automation/step.http.issue.body-value' }];
    case 'text': {
      const issues: HttpRequestSpecIssue[] = [];
      if (typeof body.contentType !== 'string' || !/^[\w.+-]+\/[\w.+-]+(\s*;.*)?$/.test(body.contentType.trim())) {
        issues.push({ field: 'body.contentType', error: '@core.automation/step.http.issue.content-type' });
      }
      if (!isMapping(body.value)) issues.push({ field: 'body.value', error: '@core.automation/step.http.issue.body-value' });
      return issues;
    }
    default:
      return [];
  }
};

/**
 * A URL fixa é conferida já no design-time: só `https`, sem credencial embutida, e com cada marcador
 * `{nome}` coberto por um parâmetro de caminho. A que vem de expressão ou de passo anterior só se
 * conhece em runtime — e é conferida lá, pela mesma `parseHttpUrl`.
 */
const urlIssues = (spec: Record<string, unknown>): HttpRequestSpecIssue[] => {
  if (!isMapping(spec.url)) return [{ field: 'url', error: '@core.automation/step.http.issue.url-missing' }];
  const literal = literalText(spec.url);
  if (literal === null) return spec.url.kind === 'Literal' ? [{ field: 'url', error: '@core.automation/step.http.issue.url-missing' }] : [];
  if (!literal.trim()) return [{ field: 'url', error: '@core.automation/step.http.issue.url-missing' }];

  const issues: HttpRequestSpecIssue[] = [];
  const probe = literal.trim().replace(PLACEHOLDER, 'x');
  const parsed = parseHttpUrl(probe);
  if ('error' in parsed) issues.push({ field: 'url', error: parsed.error });

  const declared = new Set(
    (Array.isArray(spec.pathParams) ? spec.pathParams : [])
      .map((entry: unknown) => (isPlainObject(entry) && typeof entry.name === 'string' ? entry.name.trim() : ''))
      .filter(Boolean),
  );
  for (const name of urlPlaceholders(literal)) {
    if (!declared.has(name)) {
      issues.push({ field: 'url', error: '@core.automation/step.http.issue.path-param-missing', errorParams: { name } });
    }
  }
  return issues;
};

export const validateHttpRequestSpec = (value: unknown): HttpRequestSpecIssue[] => {
  if (!isPlainObject(value)) return [{ field: '', error: '@core.automation/step.http.not-configured' }];
  const spec = value;
  const issues: HttpRequestSpecIssue[] = [];

  const method = String(spec.method ?? '') as HttpMethod;
  if (!(HTTP_METHODS as readonly string[]).includes(method)) {
    issues.push({ field: 'method', error: '@core.automation/step.http.issue.method' });
  }
  issues.push(...urlIssues(spec));
  issues.push(...fieldListIssues(spec.pathParams, 'pathParams'));
  issues.push(...fieldListIssues(spec.query, 'query'));
  issues.push(...fieldListIssues(spec.headers, 'headers', { header: true }));
  issues.push(...bodyIssues(method, spec.body));

  if (spec.timeoutSeconds !== undefined) {
    const timeout = spec.timeoutSeconds;
    if (typeof timeout !== 'number' || !Number.isInteger(timeout)
      || timeout < HTTP_TIMEOUT_MIN_SECONDS || timeout > HTTP_TIMEOUT_MAX_SECONDS) {
      issues.push({
        field: 'timeoutSeconds',
        error: '@core.automation/step.http.issue.timeout',
        errorParams: { min: String(HTTP_TIMEOUT_MIN_SECONDS), max: String(HTTP_TIMEOUT_MAX_SECONDS) },
      });
    }
  }
  if (spec.failOnHttpError !== undefined && typeof spec.failOnHttpError !== 'boolean') {
    issues.push({ field: 'failOnHttpError', error: '@core.automation/step.http.issue.fail-on-error' });
  }
  if (spec.responseType !== undefined && !(HTTP_RESPONSE_TYPES as readonly string[]).includes(String(spec.responseType))) {
    issues.push({ field: 'responseType', error: '@core.automation/step.http.issue.response-type' });
  }
  if (spec.connection !== undefined && spec.connection !== ''
    && (typeof spec.connection !== 'string' || !CONNECTION_KEY_RE.test(spec.connection))) {
    issues.push({ field: 'connection', error: '@core.automation/step.http.issue.connection' });
  }
  if (spec.responseSample !== undefined && spec.responseSample !== '') {
    if (typeof spec.responseSample !== 'string' || parseSample(spec.responseSample) === undefined) {
      issues.push({ field: 'responseSample', error: '@core.automation/step.http.issue.sample' });
    }
  }
  if (spec.mode !== undefined && !(HTTP_REQUEST_MODES as readonly string[]).includes(String(spec.mode))) {
    issues.push({ field: 'mode', error: '@core.automation/step.http.issue.mode' });
  }
  if (spec.retries !== undefined) {
    const retries = spec.retries;
    if (typeof retries !== 'number' || !Number.isInteger(retries) || retries < 0 || retries > HTTP_RETRIES_MAX) {
      issues.push({ field: 'retries', error: '@core.automation/step.http.issue.retries', errorParams: { max: String(HTTP_RETRIES_MAX) } });
    }
  }
  return issues;
};

/** Um valor da especificação que não é fixo, e onde ele está — para o teste pedir um valor de exemplo. */
export interface HttpDynamicValue {
  /** `url`, `query[0]`, `body.value`… — o mesmo endereço que as recusas usam. */
  field: string;
  /** O nome do parâmetro, cabeçalho ou campo; vazio para a URL e o corpo inteiro. */
  name: string;
  mapping: InputMapping;
}

const LIST_FIELDS = ['pathParams', 'query', 'headers'] as const;

/**
 * Os valores que só se conhecem quando a automação roda (evento, expressão, saída, variável). O teste
 * de chamada no editor não tem execução nenhuma: pede um exemplo para cada um destes.
 */
export const httpDynamicValues = (spec: HttpRequestSpec): HttpDynamicValue[] => {
  const found: HttpDynamicValue[] = [];
  const visit = (field: string, name: string, mapping: InputMapping | undefined) => {
    if (mapping && mapping.kind !== 'Literal') found.push({ field, name, mapping });
  };
  visit('url', '', spec.url);
  for (const list of LIST_FIELDS) {
    (spec[list] ?? []).forEach((entry, index) => visit(`${list}[${index}]`, entry.name, entry.value));
  }
  const body = spec.body;
  if (body?.kind === 'json' || body?.kind === 'form') {
    body.fields.forEach((entry, index) => visit(`body.fields[${index}]`, entry.name, entry.value));
  } else if (body?.kind === 'json-from' || body?.kind === 'text') {
    visit('body.value', '', body.value);
  }
  return found;
};

/**
 * A especificação com cada valor dinâmico trocado pelo exemplo informado (`field` → valor). O que não
 * tiver exemplo vira texto vazio — o teste chama mesmo assim, e a API diz o que faltou.
 */
export const withLiteralValues = (spec: HttpRequestSpec, values: Readonly<Record<string, unknown>>): HttpRequestSpec => {
  const literal = (field: string, mapping: InputMapping): InputMapping =>
    mapping.kind === 'Literal' ? mapping : { kind: 'Literal', value: values[field] ?? '' };
  const fields = (list: string, entries: MapFieldMapping[] | undefined): MapFieldMapping[] | undefined =>
    entries?.map((entry, index) => ({ ...entry, value: literal(`${list}[${index}]`, entry.value) }));
  const body = spec.body;
  return {
    ...spec,
    url: literal('url', spec.url),
    ...(spec.pathParams ? { pathParams: fields('pathParams', spec.pathParams) } : {}),
    ...(spec.query ? { query: fields('query', spec.query) } : {}),
    ...(spec.headers ? { headers: fields('headers', spec.headers) } : {}),
    ...(body?.kind === 'json' || body?.kind === 'form'
      ? { body: { ...body, fields: fields('body.fields', body.fields) ?? [] } }
      : body?.kind === 'json-from' || body?.kind === 'text'
        ? { body: { ...body, value: literal('body.value', body.value) } }
        : {}),
  };
};

/**
 * O que o "Testar chamada" do editor devolve. A recusa da fronteira também vem por aqui (`error`), e
 * não como exceção: é a resposta que o teste existe para mostrar.
 */
export interface HttpTestResult {
  ok: boolean;
  status: number;
  headers: Record<string, string>;
  body: unknown;
  durationMs: number;
  timedOut: boolean;
  error: string | null;
  errorParams?: Record<string, string>;
}

/** O teste espera no máximo isto, seja qual for o tempo do passo: quem espera é uma pessoa na tela. */
export const HTTP_TEST_TIMEOUT_SECONDS = 30;

/** O exemplo de resposta a partir do corpo de verdade: o JSON indentado, ou o texto como veio. */
export const httpSampleFromBody = (body: unknown): string =>
  typeof body === 'string' ? body : JSON.stringify(body ?? null, null, 2);

/**
 * O que não impede a automação de rodar, mas não deveria estar ali: o segredo com valor fixo. O
 * editor mostra; o portão do pacote RECUSA, porque no pacote o segredo deixaria o escritório.
 */
export const httpRequestSpecWarnings = (value: unknown): HttpRequestSpecIssue[] => {
  if (!isPlainObject(value) || !Array.isArray(value.headers)) return [];
  return value.headers.flatMap((entry: unknown, index) => {
    if (!isPlainObject(entry) || typeof entry.name !== 'string' || !isMapping(entry.value)) return [];
    const literal = literalText(entry.value);
    return isSensitiveHeaderName(entry.name) && literal !== null && literal.trim() !== ''
      ? [{
          field: `headers[${index}]`,
          error: '@core.automation/step.http.warning.literal-secret',
          errorParams: { name: entry.name.trim() },
        }]
      : [];
  });
};

// ─── Runtime: montagem ────────────────────────────────────────────────────────────────────────────

const IPV4_LITERAL = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * A URL que o servidor pode chamar: `https`, sem usuário/senha embutidos e sem IP cru. A lista de
 * domínios permitidos decide o resto — e ela não aceita IP, então o IP cru nunca a satisfaria.
 */
export const parseHttpUrl = (raw: string): { url: URL } | { error: string } => {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { error: '@core.automation/step.http.issue.url-invalid' };
  }
  if (url.protocol !== 'https:') return { error: '@core.automation/step.http.issue.url-https' };
  if (url.username || url.password) return { error: '@core.automation/step.http.issue.url-credentials' };
  const host = url.hostname;
  if (IPV4_LITERAL.test(host) || host.startsWith('[')) return { error: '@core.automation/step.http.issue.url-ip' };
  return { url };
};

const scalarText = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

/** Os pares de query de um valor resolvido: lista repete a chave; nulo e ausente não entram. */
export const queryPairs = (name: string, value: unknown): [string, string][] => {
  const values = Array.isArray(value) ? value : [value];
  return values
    .map((item) => scalarText(item))
    .filter((text): text is string => text !== null)
    .map((text) => [name, text]);
};

/**
 * A URL final: os marcadores `{nome}` substituídos com `encodeURIComponent` — um valor com `/` ou `?`
 * não muda o caminho — e os pares de query acrescentados aos que a URL já trazia.
 */
export const buildHttpUrl = (
  rawUrl: string,
  pathParams: Record<string, unknown>,
  query: [string, string][],
): { url: URL } | { error: string; errorParams?: Record<string, string> } => {
  const empty: string[] = [];
  const filled = rawUrl.replace(PLACEHOLDER, (_match, name: string) => {
    const text = scalarText(pathParams[name]);
    if (text === null || text === '') {
      empty.push(name);
      return '';
    }
    return encodeURIComponent(text);
  });
  if (empty.length > 0) {
    return { error: '@core.automation/step.http.path-param-empty', errorParams: { name: empty[0] } };
  }
  const parsed = parseHttpUrl(filled);
  if ('error' in parsed) return parsed;
  for (const [name, value] of query) parsed.url.searchParams.append(name, value);
  return parsed;
};

/** O valor de um cabeçalho: texto de uma linha. CR/LF seria injeção de cabeçalho. */
export const headerValueOf = (value: unknown): { value: string } | { error: string } => {
  const text = scalarText(value) ?? '';
  return /[\r\n\0]/.test(text) ? { error: '@core.automation/step.http.header-value-invalid' } : { value: text };
};

/** Para o histórico: a URL sem a query, que costuma levar identificadores e às vezes chave. */
export const describeHttpTarget = (url: URL): string => `${url.host}${url.pathname}`;

// ─── Configurações do escritório ──────────────────────────────────────────────────────────────────

export const HTTP_ALLOWED_HOSTS_SETTING = 'integrations.http.allowedHosts';
export const HTTP_ALLOWED_PORTS_SETTING = 'integrations.http.allowedPorts';

/** `api.exemplo.com` ou `*.exemplo.com` — nunca IP, nunca porta, nunca caminho. */
export const HTTP_HOST_PATTERN = '^(\\*\\.)?([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z]{2,63}$';
export const HTTP_PORT_PATTERN = '^([1-9][0-9]{0,3}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5])$';

const HOST_RE = new RegExp(HTTP_HOST_PATTERN);

/**
 * As duas listas moram nas Configurações do ESCRITÓRIO (sem escopo de pessoa): quem decide para onde
 * os dados saem é o escritório, não quem edita a automação. A mesma declaração alimenta a tela e o
 * servidor (`resolveSetting`), então o que a tela mostra é o que o passo aplica.
 */
export const HTTP_ALLOWED_HOSTS_PROPERTY: SettingsProperty = {
  key: HTTP_ALLOWED_HOSTS_SETTING,
  label: '@core.automation/settings.http.allowed-hosts',
  description: '@core.automation/settings.http.allowed-hosts.description',
  type: 'stringList',
  default: [],
  itemPattern: HTTP_HOST_PATTERN,
  scopes: ['tenant'],
};

export const HTTP_ALLOWED_PORTS_PROPERTY: SettingsProperty = {
  key: HTTP_ALLOWED_PORTS_SETTING,
  label: '@core.automation/settings.http.allowed-ports',
  description: '@core.automation/settings.http.allowed-ports.description',
  type: 'stringList',
  default: [],
  itemPattern: HTTP_PORT_PATTERN,
  scopes: ['tenant'],
};

export const HTTP_SETTINGS_PROPERTIES: readonly SettingsProperty[] = [HTTP_ALLOWED_HOSTS_PROPERTY, HTTP_ALLOWED_PORTS_PROPERTY];

/** A lista gravada, lida com desconfiança: só texto. */
export const asStringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

/**
 * Se o host está na lista do escritório. `*.exemplo.com` cobre os SUBdomínios, não o próprio
 * `exemplo.com` — quem quer os dois escreve os dois, e a regra fica sem surpresa.
 *
 * A lista é OBRIGATÓRIA: vazia, nada passa. Sem ela, quem edita automações enviaria dados do
 * escritório a qualquer endereço da internet.
 */
export const isHttpHostAllowed = (host: string, allowed: readonly string[]): boolean => {
  const target = host.trim().toLowerCase().replace(/\.$/, '');
  if (!target) return false;
  return allowed.some((raw) => {
    const pattern = String(raw).trim().toLowerCase();
    if (!HOST_RE.test(pattern)) return false;
    if (pattern.startsWith('*.')) {
      const suffix = pattern.slice(1);
      return target.endsWith(suffix) && target.length > suffix.length;
    }
    return target === pattern;
  });
};

/** A 443 está sempre liberada — é o `https` sem porta. As demais, só as que o escritório listou. */
export const isHttpPortAllowed = (url: URL, allowed: readonly string[]): boolean => {
  if (!url.port || url.port === '443') return true;
  return allowed.some((port) => String(port).trim() === url.port);
};

// ─── IntelliSense: a forma do exemplo de resposta ─────────────────────────────────────────────────

export type HttpSampleFieldType = 'string' | 'number' | 'boolean' | 'object' | 'list';

export interface HttpSampleField {
  key: string;
  type: HttpSampleFieldType;
  /** Os campos do objeto — ou, numa lista de objetos, os do primeiro item. */
  fields?: HttpSampleField[];
}

const SAMPLE_MAX_DEPTH = 5;
const SAMPLE_MAX_FIELDS = 200;

const parseSample = (sample: string): unknown => {
  try {
    return JSON.parse(sample) as unknown;
  } catch {
    return undefined;
  }
};

const shapeOf = (value: unknown, depth: number, budget: { left: number }): HttpSampleField[] => {
  if (!isPlainObject(value) || depth > SAMPLE_MAX_DEPTH) return [];
  const fields: HttpSampleField[] = [];
  for (const [key, child] of Object.entries(value)) {
    if (budget.left <= 0) break;
    budget.left -= 1;
    if (Array.isArray(child)) {
      const first: unknown = child[0];
      const nested = shapeOf(first, depth + 1, budget);
      fields.push({ key, type: 'list', ...(nested.length > 0 ? { fields: nested } : {}) });
    } else if (isPlainObject(child)) {
      fields.push({ key, type: 'object', fields: shapeOf(child, depth + 1, budget) });
    } else if (typeof child === 'number') {
      fields.push({ key, type: 'number' });
    } else if (typeof child === 'boolean') {
      fields.push({ key, type: 'boolean' });
    } else {
      fields.push({ key, type: 'string' });
    }
  }
  return fields;
};

/**
 * Os campos que o exemplo de resposta descreve, para o autocomplete de `body.`. Exemplo vazio,
 * inválido ou que não é objeto devolve lista vazia: o `body` continua acessível, só sem sugestão.
 */
export const httpSampleFields = (sample: string | undefined): HttpSampleField[] => {
  if (!sample?.trim()) return [];
  return shapeOf(parseSample(sample), 0, { left: SAMPLE_MAX_FIELDS });
};

/** Os caminhos-folha do exemplo (`body.cliente.nome`), para o seletor "Saída de outro step". */
export const httpSamplePaths = (fields: readonly HttpSampleField[], prefix = 'body'): string[] =>
  fields.flatMap((field) => {
    const path = `${prefix}.${field.key}`;
    return field.type === 'object' && field.fields && field.fields.length > 0
      ? httpSamplePaths(field.fields, path)
      : [path];
  });
