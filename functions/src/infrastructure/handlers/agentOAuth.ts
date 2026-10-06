import { onRequest } from 'firebase-functions/v2/https';
import type { Request } from 'firebase-functions/v2/https';
import type { Response } from 'express';
import type { AuthCodeRefusal, OAuthErrorCode } from '../../domain/schema/agent/agentOAuth';
import {
  AUTHORIZATION_SERVER_METADATA_PATH,
  OAUTH_ACCESS_TTL_MS,
  OAUTH_AUTHORIZE_PATH,
  OAUTH_CONSENT_PATH,
  OAUTH_REQUEST_TTL_MS,
  OAUTH_SCOPES,
  OAUTH_TOKEN_PATH,
  PROTECTED_RESOURCE_METADATA_PATH,
  authorizationCodeRefusal,
  authorizationServerMetadata,
  buildRefreshToken,
  parseAuthCode,
  parseRefreshToken,
  protectedResourceMetadata,
  redirectUriAllowed,
} from '../../domain/schema/agent/agentOAuth';
import {
  buildAgentToken,
  generateAgentSecret,
  hashAgentSecret,
  secretHashMatches,
} from '../../domain/schema/agent/agentGrant';
import { getDI } from '../di/container';
import { AGENT_REGION, installationIssuer, mcpResourceUrl } from '../agent/agentOrigin';
import { fetchClientMetadata } from '../agent/oauthClientDocument';

const asText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const jsonResponse = (response: Response, body: unknown, cacheSeconds: number): void => {
  response.set('Cache-Control', `public, max-age=${cacheSeconds}`);
  response.json(body);
};

/**
 * O erro do OAuth é PROTOCOLO, e por isso não passa pelo catálogo de mensagens.
 *
 * Quem lê é o cliente, que casa a string exata: `invalid_grant` é o que o faz mandar a pessoa entrar
 * de novo, e `invalid_request` no lugar dele o faria repetir o mesmo refresh para sempre.
 */
const oauthError = (
  response: Response,
  status: number,
  error: OAuthErrorCode,
  description: string,
): void => {
  response.status(status).json({ error, error_description: description });
};

/**
 * O `/authorize` falha de DOIS jeitos, e a diferença é de segurança.
 *
 * Com um redirecionamento já conferido, o erro volta por ele — é o que a spec manda, e é o que faz o
 * cliente mostrar a falha em vez de ficar esperando. Sem ele conferido, o erro fica NESTA página:
 * redirecionar para um endereço não validado é entregar a quem montou o pedido um canal para onde
 * mandar a vítima.
 */
const redirectWithError = (
  response: Response,
  redirectUri: string,
  state: string | null,
  error: OAuthErrorCode,
  description: string,
): void => {
  const target = new URL(redirectUri);
  target.searchParams.set('error', error);
  target.searchParams.set('error_description', description);
  if (state !== null) target.searchParams.set('state', state);
  response.redirect(302, target.toString());
};

const handleMetadata = (response: Response, path: string): boolean => {
  const issuer = installationIssuer();

  if (path === PROTECTED_RESOURCE_METADATA_PATH) {
    jsonResponse(response, protectedResourceMetadata(issuer, mcpResourceUrl()), 3600);
    return true;
  }
  if (path === AUTHORIZATION_SERVER_METADATA_PATH) {
    jsonResponse(response, authorizationServerMetadata(issuer), 3600);
    return true;
  }
  return false;
};

const handleAuthorize = async (request: Request, response: Response): Promise<void> => {
  const query = request.query as Record<string, unknown>;
  const clientId = asText(query.client_id);
  const redirectUri = asText(query.redirect_uri);
  const state = asText(query.state) === '' ? null : asText(query.state);

  if (clientId === '' || redirectUri === '') {
    oauthError(response, 400, 'invalid_request', 'client_id and redirect_uri are required.');
    return;
  }

  // A identidade PRIMEIRO, porque é ela que diz quais redirecionamentos existem — e é o
  // redirecionamento conferido que decide se um erro pode voltar por ele ou tem de parar aqui.
  const client = await fetchClientMetadata(clientId);
  if (client === null) {
    oauthError(response, 400, 'invalid_client', 'The client_id did not resolve to a valid client metadata document.');
    return;
  }
  if (!redirectUriAllowed(client.redirectUris, redirectUri)) {
    oauthError(response, 400, 'invalid_request', 'The redirect_uri is not registered for this client.');
    return;
  }

  if (asText(query.response_type) !== 'code') {
    redirectWithError(response, redirectUri, state, 'invalid_request', 'Only response_type=code is supported.');
    return;
  }

  const codeChallenge = asText(query.code_challenge);
  // S256 e nada mais. `plain` faria o desafio ser uma cópia do verificador, que é o mesmo que não
  // ter PKCE — e um cliente público sem PKCE é um código de autorização que qualquer app na mesma
  // máquina intercepta.
  if (codeChallenge === '' || asText(query.code_challenge_method) !== 'S256') {
    redirectWithError(response, redirectUri, state, 'invalid_request', 'A code_challenge with code_challenge_method=S256 is required.');
    return;
  }

  const requestId = await getDI().getAgentAuthRequestRepository().create({
    clientId,
    clientName: client.clientName,
    redirectUri,
    state,
    codeChallenge,
    scope: [...OAUTH_SCOPES],
    resource: asText(query.resource) === '' ? null : asText(query.resource),
    expiresAt: new Date(Date.now() + OAUTH_REQUEST_TTL_MS),
  });

  // Daqui em diante é tela, e a tela é do app: ela precisa do login do Firebase, da escolha de
  // escritório e do catálogo de permissões, que já existem ali. O que atravessa é um id opaco — a
  // consulta inteira do OAuth fica no servidor, onde ninguém a edita na barra de endereço.
  const consent = new URL(`${installationIssuer()}${OAUTH_CONSENT_PATH}`);
  consent.searchParams.set('request', requestId);
  response.redirect(302, consent.toString());
};

interface TokenGrant {
  tenantId: string;
  grantId: string;
}

const issueTokenPair = async (
  response: Response,
  { tenantId, grantId }: TokenGrant,
  rotate: (secretHash: string, refreshHash: string, accessExpiresAt: Date) => Promise<boolean>,
): Promise<void> => {
  const secret = generateAgentSecret();
  const refresh = generateAgentSecret();
  const accessToken = buildAgentToken({ tenantId, grantId, secret });
  const refreshToken = buildRefreshToken({ scope: tenantId, id: grantId, secret: refresh });

  if (accessToken === null || refreshToken === null) {
    oauthError(response, 500, 'server_error', 'Could not build the token pair.');
    return;
  }

  const accessExpiresAt = new Date(Date.now() + OAUTH_ACCESS_TTL_MS);
  const rotated = await rotate(
    await hashAgentSecret(secret),
    await hashAgentSecret(refresh),
    accessExpiresAt,
  );
  if (!rotated) {
    oauthError(response, 400, 'invalid_grant', 'The grant is no longer valid.');
    return;
  }

  // Sem cache em resposta que carrega credencial, e é a spec que o exige. Um proxy que guarde isto
  // guarda o token de alguém.
  response.set('Cache-Control', 'no-store');
  response.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: Math.floor(OAUTH_ACCESS_TTL_MS / 1000),
    refresh_token: refreshToken,
    scope: OAUTH_SCOPES.join(' '),
  });
};

/**
 * O que cada recusa da troca de código diz a quem a apresentou.
 *
 * Quase todas respondem `invalid_grant`, e isso é uma decisão: para o cliente, a diferença entre um
 * código que não existe e um que não casa com o verificador não é acionável — nos dois casos ele
 * manda a pessoa autorizar de novo. `invalid_client` é a exceção porque aponta para configuração, e
 * não para um código gasto.
 */
const CODE_REFUSAL_ERROR: Readonly<Record<AuthCodeRefusal, OAuthErrorCode>> = {
  malformed: 'invalid_grant',
  unknown: 'invalid_grant',
  expired: 'invalid_grant',
  used: 'invalid_grant',
  'redirect-mismatch': 'invalid_grant',
  'client-mismatch': 'invalid_client',
  pkce: 'invalid_grant',
};

/**
 * O `error_description` é diagnóstico de PROTOCOLO, e por isso não passa pelo catálogo.
 *
 * A RFC 6749 o define como texto ASCII destinado a quem DESENVOLVE o cliente, não a quem usa o
 * sistema — ele não aparece em tela nenhuma nossa. É o mesmo arranjo de `REFUSAL_MESSAGE` no
 * `agentMcp`, e em dois mapas pelo mesmo motivo: a frase é valor, nunca propriedade `description`.
 */
const CODE_REFUSAL_TEXT: Readonly<Record<AuthCodeRefusal, string>> = {
  malformed: 'The authorization code or code_verifier is missing or malformed.',
  unknown: 'The authorization code is not valid.',
  expired: 'The authorization code has expired.',
  used: 'The authorization code has already been used.',
  'redirect-mismatch': 'The redirect_uri does not match the one used to authorize.',
  'client-mismatch': 'The client_id does not match the one used to authorize.',
  pkce: 'The code_verifier does not match the code_challenge.',
};

const exchangeAuthorizationCode = async (
  response: Response,
  body: Record<string, unknown>,
): Promise<void> => {
  const parsed = parseAuthCode(body.code);
  const repository = getDI().getAgentAuthRequestRepository();
  const pending = parsed === null ? null : await repository.getById(parsed.id);

  const refusal = await authorizationCodeRefusal(
    pending,
    parsed === null ? null : {
      scope: parsed.scope,
      requestId: parsed.id,
      secret: parsed.secret,
      redirectUri: asText(body.redirect_uri),
      clientId: asText(body.client_id),
      verifier: asText(body.code_verifier),
    },
    { hash: hashAgentSecret, matches: secretHashMatches, now: () => new Date() },
  );
  if (refusal !== null) {
    oauthError(response, 400, CODE_REFUSAL_ERROR[refusal], CODE_REFUSAL_TEXT[refusal]);
    return;
  }

  // `authorizationCodeRefusal` já garantiu os três; o TypeScript não acompanha através dela.
  const { id: requestId, tenantId, grantId } = pending as { id: string; tenantId: string; grantId: string };

  // Gastar o código ANTES de emitir, e por transação: um código apresentado duas vezes significa que
  // alguém o leu no caminho, e a segunda troca tem de falhar mesmo chegando no mesmo instante.
  if (!(await repository.consume(requestId))) {
    oauthError(response, 400, 'invalid_grant', CODE_REFUSAL_TEXT.used);
    return;
  }

  await issueTokenPair(
    response,
    { tenantId, grantId },
    async (secretHash, refreshHash, accessExpiresAt) => {
      const grant = await getDI().getAgentGrantRepository().getById(tenantId, grantId);
      if (grant === null || grant.revokedAt !== null) return false;
      // O par ainda é nulo aqui: o consentimento cria o acesso SEM segredo utilizável, e é esta
      // troca que o estreia. Quem guarda o uso único é o código, já gasto por transação acima.
      return getDI().getAgentGrantRepository()
        .rotate(tenantId, grantId, grant.refreshHash, { secretHash, refreshHash, accessExpiresAt });
    },
  );
};

const exchangeRefreshToken = async (
  response: Response,
  body: Record<string, unknown>,
): Promise<void> => {
  const parsed = parseRefreshToken(body.refresh_token);
  if (parsed === null) {
    oauthError(response, 400, 'invalid_grant', 'The refresh_token is missing or malformed.');
    return;
  }

  const tenantId = parsed.scope;
  const grantId = parsed.id;
  const grant = await getDI().getAgentGrantRepository().getById(tenantId, grantId);
  // `origin` importa: um acesso digitado na tela não tem refresh, e rotacionar o segredo dele por
  // este caminho trocaria o token que alguém colou na configuração de um cliente.
  if (grant === null || grant.origin !== 'oauth' || grant.refreshHash === null || grant.revokedAt !== null) {
    oauthError(response, 400, 'invalid_grant', 'The refresh_token is not valid.');
    return;
  }
  if (grant.expiresAt !== null && grant.expiresAt.getTime() <= Date.now()) {
    oauthError(response, 400, 'invalid_grant', 'The authorization has expired.');
    return;
  }
  if (!secretHashMatches(grant.refreshHash, await hashAgentSecret(parsed.secret))) {
    oauthError(response, 400, 'invalid_grant', 'The refresh_token is not valid.');
    return;
  }

  const expected = grant.refreshHash;
  await issueTokenPair(
    response,
    { tenantId, grantId },
    (secretHash, refreshHash, accessExpiresAt) => getDI().getAgentGrantRepository()
      .rotate(tenantId, grantId, expected, { secretHash, refreshHash, accessExpiresAt }),
  );
};

/**
 * O corpo do `/token` chega como formulário, não como JSON.
 *
 * A RFC 6749 §4.1.3 exige `application/x-www-form-urlencoded`, e o cliente manda tanto a primeira
 * troca quanto todo refresh assim. Um parser só de JSON responderia `415` a cada renovação, e o
 * sintoma seria uma conexão que funciona por uma hora e depois morre sem explicação.
 */
const formBody = (request: Request): Record<string, unknown> => {
  const parsed = request.body as unknown;
  if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  if (typeof parsed === 'string') return Object.fromEntries(new URLSearchParams(parsed));
  const raw = request.rawBody;
  return raw ? Object.fromEntries(new URLSearchParams(raw.toString('utf8'))) : {};
};

const handleToken = async (request: Request, response: Response): Promise<void> => {
  const body = formBody(request);
  const grantType = asText(body.grant_type);

  if (grantType === 'authorization_code') {
    await exchangeAuthorizationCode(response, body);
    return;
  }
  if (grantType === 'refresh_token') {
    await exchangeRefreshToken(response, body);
    return;
  }
  oauthError(response, 400, 'unsupported_grant_type', 'Supported grant types are authorization_code and refresh_token.');
};

/**
 * O servidor de autorização do escritório, numa function só.
 *
 * Uma e não quatro porque elas são o MESMO contrato — os metadados anunciam os endereços que as
 * outras duas servem, e separá-las em functions diferentes criaria a chance de uma estar no ar
 * anunciando outra que não está. O roteamento por caminho é o que o Hosting entrega: os quatro
 * caminhos são reescritos para cá, e é por isso que eles são constantes compartilhadas em vez de
 * strings repetidas no `firebase.json`.
 *
 * Nenhuma credencial do Firebase chega aqui, e é isso que a torna pública por natureza: um cliente
 * de OAuth não tem conta neste projeto — é justamente isso que ele vem resolver.
 */
export const agentOAuth = onRequest(
  { region: AGENT_REGION, cors: true },
  async (request, response): Promise<void> => {
    const path = request.path.replace(/\/+$/, '') || '/';

    if (request.method === 'GET' && handleMetadata(response, path)) return;

    if (path === OAUTH_AUTHORIZE_PATH) {
      if (request.method !== 'GET') {
        oauthError(response, 405, 'invalid_request', 'Use GET to start authorization.');
        return;
      }
      await handleAuthorize(request, response);
      return;
    }

    if (path === OAUTH_TOKEN_PATH) {
      if (request.method !== 'POST') {
        oauthError(response, 405, 'invalid_request', 'Use POST to exchange a token.');
        return;
      }
      await handleToken(request, response);
      return;
    }

    oauthError(response, 404, 'invalid_request', 'Unknown endpoint.');
  },
);
