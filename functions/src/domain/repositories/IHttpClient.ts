/**
 * A saída HTTP do servidor para um endereço que o ESCRITÓRIO escolheu. A interface existe para o passo
 * não conhecer `node:https` — e para o teste do passo não precisar de rede.
 *
 * Quem implementa responde pelo que o passo não consegue garantir sozinho: o endereço IP efetivamente
 * conectado não é de rede interna (o nome pode resolver para `10.0.0.1`), a resposta não passa do teto
 * e o tempo não passa do limite.
 */
export interface HttpOutgoingRequest {
  method: string;
  url: URL;
  headers: Record<string, string>;
  body?: string;
}

export interface HttpClientLimits {
  timeoutMs: number;
  maxBytes: number;
}

export interface HttpIncomingResponse {
  status: number;
  /** Nomes em minúsculas. */
  headers: Record<string, string>;
  bodyText: string;
  durationMs: number;
}

/**
 * Por que a chamada não chegou a uma resposta. É CÓDIGO, e não mensagem: o passo decide a frase e se
 * aquilo falha o fluxo ou vira saída (`failOnHttpError: false`).
 */
export type HttpClientFailureCode = 'timeout' | 'address-blocked' | 'too-large' | 'network';

export class HttpClientError extends Error {
  constructor(readonly code: HttpClientFailureCode, detail?: string) {
    super(detail ?? code);
    this.name = 'HttpClientError';
  }
}

export interface IHttpClient {
  send(request: HttpOutgoingRequest, limits: HttpClientLimits): Promise<HttpIncomingResponse>;
}
