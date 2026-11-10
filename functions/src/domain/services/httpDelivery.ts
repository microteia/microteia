import {
  describeHttpTarget,
  HTTP_RESPONSE_MAX_BYTES,
  isHttpHostAllowed,
  isHttpPortAllowed,
  type HttpResponseType,
} from '../schema/httpRequestSpec';
import { applyHttpCredential } from '../schema/httpConnection';
import { HttpClientError, type HttpIncomingResponse, type HttpOutgoingRequest, type IHttpClient } from '../repositories/IHttpClient';
import type { IHttpCredentialRepository } from '../repositories/IHttpCredentialRepository';

/** O que o escritório liberou nas Configurações. Ver `HTTP_SETTINGS_PROPERTIES`. */
export interface HttpPolicy {
  allowedHosts: string[];
  allowedPorts: string[];
}

export interface HttpDeliveryDeps {
  client: IHttpClient;
  policyOf(tenantId: string): Promise<HttpPolicy>;
  credentials: IHttpCredentialRepository;
}

export interface HttpRefusal {
  message: string;
  messageParams?: Record<string, string>;
}

/** Menos que isto não dá para uma chamada de verdade: melhor dizer que o tempo acabou. */
export const MIN_USEFUL_TIMEOUT_MS = 1000;

/**
 * A FRONTEIRA do escritório: a lista de domínios, as portas e a credencial. Uma função só, chamada pelo
 * passo síncrono, pelo enfileiramento, pela entrega da fila e pelo teste do editor — o pedido que sai
 * por qualquer uma das quatro portas passa exatamente pelas mesmas recusas.
 *
 * Devolve o pedido com o segredo já posto e as FORMAS do segredo, para quem publica o resultado apagá-las.
 */
export const checkHttpBoundary = async (
  deps: HttpDeliveryDeps,
  tenantId: string,
  outgoing: HttpOutgoingRequest,
  connection: string | undefined,
): Promise<{ refused: HttpRefusal } | { outgoing: HttpOutgoingRequest; secretForms: string[] }> => {
  const host = outgoing.url.hostname;
  const policy = await deps.policyOf(tenantId);
  if (policy.allowedHosts.length === 0) {
    return { refused: { message: '@core.automation/step.http.no-allowed-hosts' } };
  }
  if (!isHttpHostAllowed(host, policy.allowedHosts)) {
    return { refused: { message: '@core.automation/step.http.host-not-allowed', messageParams: { host } } };
  }
  if (!isHttpPortAllowed(outgoing.url, policy.allowedPorts)) {
    return { refused: { message: '@core.automation/step.http.port-not-allowed', messageParams: { port: outgoing.url.port } } };
  }
  if (!connection) return { outgoing, secretForms: [] };

  const found = await deps.credentials.findByKey(tenantId, connection);
  if (!found) {
    return { refused: { message: '@core.automation/step.http.connection.missing', messageParams: { key: connection } } };
  }
  if (found.secret === null) {
    return { refused: { message: '@core.automation/step.http.connection.no-secret', messageParams: { key: connection } } };
  }
  const applied = applyHttpCredential(found.connection, found.secret, { url: outgoing.url, headers: outgoing.headers });
  if ('error' in applied) {
    return { refused: { message: applied.error, ...(applied.errorParams ? { messageParams: applied.errorParams } : {}) } };
  }
  return {
    outgoing: { ...outgoing, url: applied.target.url, headers: applied.target.headers },
    secretForms: applied.secretForms,
  };
};

export type HttpClientFailure = 'timeout' | 'too-large' | 'network';

/**
 * O que aconteceu com UMA tentativa. As três famílias são tratadas de jeitos diferentes por quem chama:
 * - `refused`: a fronteira (ou o tempo) recusou — nada saiu, e repetir daria o mesmo;
 * - `failed`: saiu e não voltou resposta utilizável (rede, tempo esgotado, grande demais);
 * - `response`: o servidor respondeu, bem ou mal.
 */
export type HttpDeliveryOutcome =
  | { kind: 'refused'; refusal: HttpRefusal }
  | { kind: 'failed'; failure: HttpClientFailure; message: string; messageParams: Record<string, string> }
  | { kind: 'response'; response: HttpIncomingResponse; body: unknown; invalidJson: boolean; ok: boolean };

const CLIENT_FAILURES: Record<HttpClientFailure, string> = {
  timeout: '@core.automation/step.http.timeout',
  'too-large': '@core.automation/step.http.too-large',
  network: '@core.automation/step.http.network',
};

const parseBody = (
  response: HttpIncomingResponse,
  responseType: HttpResponseType | undefined,
): { body: unknown } | { invalidJson: true } => {
  const type = responseType ?? 'auto';
  const contentType = response.headers['content-type'] ?? '';
  const wantsJson = type === 'json' || (type === 'auto' && /[/+]json\b/i.test(contentType));
  if (!wantsJson) return { body: response.bodyText };
  if (response.bodyText.trim() === '') return { body: null };
  try {
    return { body: JSON.parse(response.bodyText) as unknown };
  } catch {
    // No `auto`, o servidor que diz JSON e manda outra coisa não derruba o passo: o texto segue como
    // veio. Quem pediu `json` explicitamente pediu a garantia, e recebe a falha.
    return type === 'json' ? { invalidJson: true } : { body: response.bodyText };
  }
};

/** O que o servidor de fora devolve como cabeçalho é dado; cookie de sessão de terceiro não é. */
export const publicHeaders = (headers: Record<string, string>): Record<string, string> => {
  const copy = { ...headers };
  delete copy['set-cookie'];
  return copy;
};

export interface HttpDeliveryOptions {
  connection?: string;
  responseType?: HttpResponseType;
  timeoutMs: number;
}

/**
 * Uma tentativa: fronteira, tempo, envio e leitura da resposta. `secretForms` recebe as formas do
 * segredo que a tentativa usou — quem publica o resultado as apaga (`redactSecrets`).
 */
export const deliverHttp = async (
  deps: HttpDeliveryDeps,
  tenantId: string,
  prepared: HttpOutgoingRequest,
  options: HttpDeliveryOptions,
  secretForms: string[],
): Promise<HttpDeliveryOutcome> => {
  const host = prepared.url.hostname;
  const target = describeHttpTarget(prepared.url);
  const checked = await checkHttpBoundary(deps, tenantId, prepared, options.connection);
  if ('refused' in checked) return { kind: 'refused', refusal: checked.refused };
  secretForms.push(...checked.secretForms);

  if (options.timeoutMs < MIN_USEFUL_TIMEOUT_MS) {
    return { kind: 'refused', refusal: { message: '@core.automation/step.http.no-time-left' } };
  }

  let response: HttpIncomingResponse;
  try {
    response = await deps.client.send(checked.outgoing, { timeoutMs: options.timeoutMs, maxBytes: HTTP_RESPONSE_MAX_BYTES });
  } catch (error) {
    if (!(error instanceof HttpClientError)) throw error;
    if (error.code === 'address-blocked') {
      return { kind: 'refused', refusal: { message: '@core.automation/step.http.address-blocked', messageParams: { host } } };
    }
    return {
      kind: 'failed',
      failure: error.code,
      message: CLIENT_FAILURES[error.code],
      messageParams: {
        target,
        seconds: String(Math.round(options.timeoutMs / 1000)),
        max: String(Math.round(HTTP_RESPONSE_MAX_BYTES / 1024)),
        detail: error.message,
      },
    };
  }

  const parsed = parseBody(response, options.responseType);
  return {
    kind: 'response',
    response,
    body: 'body' in parsed ? parsed.body : response.bodyText,
    invalidJson: 'invalidJson' in parsed,
    ok: response.status >= 200 && response.status < 300,
  };
};
