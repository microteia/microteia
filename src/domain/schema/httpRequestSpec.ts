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
}

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
  if (spec.responseSample !== undefined && spec.responseSample !== '') {
    if (typeof spec.responseSample !== 'string' || parseSample(spec.responseSample) === undefined) {
      issues.push({ field: 'responseSample', error: '@core.automation/step.http.issue.sample' });
    }
  }
  return issues;
};

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
