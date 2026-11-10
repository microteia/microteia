import { request } from 'node:https';
import type { IncomingMessage } from 'node:http';
import { lookup as dnsLookup } from 'node:dns';
import type { LookupAddress, LookupOptions } from 'node:dns';
import type { LookupFunction } from 'node:net';
import { brotliDecompressSync, gunzipSync, inflateSync } from 'node:zlib';
import {
  HttpClientError,
  type HttpClientLimits,
  type HttpIncomingResponse,
  type HttpOutgoingRequest,
  type IHttpClient,
} from '../../domain/repositories/IHttpClient';
import { isBlockedAddress } from './blockedAddress';

export type ResolveAll = (
  hostname: string,
  options: { all: true; family?: number },
  callback: (error: NodeJS.ErrnoException | null, addresses: LookupAddress[]) => void,
) => void;

const systemResolveAll: ResolveAll = (hostname, options, callback) => dnsLookup(hostname, options, callback);

const BLOCKED_CODE = 'EMICROTEIA_BLOCKED';

/**
 * A resolução de nome que a CONEXÃO usa — e não uma consulta à parte, feita antes. A diferença é o
 * ataque de "DNS rebinding": conferir o nome numa resolução e conectar com outra deixa o DNS responder
 * um IP público na primeira e um interno na segunda. Aqui o IP conferido é o próprio IP conectado.
 *
 * Se QUALQUER endereço do nome for bloqueado, a chamada inteira é recusada: tentar o próximo
 * endereço deixaria o resultado depender da ordem em que o DNS respondeu.
 */
export const guardedLookup = (resolveAll: ResolveAll = systemResolveAll): LookupFunction =>
  (hostname: string, options: LookupOptions, callback) => {
    resolveAll(hostname, { all: true, ...(options.family ? { family: Number(options.family) } : {}) }, (error, addresses) => {
      if (error) {
        callback(error, '', 4);
        return;
      }
      const list = addresses ?? [];
      if (list.length === 0 || list.some((entry) => isBlockedAddress(entry.address))) {
        const blocked: NodeJS.ErrnoException = new Error(BLOCKED_CODE);
        blocked.code = BLOCKED_CODE;
        callback(blocked, '', 4);
        return;
      }
      if (options.all) {
        callback(null, list);
        return;
      }
      callback(null, list[0].address, list[0].family);
    });
  };

const headerRecord = (message: IncomingMessage): Record<string, string> => {
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(message.headers)) {
    if (value === undefined) continue;
    headers[name.toLowerCase()] = Array.isArray(value) ? value.join(', ') : value;
  }
  return headers;
};

/**
 * O corpo, lido até o teto e nunca além: passou, a conexão é derrubada. Ler tudo e cortar depois
 * deixaria um servidor hostil encher a memória da function.
 */
export const readLimited = (stream: NodeJS.ReadableStream & { destroy?: (error?: Error) => void }, maxBytes: number): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    stream.on('data', (chunk: Buffer | string) => {
      const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      total += buffer.length;
      if (total > maxBytes) {
        stream.destroy?.();
        reject(new HttpClientError('too-large'));
        return;
      }
      chunks.push(buffer);
    });
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', (error: Error) => reject(error));
  });

/**
 * O `accept-encoding: identity` é pedido, mas não garantido. O que vier comprimido é aberto com o MESMO
 * teto — sem ele, 100 KB de gzip viram gigabytes na memória.
 */
export const decodeBody = (raw: Buffer, encoding: string | undefined, maxBytes: number): Buffer => {
  const kind = (encoding ?? '').trim().toLowerCase();
  try {
    if (kind === 'gzip' || kind === 'x-gzip') return gunzipSync(raw, { maxOutputLength: maxBytes });
    if (kind === 'deflate') return inflateSync(raw, { maxOutputLength: maxBytes });
    if (kind === 'br') return brotliDecompressSync(raw, { maxOutputLength: maxBytes });
  } catch (error) {
    if (error instanceof RangeError || (error as NodeJS.ErrnoException).code === 'ERR_BUFFER_TOO_LARGE') {
      throw new HttpClientError('too-large');
    }
    throw new HttpClientError('network', error instanceof Error ? error.message : String(error));
  }
  return raw;
};

/**
 * O cliente HTTP do passo "Chamar API". `node:https` e não `fetch`: o `fetch` do Node não aceita a
 * resolução de nome da conexão sem uma dependência a mais, e é ela que fecha o rebinding.
 *
 * Redirecionamento NÃO é seguido. Cada salto seria uma URL nova fora da lista do escritório; o 3xx
 * volta como resposta, com o `location` nos cabeçalhos, e o fluxo decide.
 */
export class SafeHttpClient implements IHttpClient {
  private readonly lookup: LookupFunction;

  constructor(resolveAll: ResolveAll = systemResolveAll, private readonly now: () => number = Date.now) {
    this.lookup = guardedLookup(resolveAll);
  }

  send(outgoing: HttpOutgoingRequest, limits: HttpClientLimits): Promise<HttpIncomingResponse> {
    const startedAt = this.now();
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, limits.timeoutMs);

    const body = outgoing.body === undefined ? undefined : Buffer.from(outgoing.body, 'utf8');
    const headers: Record<string, string> = {
      ...outgoing.headers,
      'accept-encoding': 'identity',
      ...(body ? { 'content-length': String(body.length) } : {}),
    };

    return new Promise<HttpIncomingResponse>((resolve, reject) => {
      const fail = (error: unknown): void => {
        clearTimeout(timer);
        if (error instanceof HttpClientError) return reject(error);
        if (timedOut) return reject(new HttpClientError('timeout'));
        const code = (error as NodeJS.ErrnoException | undefined)?.code;
        const message = error instanceof Error ? error.message : String(error);
        if (code === BLOCKED_CODE || message === BLOCKED_CODE) return reject(new HttpClientError('address-blocked'));
        reject(new HttpClientError('network', code ?? message));
      };

      const req = request(
        outgoing.url,
        { method: outgoing.method, headers, lookup: this.lookup, signal: controller.signal },
        (response) => {
          readLimited(response, limits.maxBytes)
            .then((raw) => {
              clearTimeout(timer);
              const decoded = decodeBody(raw, response.headers['content-encoding'], limits.maxBytes);
              resolve({
                status: response.statusCode ?? 0,
                headers: headerRecord(response),
                bodyText: decoded.toString('utf8'),
                durationMs: this.now() - startedAt,
              });
            })
            .catch(fail);
        },
      );
      req.on('error', fail);
      if (body) req.write(body);
      req.end();
    });
  }
}
