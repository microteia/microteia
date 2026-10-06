import type { TripleToken } from './agentGrant';
import { buildTripleToken, parseTripleToken } from './agentGrant';

/**
 * O pedido de autorização pendente, enquanto a pessoa ainda não consentiu.
 *
 * É uma coleção de RAIZ, e não uma subcoleção de escritório, porque no instante em que ela nasce
 * ainda não há escritório: quem chega pelo `/authorize` é um navegador anônimo, e a escolha de qual
 * escritório autorizar é parte do consentimento. Escolher o escritório antes seria inventá-lo.
 */
export const AGENT_AUTH_REQUESTS_COLLECTION = 'agentAuthRequests';

/**
 * Os caminhos do servidor de autorização, servidos pelo Hosting do escritório.
 *
 * Eles moram aqui, e não no `firebase.json`, porque os metadados precisam ANUNCIÁ-LOS: uma constante
 * em dois lugares vira duas constantes diferentes no dia em que alguém renomeia uma rota, e o sintoma
 * seria um cliente de OAuth que descobre um endpoint que não existe.
 */
export const OAUTH_AUTHORIZE_PATH = '/oauth/authorize';
export const OAUTH_TOKEN_PATH = '/oauth/token';
export const OAUTH_CONSENT_PATH = '/oauth/consent';
export const PROTECTED_RESOURCE_METADATA_PATH = '/.well-known/oauth-protected-resource';
export const AUTHORIZATION_SERVER_METADATA_PATH = '/.well-known/oauth-authorization-server';

export const OAUTH_CODE_PREFIX = 'mtc_';
export const OAUTH_REFRESH_PREFIX = 'mtr_';

/**
 * Sessenta segundos para o código, uma hora para o access token.
 *
 * O código vive o tempo de um redirecionamento de navegador e de uma chamada de servidor — a spec
 * recomenda no máximo dez minutos, e tudo acima do que o fluxo precisa é só janela para quem leu o
 * código num log de proxy. A hora do access token é o que faz a rotação valer alguma coisa: é ela, e
 * não o `expiresAt` do consentimento, que limita o estrago de um token vazado.
 */
export const OAUTH_CODE_TTL_MS = 60_000;
export const OAUTH_ACCESS_TTL_MS = 60 * 60_000;

/**
 * O pedido pendente também expira, e por um motivo diferente do código: ele nasce ANTES do login, e
 * quem abandona a tela de consentimento deixa um documento para trás. Trinta minutos cobrem entrar
 * com uma conta que exige segundo fator sem deixar lixo de uma aba fechada ontem.
 */
export const OAUTH_REQUEST_TTL_MS = 30 * 60_000;

/**
 * O único escopo, e ele não é o que autoriza coisa alguma.
 *
 * Quem autoriza é o conjunto de PERMISSÕES escolhido no consentimento, que é o vocabulário que o
 * escritório já tem — mapeá-lo para escopos de OAuth criaria um segundo modelo de autorização para
 * dizer a mesma coisa, e os dois divergiriam. `offline_access` está aqui porque é o que faz o cliente
 * pedir refresh token; sem ele, a conexão morre na primeira hora e não volta.
 */
export const OAUTH_SCOPES = ['offline_access'] as const;

export const OAUTH_REDIRECT_CLAUDE = 'https://claude.ai/api/mcp/auth_callback';

/**
 * Os metadados do recurso protegido (RFC 9728).
 *
 * `resource` tem de ser IGUAL à URL que a pessoa digitou no cliente, path incluído — é a única
 * comparação que o cliente faz, e ela é literal. Por isso o valor é recebido, não montado: quem sabe
 * qual URL foi anunciada é a tela que a mostrou.
 */
export const protectedResourceMetadata = (
  issuer: string,
  resource: string,
): Record<string, unknown> => ({
  resource,
  authorization_servers: [issuer],
  scopes_supported: [...OAUTH_SCOPES],
  bearer_methods_supported: ['header'],
});

/**
 * Os metadados do servidor de autorização (RFC 8414).
 *
 * Os dois valores de CIMD andam juntos e não são opcionais: o cliente só escolhe o documento de
 * identidade quando acha `client_id_metadata_document_supported` E `none` entre os métodos de
 * autenticação do token endpoint — porque o cliente dele é público. Faltando qualquer um dos dois ele
 * cai para registro dinâmico, que este servidor não oferece, e a conexão falha sem dizer por quê.
 */
export const authorizationServerMetadata = (issuer: string): Record<string, unknown> => ({
  issuer,
  authorization_endpoint: `${issuer}${OAUTH_AUTHORIZE_PATH}`,
  token_endpoint: `${issuer}${OAUTH_TOKEN_PATH}`,
  scopes_supported: [...OAUTH_SCOPES],
  response_types_supported: ['code'],
  grant_types_supported: ['authorization_code', 'refresh_token'],
  code_challenge_methods_supported: ['S256'],
  token_endpoint_auth_methods_supported: ['none'],
  client_id_metadata_document_supported: true,
});

/**
 * O código de autorização aponta para o PEDIDO, não para o acesso.
 *
 * É o pedido que guarda o desafio de PKCE, o redirecionamento e o "já foi usado" — o acesso só
 * aparece depois dele, e trocar o código é justamente conferir o pedido antes de entregar o acesso.
 */
/**
 * O cabeçalho que transforma um 401 em convite para entrar.
 *
 * Montado aqui, e não interpolado no handler, porque o formato é frágil de um jeito silencioso: as
 * aspas em volta do valor e o nome exato `resource_metadata` são o que o cliente casa, e errar
 * qualquer um dos dois produz um 401 que parece certo e que nenhum cliente segue. Sem ele, o cliente
 * tentaria adivinhar os `/.well-known` na origem do endpoint — que é a do Cloud Functions, e não
 * serve caminho na raiz.
 */
export const bearerChallenge = (issuer: string): string =>
  `Bearer resource_metadata="${issuer}${PROTECTED_RESOURCE_METADATA_PATH}"`;

export const buildAuthCode = (code: TripleToken): string | null =>
  buildTripleToken(OAUTH_CODE_PREFIX, code);

export const parseAuthCode = (raw: unknown): TripleToken | null =>
  parseTripleToken(OAUTH_CODE_PREFIX, raw);

export const buildRefreshToken = (token: TripleToken): string | null =>
  buildTripleToken(OAUTH_REFRESH_PREFIX, token);

export const parseRefreshToken = (raw: unknown): TripleToken | null =>
  parseTripleToken(OAUTH_REFRESH_PREFIX, raw);

/**
 * As duas URLs da instalação, como FÓRMULA e num lugar só.
 *
 * O front já montava a do endpoint para mostrá-la na tela, e o backend precisa da mesma string para
 * anunciá-la como `resource` — e a comparação que o cliente faz com ela é literal. Duas montagens da
 * mesma URL é uma divergência esperando o dia em que alguém muda a região num dos lados.
 */
export const hostingOrigin = (projectId: string): string => `https://${projectId}.web.app`;

export const httpFunctionEndpoint = (
  region: string,
  projectId: string,
  name: string,
): string => `https://${region}-${projectId}.cloudfunctions.net/${name}`;

const base64url = (bytes: Uint8Array): string => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/**
 * O desafio de PKCE que corresponde a um verificador, em S256.
 *
 * Só S256 — `plain` é anunciado por ninguém aqui, e aceitá-lo tornaria o desafio uma cópia do
 * verificador, que é o mesmo que não ter PKCE. O cliente da Anthropic manda S256 em toda requisição
 * de autorização, independentemente de como se registrou.
 */
export const codeChallengeFor = async (verifier: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
};

const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

const isLoopback = (url: URL): boolean =>
  url.protocol === 'http:' && LOOPBACK_HOSTS.includes(url.hostname);

const parseUrl = (raw: string): URL | null => {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
};

/**
 * O `redirect_uri` apresentado consta do documento de identidade do cliente?
 *
 * A igualdade é literal, com UMA exceção: o loopback casa ignorando a porta. A exceção não é
 * cortesia — um cliente nativo escuta numa porta efêmera que muda a cada sessão, e exigir igualdade
 * ali significa que ele nunca conecta. A RFC 8252 §7.3 obriga a ignorar a porta na forma com IP, e
 * aqui `localhost` recebe o mesmo tratamento porque é o que o cliente de terminal declara.
 *
 * Fora do loopback, só `https`. Um redirecionamento em texto claro leva o código de autorização para
 * dentro da rede de quem estiver ouvindo.
 */
export const redirectUriAllowed = (registered: readonly string[], candidate: string): boolean => {
  const wanted = parseUrl(candidate);
  if (wanted === null) return false;
  if (wanted.protocol !== 'https:' && !isLoopback(wanted)) return false;
  if (wanted.hash !== '') return false;

  return registered.some((one) => {
    const allowed = parseUrl(one);
    if (allowed === null) return false;
    if (isLoopback(allowed) && isLoopback(wanted)) {
      return allowed.hostname === wanted.hostname
        && allowed.pathname === wanted.pathname;
    }
    return allowed.href === wanted.href;
  });
};

/**
 * Os códigos de erro do OAuth, que são PROTOCOLO e não texto de tela.
 *
 * Eles não passam pelo catálogo de mensagens de propósito: quem os lê é o cliente, que casa a string
 * exata — `invalid_grant` e não `invalid_request` é o que faz um cliente saber que precisa mandar a
 * pessoa entrar de novo, em vez de tentar o mesmo refresh para sempre.
 */
export type OAuthErrorCode =
  | 'invalid_request'
  | 'invalid_client'
  | 'invalid_grant'
  | 'unauthorized_client'
  | 'unsupported_grant_type'
  | 'invalid_scope'
  | 'access_denied'
  | 'server_error';

/**
 * Por que uma troca de código não vale — ou `null` quando ela vale.
 *
 * Declarada numa função só, e não espalhada pelo handler, pela mesma razão que `permissionCharge`:
 * é A decisão de segurança deste caminho, e uma decisão de segurança escrita ao longo de um
 * if-chain de trinta linhas é uma que ninguém consegue auditar de uma vez.
 *
 * A ORDEM importa e é esta de propósito: tudo o que depende só do que foi apresentado vem antes do
 * que depende do que está gravado, e o PKCE vem por último porque é o único que custa um hash.
 */
export type AuthCodeRefusal =
  | 'malformed'
  | 'unknown'
  | 'expired'
  | 'used'
  | 'redirect-mismatch'
  | 'client-mismatch'
  | 'pkce';

export interface PresentedAuthCode {
  scope: string;
  requestId: string;
  secret: string;
  redirectUri: string;
  clientId: string;
  verifier: string;
}

export interface AuthCodeDeps {
  hash: (secret: string) => Promise<string>;
  matches: (expected: string, actual: string) => boolean;
  now: () => Date;
}

export const authorizationCodeRefusal = async (
  pending: AgentAuthRequest | null,
  presented: PresentedAuthCode | null,
  deps: AuthCodeDeps,
): Promise<AuthCodeRefusal | null> => {
  if (presented === null || presented.verifier === '') return 'malformed';

  // `unknown` cobre "não existe", "nunca foi consentido" e "o escritório não é o do código" com a
  // mesma resposta, de propósito: distingui-los contaria a quem sonda qual das três aconteceu.
  if (pending === null) return 'unknown';
  if (pending.codeHash === null || pending.tenantId === null || pending.grantId === null) return 'unknown';
  if (pending.tenantId !== presented.scope) return 'unknown';
  if (pending.usedAt !== null) return 'used';
  if (pending.expiresAt.getTime() <= deps.now().getTime()) return 'expired';

  // O redirecionamento tem de ser o MESMO da autorização. Sem esta conferência, um código obtido
  // para um destino vale para outro, e a amarração entre quem pediu e quem recebe se perde.
  if (presented.redirectUri !== pending.redirectUri) return 'redirect-mismatch';
  // O `client_id` é opcional no corpo para um cliente público; apresentado, tem de casar.
  if (presented.clientId !== '' && presented.clientId !== pending.clientId) return 'client-mismatch';

  if (!deps.matches(pending.codeHash, await deps.hash(presented.secret))) return 'unknown';
  if (await codeChallengeFor(presented.verifier) !== pending.codeChallenge) return 'pkce';

  return null;
};

export interface OAuthClientMetadata {
  clientId: string;
  clientName: string;
  redirectUris: string[];
}

const asStringArray = (value: unknown): string[] =>
  (Array.isArray(value) ? value : []).filter((one): one is string => typeof one === 'string');

/**
 * O documento de identidade do cliente (CIMD), conferido.
 *
 * A conferência que importa é a primeira: **o `client_id` de dentro do documento tem de ser a URL de
 * onde ele veio**. Sem ela, qualquer um que consiga hospedar um JSON pode reivindicar a identidade de
 * outro cliente — e a identidade é o que a pessoa lê na tela de consentimento antes de autorizar.
 *
 * O nome é só para mostrar, e por isso cai para o host da URL quando o documento não traz um: uma
 * tela que diz "autorizar " sem dizer quem é pior que uma que diz o domínio.
 */
export const parseClientMetadata = (clientId: string, body: unknown): OAuthClientMetadata | null => {
  const url = parseUrl(clientId);
  if (url === null || url.protocol !== 'https:') return null;
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;

  const document = body as Record<string, unknown>;
  if (document.client_id !== clientId) return null;

  const redirectUris = asStringArray(document.redirect_uris);
  if (redirectUris.length === 0) return null;

  const named = typeof document.client_name === 'string' ? document.client_name.trim() : '';
  return {
    clientId,
    clientName: named === '' ? url.host : named,
    redirectUris,
  };
};

export interface AgentAuthRequest {
  id: string;
  clientId: string;
  clientName: string;
  redirectUri: string;
  state: string | null;
  codeChallenge: string;
  scope: string[];
  resource: string | null;
  createdAt: Date;
  expiresAt: Date;
  /** Preenchidos no consentimento. Enquanto forem nulos, o pedido não virou código nenhum. */
  tenantId: string | null;
  userId: string | null;
  grantId: string | null;
  codeHash: string | null;
  usedAt: Date | null;
}
