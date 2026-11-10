import { HTTP_CONNECTION_KEY_PATTERN, HTTP_HOST_PATTERN, isForbiddenHeaderName, isHttpHostAllowed } from './httpRequestSpec';

/**
 * A CREDENCIAL DE INTEGRAÇÃO — o segredo que o passo "Chamar API" manda, sem que ele apareça na
 * automação.
 *
 * Duas metades, em dois lugares, pelo mesmo motivo das conexões de IA: o que DESCREVE a credencial
 * (`tenants/{t}/httpConnections/{id}`) é lido pelo editor de automações, que precisa listá-las; o
 * SEGREDO (`…/{id}/secrets/current`) é escrito pela tela e lido só pelo servidor. Nem quem cadastrou
 * consegue lê-lo de volta.
 *
 * A automação nomeia a credencial pela CHAVE, e não pelo id do documento: a automação que viaja numa
 * extensão diz "uso a credencial `crm`", e o escritório que a instala cria a credencial com essa chave.
 * Um id gerado aqui não existiria lá.
 */
export const HTTP_CONNECTIONS_COLLECTION = 'httpConnections';
export const HTTP_CONNECTION_SECRET_DOC = 'current';

/** O kernel em que o passo passou a aceitar `request.connection`. */
export const HTTP_CONNECTION_SINCE_KERNEL = '2.102.0';

export const HTTP_AUTH_SCHEMES = ['bearer', 'basic', 'header', 'query'] as const;
export type HttpAuthScheme = (typeof HTTP_AUTH_SCHEMES)[number];

export { HTTP_CONNECTION_KEY_PATTERN };
const KEY_RE = new RegExp(HTTP_CONNECTION_KEY_PATTERN);

export const isHttpConnectionKey = (value: unknown): value is string => typeof value === 'string' && KEY_RE.test(value);

export interface HttpConnection {
  id: string;
  key: string;
  name: string;
  scheme: HttpAuthScheme;
  /** O usuário do `basic`. Não é segredo — a senha é. */
  username?: string;
  /** O nome do cabeçalho (`header`) ou do parâmetro de query (`query`) que leva o segredo. */
  paramName?: string;
  /**
   * Os domínios para onde ESTE segredo pode ir — no mesmo formato da lista do escritório. Sem ela,
   * quem edita automações mandaria o token do CRM para qualquer outro domínio liberado, e o token
   * sairia por ali. A lista do escritório continua valendo por cima: os dois precisam liberar.
   */
  hosts: string[];
  hasSecret: boolean;
}

export type HttpConnectionData = Omit<HttpConnection, 'id' | 'hasSecret'>;

export interface HttpConnectionIssue {
  field: keyof HttpConnectionData | 'secret';
  error: string;
  errorParams?: Record<string, string>;
}

const HEADER_NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const QUERY_NAME = /^[A-Za-z0-9_.\-[\]]+$/;
const HOST_RE = new RegExp(HTTP_HOST_PATTERN);

/**
 * A mesma conferência na tela e no servidor. `existingKeys` são as chaves das OUTRAS credenciais do
 * escritório: duas com a mesma chave deixariam a automação sem saber qual usar.
 */
export const validateHttpConnection = (
  data: HttpConnectionData,
  existingKeys: readonly string[] = [],
): HttpConnectionIssue[] => {
  const issues: HttpConnectionIssue[] = [];
  if (!data.name?.trim()) issues.push({ field: 'name', error: '@core.automation/http-connection.issue.name' });
  if (!isHttpConnectionKey(data.key)) {
    issues.push({ field: 'key', error: '@core.automation/http-connection.issue.key' });
  } else if (existingKeys.includes(data.key)) {
    issues.push({ field: 'key', error: '@core.automation/http-connection.issue.key-taken', errorParams: { key: data.key } });
  }
  if (!(HTTP_AUTH_SCHEMES as readonly string[]).includes(data.scheme)) {
    issues.push({ field: 'scheme', error: '@core.automation/http-connection.issue.scheme' });
  }
  if (data.scheme === 'basic' && (!data.username?.trim() || data.username.includes(':'))) {
    issues.push({ field: 'username', error: '@core.automation/http-connection.issue.username' });
  }
  if (data.scheme === 'header') {
    const name = data.paramName?.trim() ?? '';
    if (!HEADER_NAME.test(name) || isForbiddenHeaderName(name)) {
      issues.push({ field: 'paramName', error: '@core.automation/http-connection.issue.header-name' });
    }
  }
  if (data.scheme === 'query' && !QUERY_NAME.test(data.paramName?.trim() ?? '')) {
    issues.push({ field: 'paramName', error: '@core.automation/http-connection.issue.query-name' });
  }
  const hosts = Array.isArray(data.hosts) ? data.hosts : [];
  if (hosts.length === 0) {
    issues.push({ field: 'hosts', error: '@core.automation/http-connection.issue.hosts-empty' });
  } else {
    const invalid = hosts.find((host) => !HOST_RE.test(String(host).trim().toLowerCase()));
    if (invalid !== undefined) {
      issues.push({ field: 'hosts', error: '@core.automation/http-connection.issue.host', errorParams: { host: String(invalid) } });
    }
  }
  return issues;
};

/** O documento gravado, lido com desconfiança: o que não tem forma de credencial vira `null`. */
export const asHttpConnection = (id: string, data: Record<string, unknown> | undefined): HttpConnection | null => {
  if (!data || !isHttpConnectionKey(data.key)) return null;
  const scheme = String(data.scheme) as HttpAuthScheme;
  if (!(HTTP_AUTH_SCHEMES as readonly string[]).includes(scheme)) return null;
  return {
    id,
    key: data.key,
    name: typeof data.name === 'string' ? data.name : data.key,
    scheme,
    ...(typeof data.username === 'string' ? { username: data.username } : {}),
    ...(typeof data.paramName === 'string' ? { paramName: data.paramName } : {}),
    hosts: Array.isArray(data.hosts) ? data.hosts.filter((host): host is string => typeof host === 'string') : [],
    hasSecret: data.hasSecret === true,
  };
};

/** Base64 de texto em UTF-8, nos dois ambientes (`btoa` existe no navegador e no Node 16+). */
const base64Utf8 = (text: string): string => {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

export interface CredentialTarget {
  url: URL;
  headers: Record<string, string>;
}

/**
 * Põe o segredo no pedido. Recusa — e não sobrescreve — o que o autor já tinha posto no mesmo lugar:
 * duas fontes para o mesmo cabeçalho fariam a chamada depender de qual ganhou.
 *
 * Devolve também as FORMAS em que o segredo saiu (o texto, o `Basic …`, o codificado na URL), para
 * que quem grava o histórico as apague de tudo o que voltar.
 */
export const applyHttpCredential = (
  connection: HttpConnection,
  secret: string,
  target: CredentialTarget,
): { target: CredentialTarget; secretForms: string[] } | { error: string; errorParams?: Record<string, string> } => {
  const host = target.url.hostname;
  if (!isHttpHostAllowed(host, connection.hosts)) {
    return { error: '@core.automation/step.http.connection.host', errorParams: { key: connection.key, host } };
  }
  const headers = { ...target.headers };
  const url = new URL(target.url.toString());
  const forms = [secret, encodeURIComponent(secret)];

  const setHeader = (name: string, value: string): string | null => {
    const lower = name.toLowerCase();
    if (headers[lower] !== undefined) return lower;
    headers[lower] = value;
    return null;
  };

  let conflict: string | null = null;
  switch (connection.scheme) {
    case 'bearer':
      conflict = setHeader('authorization', `Bearer ${secret}`);
      break;
    case 'basic': {
      const token = base64Utf8(`${connection.username ?? ''}:${secret}`);
      forms.push(token);
      conflict = setHeader('authorization', `Basic ${token}`);
      break;
    }
    case 'header':
      conflict = setHeader(connection.paramName ?? '', secret);
      break;
    case 'query': {
      const name = connection.paramName ?? '';
      if (url.searchParams.has(name)) conflict = name;
      else url.searchParams.set(name, secret);
      forms.push(new URLSearchParams({ x: secret }).toString().slice(2));
      break;
    }
    default:
      return { error: '@core.automation/http-connection.issue.scheme' };
  }
  if (conflict !== null) {
    return { error: '@core.automation/step.http.connection.conflict', errorParams: { key: connection.key, name: conflict } };
  }
  return { target: { url, headers }, secretForms: [...new Set(forms.filter((form) => form.length >= 4))] };
};

export const REDACTED = '[redacted]';

/**
 * Apaga o segredo de tudo o que vai para o histórico. A API pode devolvê-lo — um eco do pedido, uma
 * mensagem de erro que repete o cabeçalho —, e o histórico é lido por quem nunca pôde ver o segredo.
 */
export const redactSecrets = <T>(value: T, forms: readonly string[]): T => {
  if (forms.length === 0) return value;
  const scrub = (text: string): string => forms.reduce((acc, form) => acc.split(form).join(REDACTED), text);
  const walk = (node: unknown): unknown => {
    if (typeof node === 'string') return scrub(node);
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object' && !(node instanceof Date)) {
      return Object.fromEntries(Object.entries(node).map(([key, child]) => [scrub(key), walk(child)]));
    }
    return node;
  };
  return walk(value) as T;
};
