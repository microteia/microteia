import { createHmac, createSign, generateKeyPairSync, sign, constants, type KeyObject } from 'node:crypto';
import type { Jwk } from './verifyIdToken';

/**
 * Um provedor OIDC de mentira, com chaves de verdade: assina tokens como um provedor assinaria, e
 * responde descoberta, token e JWKS por um `fetch` injetado. É o que deixa testar a conferência do
 * ID token sem rede — e sem um "mock" que aceite qualquer coisa.
 */
export const ISSUER = 'https://id.example.test';
export const CLIENT_ID = 'portal-client';

const encode = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString('base64url');

export interface FakeKey {
  kid: string;
  privateKey: KeyObject;
  jwk: Jwk;
}

export const rsaKey = (kid = 'k1'): FakeKey => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return { kid, privateKey, jwk: { ...publicKey.export({ format: 'jwk' }), kid, use: 'sig' } };
};

export const ecKey = (kid = 'e1'): FakeKey => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  return { kid, privateKey, jwk: { ...publicKey.export({ format: 'jwk' }), kid, use: 'sig' } };
};

export const signToken = (
  key: FakeKey,
  payload: Record<string, unknown>,
  options: { alg?: string; kid?: string | null } = {},
): string => {
  const alg = options.alg ?? 'RS256';
  const header: Record<string, unknown> = { alg, typ: 'JWT' };
  if (options.kid !== null) header.kid = options.kid ?? key.kid;
  const input = `${encode(header)}.${encode(payload)}`;
  let signature: Buffer;
  if (alg === 'ES256') {
    signature = sign('sha256', Buffer.from(input), { key: key.privateKey, dsaEncoding: 'ieee-p1363' });
  } else if (alg === 'PS256') {
    signature = sign('sha256', Buffer.from(input), {
      key: key.privateKey,
      padding: constants.RSA_PKCS1_PSS_PADDING,
      saltLength: constants.RSA_PSS_SALTLEN_DIGEST,
    });
  } else if (alg === 'HS256') {
    signature = createHmac('sha256', 'shared-secret').update(input).digest();
  } else if (alg === 'none') {
    signature = Buffer.alloc(0);
  } else {
    signature = createSign('RSA-SHA256').update(input).sign(key.privateKey);
  }
  return `${input}.${signature.toString('base64url')}`;
};

export const NOW = new Date('2026-10-26T12:00:00Z');
const nowSeconds = Math.floor(NOW.getTime() / 1000);

export const idTokenPayload = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  iss: ISSUER,
  aud: CLIENT_ID,
  sub: 'person-1',
  nonce: 'n-1',
  iat: nowSeconds - 10,
  exp: nowSeconds + 300,
  name: 'Bia Lima',
  ...overrides,
});

export interface FakeProviderCall {
  url: string;
  init?: RequestInit;
}

export const fakeProvider = (keys: FakeKey[], options: {
  tokenResponse?: () => Record<string, unknown>;
  tokenStatus?: number;
  discovery?: Record<string, unknown>;
  userInfo?: Record<string, unknown>;
} = {}) => {
  const calls: FakeProviderCall[] = [];
  const state = { keys };
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const fetcher = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    calls.push({ url, init });
    if (url === `${ISSUER}/.well-known/openid-configuration`) {
      return json({
        issuer: ISSUER,
        authorization_endpoint: `${ISSUER}/authorize`,
        token_endpoint: `${ISSUER}/token`,
        jwks_uri: `${ISSUER}/jwks`,
        userinfo_endpoint: `${ISSUER}/userinfo`,
        ...options.discovery,
      });
    }
    if (url === `${ISSUER}/jwks`) return json({ keys: state.keys.map((key) => key.jwk) });
    if (url === `${ISSUER}/token`) {
      return json(options.tokenResponse?.() ?? { error: 'invalid_grant' }, options.tokenStatus ?? 200);
    }
    if (url === `${ISSUER}/userinfo`) return json(options.userInfo ?? {});
    return json({ error: 'not_found' }, 404);
  };
  return { fetcher: fetcher as typeof fetch, calls, state };
};
