import { describe, expect, it } from 'vitest';
import { FetchOidcClient } from './FetchOidcClient';
import { OidcFailure } from '../../../domain/repositories/IPortalIdentity';
import { idTokenClaimsIssue, parseJwt, verifyJwtSignature } from './verifyIdToken';
import { CLIENT_ID, ISSUER, NOW, ecKey, fakeProvider, idTokenPayload, rsaKey, signToken } from './fakeOidcProvider';

const KEY = rsaKey('k1');

const failureOf = async (promise: Promise<unknown>): Promise<OidcFailure> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof OidcFailure) return error;
    throw error;
  }
  throw new Error('esperava uma recusa');
};

const verifyWith = async (token: string, keys = [KEY], nonce = 'n-1') => {
  const provider = fakeProvider(keys);
  const client = new FetchOidcClient(provider.fetcher, () => NOW.getTime());
  const discovery = await client.discover(ISSUER);
  return client.verifyIdToken({ discovery, idToken: token, clientId: CLIENT_ID, nonce, now: NOW });
};

describe('ID token — a assinatura', () => {
  it('aceita o token assinado pela chave publicada, em RS256, PS256 e ES256', async () => {
    expect((await verifyWith(signToken(KEY, idTokenPayload()))).sub).toBe('person-1');
    expect((await verifyWith(signToken(KEY, idTokenPayload(), { alg: 'PS256' }))).sub).toBe('person-1');
    const ec = ecKey();
    expect((await verifyWith(signToken(ec, idTokenPayload(), { alg: 'ES256' }), [ec])).sub).toBe('person-1');
  });

  it('recusa `none` e HMAC — o segredo do cliente nunca é chave de assinatura', async () => {
    expect((await failureOf(verifyWith(signToken(KEY, idTokenPayload(), { alg: 'none' })))).step).toBe('token');
    const [, payload] = signToken(KEY, idTokenPayload()).split('.');
    const unsigned = `${Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url')}.${payload}.AA`;
    expect((await failureOf(verifyWith(unsigned))).message).toMatch(/algorithm/);
    expect((await failureOf(verifyWith(signToken(KEY, idTokenPayload(), { alg: 'HS256' })))).message).toMatch(/algorithm/);
  });

  it('recusa o token assinado por outra chave, e o que teve o conteúdo trocado', async () => {
    const intruder = rsaKey('k1');
    expect((await failureOf(verifyWith(signToken(intruder, idTokenPayload())))).message).toMatch(/signature/);

    const [header, , signature] = signToken(KEY, idTokenPayload()).split('.');
    const forged = Buffer.from(JSON.stringify(idTokenPayload({ sub: 'someone-else' }))).toString('base64url');
    expect((await failureOf(verifyWith(`${header}.${forged}.${signature}`))).message).toMatch(/signature/);
  });

  it('sem `kid`, só aceita quando há UMA chave possível — nunca tenta uma por uma', () => {
    const other = rsaKey('k2');
    const token = parseJwt(signToken(KEY, idTokenPayload(), { kid: null }));
    expect(verifyJwtSignature(token, [KEY.jwk])).toBe(true);
    expect(verifyJwtSignature(token, [KEY.jwk, other.jwk])).toBe(false);
  });

  it('ignora a chave publicada para cifrar (`use: enc`)', () => {
    const token = parseJwt(signToken(KEY, idTokenPayload()));
    expect(verifyJwtSignature(token, [{ ...KEY.jwk, use: 'enc' }])).toBe(false);
  });

  it('a chave girada pelo provedor é achada relendo o JWKS uma vez', async () => {
    const rotated = rsaKey('k2');
    const provider = fakeProvider([KEY]);
    let now = NOW.getTime();
    const client = new FetchOidcClient(provider.fetcher, () => now);
    const discovery = await client.discover(ISSUER);
    await client.verifyIdToken({ discovery, idToken: signToken(KEY, idTokenPayload()), clientId: CLIENT_ID, nonce: 'n-1', now: NOW });

    provider.state.keys = [rotated];
    now += 2 * 60 * 1000;
    const claims = await client.verifyIdToken({
      discovery, idToken: signToken(rotated, idTokenPayload()), clientId: CLIENT_ID, nonce: 'n-1', now: NOW,
    });
    expect(claims.sub).toBe('person-1');
    expect(provider.calls.filter((call) => call.url.endsWith('/jwks'))).toHaveLength(2);
  });

  it('o token malformado é recusado como token, não como erro qualquer', async () => {
    expect((await failureOf(verifyWith('a.b'))).step).toBe('token');
    expect((await failureOf(verifyWith('###.###.###'))).step).toBe('token');
  });
});

describe('ID token — as conferências da especificação', () => {
  const expected = { issuer: ISSUER, clientId: CLIENT_ID, nonce: 'n-1', now: NOW };
  const seconds = Math.floor(NOW.getTime() / 1000);

  it('aceita o token em ordem', () => {
    expect(idTokenClaimsIssue(idTokenPayload(), expected)).toBeNull();
  });

  it.each([
    ['outro emissor', { iss: 'https://other.test' }, /issuer/],
    ['outro cliente', { aud: 'another-client' }, /audience/],
    ['vários públicos sem azp', { aud: [CLIENT_ID, 'another'] }, /authorized party/],
    ['azp de outro cliente', { azp: 'another' }, /authorized party/],
    ['vencido', { exp: seconds - 600 }, /expired/],
    ['sem exp', { exp: undefined }, /expired/],
    ['emitido no futuro', { iat: seconds + 3600 }, /future/],
    ['ainda não válido', { nbf: seconds + 3600 }, /not yet valid/],
    ['nonce de outro pedido', { nonce: 'n-2' }, /nonce/],
    ['sem sub', { sub: '' }, /subject/],
  ])('recusa: %s', (_label, overrides, reason) => {
    expect(idTokenClaimsIssue(idTokenPayload(overrides), expected)).toMatch(reason);
  });

  it('vários públicos COM azp do cliente passam', () => {
    expect(idTokenClaimsIssue(idTokenPayload({ aud: [CLIENT_ID, 'another'], azp: CLIENT_ID }), expected)).toBeNull();
  });

  it('tolera dois minutos de relógio entre o provedor e a function', () => {
    expect(idTokenClaimsIssue(idTokenPayload({ exp: seconds - 60 }), expected)).toBeNull();
    expect(idTokenClaimsIssue(idTokenPayload({ iat: seconds + 60 }), expected)).toBeNull();
  });
});

describe('descoberta e troca do código', () => {
  it('recusa a descoberta que fala por outro emissor', async () => {
    const provider = fakeProvider([KEY], { discovery: { issuer: 'https://impostor.test' } });
    const failure = await failureOf(new FetchOidcClient(provider.fetcher).discover(ISSUER));
    expect(failure.step).toBe('discovery');
  });

  it('recusa o endpoint que não é HTTPS', async () => {
    const provider = fakeProvider([KEY], { discovery: { token_endpoint: 'http://id.example.test/token' } });
    expect((await failureOf(new FetchOidcClient(provider.fetcher).discover(ISSUER))).step).toBe('discovery');
  });

  it('o emissor com barra final é o mesmo emissor', async () => {
    const provider = fakeProvider([KEY]);
    const discovery = await new FetchOidcClient(provider.fetcher).discover(`${ISSUER}/`);
    expect(discovery.tokenEndpoint).toBe(`${ISSUER}/token`);
  });

  it('troca o código com o verificador do PKCE, e o segredo por Basic quando a descoberta não diz outro', async () => {
    const provider = fakeProvider([KEY], { tokenResponse: () => ({ id_token: 'jwt', access_token: 'at' }) });
    const client = new FetchOidcClient(provider.fetcher);
    const discovery = await client.discover(ISSUER);
    const result = await client.exchangeCode({
      discovery, clientId: CLIENT_ID, clientSecret: 's3cr3t', code: 'c-1', redirectUri: 'https://app.test/portal/signin/callback', codeVerifier: 'v-1',
    });

    expect(result).toEqual({ idToken: 'jwt', accessToken: 'at' });
    const call = provider.calls.find((one) => one.url.endsWith('/token'));
    const body = new URLSearchParams(String(call?.init?.body));
    expect(body.get('code_verifier')).toBe('v-1');
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('client_secret')).toBeNull();
    expect((call?.init?.headers as Record<string, string>).Authorization)
      .toBe(`Basic ${Buffer.from(`${CLIENT_ID}:s3cr3t`).toString('base64')}`);
  });

  it('manda o segredo no corpo quando o provedor só aceita client_secret_post', async () => {
    const provider = fakeProvider([KEY], {
      discovery: { token_endpoint_auth_methods_supported: ['client_secret_post'] },
      tokenResponse: () => ({ id_token: 'jwt' }),
    });
    const client = new FetchOidcClient(provider.fetcher);
    const discovery = await client.discover(ISSUER);
    await client.exchangeCode({
      discovery, clientId: CLIENT_ID, clientSecret: 's3cr3t', code: 'c-1', redirectUri: 'https://app.test/portal/signin/callback', codeVerifier: 'v-1',
    });
    const call = provider.calls.find((one) => one.url.endsWith('/token'));
    expect(new URLSearchParams(String(call?.init?.body)).get('client_secret')).toBe('s3cr3t');
    expect((call?.init?.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('a recusa do provedor sobe como falha da troca, com o código de erro dele', async () => {
    const provider = fakeProvider([KEY], { tokenStatus: 400, tokenResponse: () => ({ error: 'invalid_grant' }) });
    const client = new FetchOidcClient(provider.fetcher);
    const discovery = await client.discover(ISSUER);
    const failure = await failureOf(client.exchangeCode({
      discovery, clientId: CLIENT_ID, clientSecret: null, code: 'c-1', redirectUri: 'https://app.test/portal/signin/callback', codeVerifier: 'v-1',
    }));
    expect(failure.step).toBe('exchange');
    expect(failure.message).toMatch(/invalid_grant/);
  });
});
