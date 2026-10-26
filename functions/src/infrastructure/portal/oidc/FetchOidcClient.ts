import type { IOidcClient, OidcDiscovery } from '../../../domain/repositories/IPortalIdentity';
import { OidcFailure } from '../../../domain/repositories/IPortalIdentity';
import { normalizePortalIssuer } from '../../../domain/schema/portalIdentity';
import { idTokenClaimsIssue, parseJwt, verifyJwtSignature, type Jwk } from './verifyIdToken';

type Fetch = typeof fetch;

const TIMEOUT_MS = 10_000;
const DISCOVERY_TTL_MS = 60 * 60 * 1000;
const JWKS_TTL_MS = 60 * 60 * 1000;
/** Uma `kid` desconhecida relê o JWKS — o provedor girou a chave —, mas não mais de uma vez por minuto. */
const JWKS_REFRESH_MIN_MS = 60 * 1000;

const isServerUrl = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      || (url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1'));
  } catch {
    return false;
  }
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * O cliente OIDC que roda na function — a parte "confidencial" do protocolo: o segredo do cliente e o
 * verificador do PKCE nunca vão ao navegador, e o ID token é conferido AQUI, contra as chaves que o
 * próprio provedor publica. O navegador só leva a pessoa até o provedor e traz o `code` de volta.
 *
 * Sem biblioteca de OIDC, de propósito: o que o portal precisa é o fluxo de código com PKCE e a
 * conferência de um JWT assinado, e as duas coisas cabem no `node:crypto`. Uma dependência a mais
 * entraria no pacote de toda instalação, para usar uma fração dela.
 */
export class FetchOidcClient implements IOidcClient {
  private readonly discoveries = new Map<string, { value: OidcDiscovery; at: number }>();
  private readonly keySets = new Map<string, { keys: Jwk[]; at: number }>();

  constructor(private readonly fetcher: Fetch = fetch, private readonly clock: () => number = Date.now) {}

  private async getJson(step: OidcFailure['step'], url: string, init?: RequestInit): Promise<Record<string, unknown>> {
    let response: Response;
    try {
      response = await this.fetcher(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (error) {
      throw new OidcFailure(step, `request failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new OidcFailure(step, `response is not JSON (HTTP ${response.status})`);
    }
    if (!response.ok) {
      const code = isObject(body) && typeof body.error === 'string' ? body.error : `HTTP ${response.status}`;
      throw new OidcFailure(step, `provider refused: ${code}`);
    }
    if (!isObject(body)) throw new OidcFailure(step, 'response is not an object');
    return body;
  }

  async discover(issuer: string): Promise<OidcDiscovery> {
    const expected = normalizePortalIssuer(issuer);
    const cached = this.discoveries.get(expected);
    if (cached && this.clock() - cached.at < DISCOVERY_TTL_MS) return cached.value;

    const document = await this.getJson('discovery', `${expected}/.well-known/openid-configuration`);
    // O emissor anunciado tem de ser o configurado: é ele que o `iss` do token vai repetir, e um
    // documento que fala por outro emissor é o começo de uma confusão de provedores.
    if (typeof document.issuer !== 'string' || normalizePortalIssuer(document.issuer) !== expected) {
      throw new OidcFailure('discovery', 'issuer in the discovery document does not match');
    }
    const { authorization_endpoint: authorization, token_endpoint: token, jwks_uri: jwks } = document;
    if (!isServerUrl(authorization) || !isServerUrl(token) || !isServerUrl(jwks)) {
      throw new OidcFailure('discovery', 'discovery document lacks a usable endpoint');
    }
    const methods = Array.isArray(document.token_endpoint_auth_methods_supported)
      ? document.token_endpoint_auth_methods_supported.filter((one): one is string => typeof one === 'string')
      : [];
    const value: OidcDiscovery = {
      issuer: document.issuer,
      authorizationEndpoint: authorization,
      tokenEndpoint: token,
      jwksUri: jwks,
      userinfoEndpoint: isServerUrl(document.userinfo_endpoint) ? document.userinfo_endpoint : null,
      tokenAuthMethods: methods,
    };
    this.discoveries.set(expected, { value, at: this.clock() });
    return value;
  }

  async exchangeCode({ discovery, clientId, clientSecret, code, redirectUri, codeVerifier }: Parameters<IOidcClient['exchangeCode']>[0]) {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
      client_id: clientId,
    });
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    };
    if (clientSecret) {
      // Sem a lista na descoberta, o padrão da especificação é `client_secret_basic`.
      const methods = discovery.tokenAuthMethods;
      if (methods.length === 0 || methods.includes('client_secret_basic')) {
        const credential = `${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`;
        headers.Authorization = `Basic ${Buffer.from(credential).toString('base64')}`;
      } else {
        body.set('client_secret', clientSecret);
      }
    }
    const response = await this.getJson('exchange', discovery.tokenEndpoint, { method: 'POST', headers, body: body.toString() });
    if (typeof response.id_token !== 'string' || response.id_token === '') {
      throw new OidcFailure('exchange', 'token response has no id_token');
    }
    return {
      idToken: response.id_token,
      accessToken: typeof response.access_token === 'string' && response.access_token !== '' ? response.access_token : null,
    };
  }

  private async keysOf(jwksUri: string, refresh: boolean): Promise<Jwk[]> {
    const cached = this.keySets.get(jwksUri);
    const age = cached ? this.clock() - cached.at : Infinity;
    if (cached && age < JWKS_TTL_MS && (!refresh || age < JWKS_REFRESH_MIN_MS)) return cached.keys;
    const document = await this.getJson('token', jwksUri);
    const keys = Array.isArray(document.keys) ? document.keys.filter(isObject) as Jwk[] : [];
    this.keySets.set(jwksUri, { keys, at: this.clock() });
    return keys;
  }

  async verifyIdToken({ discovery, idToken, clientId, nonce, now }: Parameters<IOidcClient['verifyIdToken']>[0]) {
    const jwt = parseJwt(idToken);
    let signed = verifyJwtSignature(jwt, await this.keysOf(discovery.jwksUri, false));
    if (!signed) signed = verifyJwtSignature(jwt, await this.keysOf(discovery.jwksUri, true));
    if (!signed) throw new OidcFailure('token', 'signature does not verify');
    const issue = idTokenClaimsIssue(jwt.payload, { issuer: discovery.issuer, clientId, nonce, now });
    if (issue) throw new OidcFailure('token', issue);
    return jwt.payload;
  }

  async userInfo({ discovery, accessToken }: Parameters<IOidcClient['userInfo']>[0]) {
    if (!discovery.userinfoEndpoint) throw new OidcFailure('userinfo', 'provider has no userinfo endpoint');
    return this.getJson('userinfo', discovery.userinfoEndpoint, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });
  }
}
