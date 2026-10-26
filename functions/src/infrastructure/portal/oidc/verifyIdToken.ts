import { constants, createPublicKey, verify, type JsonWebKey, type KeyObject } from 'node:crypto';
import { OidcFailure } from '../../../domain/repositories/IPortalIdentity';

/** Uma chave do JWKS do provedor, como ele a publica. */
export interface Jwk extends JsonWebKey {
  kid?: string;
  alg?: string;
  use?: string;
}

interface AlgorithmSpec {
  hash: 'sha256' | 'sha384' | 'sha512';
  kty: 'RSA' | 'EC';
  pss?: boolean;
  curve?: string;
}

/**
 * Os algoritmos ASSIMÉTRICOS que o ID token pode usar. `none` e os HMAC (`HS*`) ficam de fora de
 * propósito: o primeiro não assina nada, e o segundo usaria o segredo do cliente como chave — o que
 * qualquer um que o conheça forjaria. É a recusa clássica que uma biblioteca permissiva esquece.
 */
const ALGORITHMS: Record<string, AlgorithmSpec> = {
  RS256: { hash: 'sha256', kty: 'RSA' },
  RS384: { hash: 'sha384', kty: 'RSA' },
  RS512: { hash: 'sha512', kty: 'RSA' },
  PS256: { hash: 'sha256', kty: 'RSA', pss: true },
  PS384: { hash: 'sha384', kty: 'RSA', pss: true },
  PS512: { hash: 'sha512', kty: 'RSA', pss: true },
  ES256: { hash: 'sha256', kty: 'EC', curve: 'P-256' },
  ES384: { hash: 'sha384', kty: 'EC', curve: 'P-384' },
  ES512: { hash: 'sha512', kty: 'EC', curve: 'P-521' },
};

export interface ParsedJwt {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signingInput: Buffer;
  signature: Buffer;
}

const refuse = (detail: string): OidcFailure => new OidcFailure('token', detail);

const BASE64URL = /^[A-Za-z0-9_-]*$/;

const decodeJson = (segment: string, what: string): Record<string, unknown> => {
  if (!BASE64URL.test(segment)) throw refuse(`${what} is not base64url`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
  } catch {
    throw refuse(`${what} is not JSON`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw refuse(`${what} is not an object`);
  return parsed as Record<string, unknown>;
};

export const parseJwt = (token: string): ParsedJwt => {
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((part) => part === '')) throw refuse('malformed token');
  const [header, payload, signature] = parts;
  if (!BASE64URL.test(signature)) throw refuse('signature is not base64url');
  return {
    header: decodeJson(header, 'header'),
    payload: decodeJson(payload, 'payload'),
    signingInput: Buffer.from(`${header}.${payload}`, 'ascii'),
    signature: Buffer.from(signature, 'base64url'),
  };
};

/**
 * A chave que assinou: pela `kid`, quando o token a traz; sem ela, só se houver UMA chave daquele tipo
 * — escolher entre várias por tentativa aceitaria a assinatura de qualquer uma delas, inclusive de uma
 * que o provedor publicou para outro uso (`use: 'enc'`).
 */
export const selectJwk = (keys: readonly Jwk[], header: Record<string, unknown>, spec: AlgorithmSpec): Jwk | null => {
  const usable = keys.filter((key) =>
    key.kty === spec.kty
    && (key.use === undefined || key.use === 'sig')
    && (key.alg === undefined || key.alg === header.alg));
  if (typeof header.kid === 'string') return usable.find((key) => key.kid === header.kid) ?? null;
  return usable.length === 1 ? usable[0] : null;
};

const publicKeyOf = (jwk: Jwk, spec: AlgorithmSpec): KeyObject => {
  if (spec.kty === 'EC' && jwk.crv !== spec.curve) throw refuse('key curve does not match the algorithm');
  try {
    const material: JsonWebKey = { ...jwk };
    delete material.kid;
    delete material.alg;
    delete material.use;
    return createPublicKey({ key: material, format: 'jwk' });
  } catch {
    throw refuse('unusable signing key');
  }
};

/** A assinatura confere com a chave publicada? A escolha do algoritmo é do CABEÇALHO, mas só entre os permitidos. */
export const verifyJwtSignature = (jwt: ParsedJwt, keys: readonly Jwk[]): boolean => {
  const alg = typeof jwt.header.alg === 'string' ? jwt.header.alg : '';
  const spec = ALGORITHMS[alg];
  if (!spec) throw refuse(`algorithm not accepted: ${alg || 'none'}`);
  const jwk = selectJwk(keys, jwt.header, spec);
  if (!jwk) return false;
  const key = publicKeyOf(jwk, spec);
  if (spec.kty === 'EC') {
    return verify(spec.hash, jwt.signingInput, { key, dsaEncoding: 'ieee-p1363' }, jwt.signature);
  }
  if (spec.pss) {
    return verify(spec.hash, jwt.signingInput, {
      key,
      padding: constants.RSA_PKCS1_PSS_PADDING,
      saltLength: constants.RSA_PSS_SALTLEN_DIGEST,
    }, jwt.signature);
  }
  return verify(spec.hash, jwt.signingInput, key, jwt.signature);
};

export const algorithmOf = (jwt: ParsedJwt): string => (typeof jwt.header.alg === 'string' ? jwt.header.alg : '');

export const isAcceptedAlgorithm = (alg: string): boolean => alg in ALGORITHMS;

/** A tolerância de relógio entre o provedor e a function. */
export const CLOCK_SKEW_SECONDS = 120;

/**
 * As conferências do ID token que não dependem da chave (OpenID Connect Core, 3.1.3.7). A ordem é a
 * da especificação, e cada recusa diz qual foi — é o que vai para o log quando um provedor mal
 * configurado recusa todo mundo.
 */
export const idTokenClaimsIssue = (
  payload: Record<string, unknown>,
  expected: { issuer: string; clientId: string; nonce: string; now: Date },
): string | null => {
  const nowSeconds = Math.floor(expected.now.getTime() / 1000);
  if (payload.iss !== expected.issuer) return 'issuer does not match';
  const audiences = typeof payload.aud === 'string'
    ? [payload.aud]
    : Array.isArray(payload.aud) ? payload.aud.filter((one): one is string => typeof one === 'string') : [];
  if (!audiences.includes(expected.clientId)) return 'audience does not include the client';
  // Mais de um público: o token foi emitido para outro cliente também, e só vale se ESTE o pediu.
  if (audiences.length > 1 && payload.azp !== expected.clientId) return 'authorized party is not the client';
  if (payload.azp !== undefined && payload.azp !== expected.clientId) return 'authorized party is not the client';
  if (typeof payload.exp !== 'number' || payload.exp + CLOCK_SKEW_SECONDS < nowSeconds) return 'token expired';
  if (typeof payload.iat !== 'number' || payload.iat - CLOCK_SKEW_SECONDS > nowSeconds) return 'token issued in the future';
  if (payload.nbf !== undefined && (typeof payload.nbf !== 'number' || payload.nbf - CLOCK_SKEW_SECONDS > nowSeconds)) {
    return 'token not yet valid';
  }
  if (payload.nonce !== expected.nonce) return 'nonce does not match';
  if (typeof payload.sub !== 'string' || payload.sub.trim() === '') return 'subject missing';
  return null;
};
