import { describe, expect, it } from 'vitest';
import type { AgentAuthRequest, AuthCodeDeps, PresentedAuthCode } from './agentOAuth';
import {
  AUTHORIZATION_SERVER_METADATA_PATH,
  OAUTH_AUTHORIZE_PATH,
  OAUTH_TOKEN_PATH,
  PROTECTED_RESOURCE_METADATA_PATH,
  authorizationServerMetadata,
  bearerChallenge,
  buildAuthCode,
  buildRefreshToken,
  authorizationCodeRefusal,
  codeChallengeFor,
  parseAuthCode,
  parseClientMetadata,
  parseRefreshToken,
  protectedResourceMetadata,
  redirectUriAllowed,
} from './agentOAuth';
import { parseAgentToken } from './agentGrant';

const ISSUER = 'https://escritorio.web.app';
const SECRET = 'a'.repeat(43);

describe('os metadados de descoberta', () => {
  // O cliente compara `resource` com a URL que a pessoa digitou, e a comparação é LITERAL. Montar a
  // URL aqui, em vez de recebê-la, faria o servidor anunciar um recurso que ninguém configurou.
  it('anuncia como recurso exatamente a URL que lhe deram', () => {
    const mcp = 'https://southamerica-east1-projeto.cloudfunctions.net/agentMcp';
    expect(protectedResourceMetadata(ISSUER, mcp).resource).toBe(mcp);
  });

  it('aponta para um servidor de autorização só, porque só o primeiro é lido', () => {
    expect(protectedResourceMetadata(ISSUER, 'https://x/mcp').authorization_servers).toEqual([ISSUER]);
  });

  // Os dois valores andam JUNTOS: faltando qualquer um, o cliente cai para registro dinâmico, que
  // este servidor não oferece — e a conexão falha sem dizer por quê.
  it('anuncia os dois valores que fazem o cliente escolher o documento de identidade', () => {
    const metadata = authorizationServerMetadata(ISSUER);
    expect(metadata.client_id_metadata_document_supported).toBe(true);
    expect(metadata.token_endpoint_auth_methods_supported).toEqual(['none']);
  });

  it('exige S256 e não oferece plain', () => {
    expect(authorizationServerMetadata(ISSUER).code_challenge_methods_supported).toEqual(['S256']);
  });

  it('os endereços anunciados são os mesmos caminhos que o Hosting serve', () => {
    const metadata = authorizationServerMetadata(ISSUER);
    expect(metadata.issuer).toBe(ISSUER);
    expect(metadata.authorization_endpoint).toBe(`${ISSUER}${OAUTH_AUTHORIZE_PATH}`);
    expect(metadata.token_endpoint).toBe(`${ISSUER}${OAUTH_TOKEN_PATH}`);
    expect(AUTHORIZATION_SERVER_METADATA_PATH).toBe('/.well-known/oauth-authorization-server');
    expect(PROTECTED_RESOURCE_METADATA_PATH).toBe('/.well-known/oauth-protected-resource');
  });

  it('pede o escopo que faz o cliente querer refresh token', () => {
    expect(authorizationServerMetadata(ISSUER).scopes_supported).toContain('offline_access');
  });

  // As aspas e o nome exato são o que o cliente casa. Errar qualquer um dos dois produz um 401 que
  // parece certo e que nenhum cliente segue — e o sintoma é "não consegui alcançar o servidor".
  it('o desafio do 401 aponta para os metadados, com as aspas que o cliente espera', () => {
    expect(bearerChallenge(ISSUER))
      .toBe('Bearer resource_metadata="https://escritorio.web.app/.well-known/oauth-protected-resource"');
  });
});

describe('os três valores que credenciam', () => {
  const triple = { scope: 'escritorio', id: 'pedido', secret: SECRET };

  // Prefixos diferentes para coisas diferentes: um código apresentado onde se espera um refresh
  // token tem de ser RECUSADO, não aceito por acaso porque a forma é a mesma.
  it('código, refresh e access token não se confundem entre si', () => {
    const code = buildAuthCode(triple) ?? '';
    const refresh = buildRefreshToken(triple) ?? '';

    expect(parseAuthCode(code)).toEqual(triple);
    expect(parseRefreshToken(refresh)).toEqual(triple);

    expect(parseRefreshToken(code)).toBeNull();
    expect(parseAuthCode(refresh)).toBeNull();
    expect(parseAgentToken(code)).toBeNull();
    expect(parseAgentToken(refresh)).toBeNull();
  });

  it('recusa um segmento que contenha o separador', () => {
    expect(buildAuthCode({ ...triple, id: 'a.b' })).toBeNull();
  });
});

describe('o desafio de PKCE', () => {
  // O par do RFC 7636, apêndice B. Ele está aqui por extenso porque uma implementação de base64url
  // que erre o recorte do `=` casa com ela mesma e com nenhum cliente.
  it('reproduz o exemplo canônico do RFC', async () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    await expect(codeChallengeFor(verifier)).resolves
      .toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('um verificador diferente não casa com o desafio', async () => {
    const certo = await codeChallengeFor('verificador-certo');
    await expect(codeChallengeFor('verificador-errado')).resolves.not.toBe(certo);
  });
});

describe('o redirecionamento registrado', () => {
  const CLAUDE = 'https://claude.ai/api/mcp/auth_callback';

  it('casa o registrado por igualdade literal', () => {
    expect(redirectUriAllowed([CLAUDE], CLAUDE)).toBe(true);
    expect(redirectUriAllowed([CLAUDE], 'https://claude.ai/api/mcp/outro')).toBe(false);
    expect(redirectUriAllowed([CLAUDE], 'https://cIaude.ai/api/mcp/auth_callback')).toBe(false);
  });

  // A porta efêmera muda a cada sessão de um cliente nativo. Exigir igualdade aqui é o mesmo que
  // dizer que ele nunca conecta.
  it('ignora a porta no loopback, nas duas formas que o cliente de terminal declara', () => {
    expect(redirectUriAllowed(['http://localhost/callback'], 'http://localhost:3118/callback')).toBe(true);
    expect(redirectUriAllowed(['http://127.0.0.1/callback'], 'http://127.0.0.1:51204/callback')).toBe(true);
  });

  it('o loopback continua tendo de casar o caminho e o host', () => {
    expect(redirectUriAllowed(['http://localhost/callback'], 'http://localhost:3118/outro')).toBe(false);
    expect(redirectUriAllowed(['http://localhost/callback'], 'http://127.0.0.1:3118/callback')).toBe(false);
  });

  // Fora do loopback, `http` leva o código de autorização em texto claro para quem estiver ouvindo.
  it('recusa texto claro fora do loopback, mesmo registrado', () => {
    expect(redirectUriAllowed(['http://exemplo.com/cb'], 'http://exemplo.com/cb')).toBe(false);
  });

  it('recusa fragmento, que a spec proíbe num redirecionamento', () => {
    expect(redirectUriAllowed([CLAUDE], `${CLAUDE}#x`)).toBe(false);
  });

  it('recusa o que não é URL', () => {
    expect(redirectUriAllowed([CLAUDE], 'nao-e-url')).toBe(false);
  });
});

describe('o documento de identidade do cliente', () => {
  const CLIENT = 'https://claude.ai/oauth/client-metadata';
  const BODY = {
    client_id: CLIENT,
    client_name: 'Claude',
    redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
  };

  it('aceita o documento que se identifica pela URL de onde veio', () => {
    expect(parseClientMetadata(CLIENT, BODY)).toEqual({
      clientId: CLIENT,
      clientName: 'Claude',
      redirectUris: ['https://claude.ai/api/mcp/auth_callback'],
    });
  });

  // É a conferência que sustenta a tela de consentimento: sem ela, quem conseguir hospedar um JSON
  // reivindica a identidade de outro cliente, e a pessoa autoriza lendo um nome emprestado.
  it('recusa o documento que reivindica um client_id diferente do seu endereço', () => {
    expect(parseClientMetadata(CLIENT, { ...BODY, client_id: 'https://outro/doc' })).toBeNull();
  });

  it('recusa documento sem redirecionamento, que não serve para nada', () => {
    expect(parseClientMetadata(CLIENT, { ...BODY, redirect_uris: [] })).toBeNull();
  });

  it('recusa um client_id que não é https', () => {
    expect(parseClientMetadata('http://claude.ai/doc', { ...BODY, client_id: 'http://claude.ai/doc' }))
      .toBeNull();
  });

  it('sem nome, mostra o host — uma tela que não diz quem é pior que uma que diz o domínio', () => {
    const anonimo = parseClientMetadata(CLIENT, { ...BODY, client_name: '   ' });
    expect(anonimo?.clientName).toBe('claude.ai');
  });

  it('recusa corpo que não é objeto', () => {
    expect(parseClientMetadata(CLIENT, [BODY])).toBeNull();
    expect(parseClientMetadata(CLIENT, null)).toBeNull();
  });
});

describe('a troca do código de autorização', () => {
  const AGORA = new Date('2026-10-06T12:00:00Z');
  const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
  const DESAFIO = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
  const REDIRECT = 'https://claude.ai/api/mcp/auth_callback';
  const CLIENTE = 'https://claude.ai/oauth/client-metadata';

  const pedido = (sobrepondo: Partial<AgentAuthRequest> = {}): AgentAuthRequest => ({
    id: 'pedido1',
    clientId: CLIENTE,
    clientName: 'Claude',
    redirectUri: REDIRECT,
    state: 'abc',
    codeChallenge: DESAFIO,
    scope: ['offline_access'],
    resource: null,
    createdAt: new Date('2026-10-06T11:59:00Z'),
    expiresAt: new Date('2026-10-06T12:00:30Z'),
    tenantId: 'escritorio1',
    userId: 'membro1',
    grantId: 'acesso1',
    codeHash: 'hash-do-segredo',
    usedAt: null,
    ...sobrepondo,
  });

  const apresentado = (sobrepondo: Partial<PresentedAuthCode> = {}): PresentedAuthCode => ({
    scope: 'escritorio1',
    requestId: 'pedido1',
    secret: SECRET,
    redirectUri: REDIRECT,
    clientId: CLIENTE,
    verifier: VERIFIER,
    ...sobrepondo,
  });

  // Injetadas para o teste poder exercitar a ORDEM das recusas sem Firestore nem hash de verdade —
  // o mesmo arranjo de `authenticateAgent.test.ts`.
  const deps = (sobrepondo: Partial<AuthCodeDeps> = {}): AuthCodeDeps => ({
    hash: async () => 'hash-do-segredo',
    matches: (esperado, atual) => esperado === atual,
    now: () => AGORA,
    ...sobrepondo,
  });

  it('aceita a troca em que tudo casa', async () => {
    await expect(authorizationCodeRefusal(pedido(), apresentado(), deps())).resolves.toBeNull();
  });

  it('recusa sem código e sem verificador', async () => {
    await expect(authorizationCodeRefusal(pedido(), null, deps())).resolves.toBe('malformed');
    await expect(authorizationCodeRefusal(pedido(), apresentado({ verifier: '' }), deps()))
      .resolves.toBe('malformed');
  });

  // As três respondem igual de propósito: distingui-las contaria a quem sonda qual aconteceu.
  it('não distingue inexistente, não consentido e escritório trocado', async () => {
    await expect(authorizationCodeRefusal(null, apresentado(), deps())).resolves.toBe('unknown');
    await expect(authorizationCodeRefusal(pedido({ codeHash: null }), apresentado(), deps()))
      .resolves.toBe('unknown');
    await expect(authorizationCodeRefusal(pedido(), apresentado({ scope: 'outro' }), deps()))
      .resolves.toBe('unknown');
  });

  it('recusa o segredo errado sem dizer que ele é o errado', async () => {
    await expect(authorizationCodeRefusal(pedido(), apresentado(), deps({ matches: () => false })))
      .resolves.toBe('unknown');
  });

  // Um código apresentado duas vezes significa que alguém o leu no caminho.
  it('recusa o código já gasto', async () => {
    await expect(authorizationCodeRefusal(pedido({ usedAt: AGORA }), apresentado(), deps()))
      .resolves.toBe('used');
  });

  it('recusa o código vencido', async () => {
    const vencido = pedido({ expiresAt: new Date('2026-10-06T11:59:59Z') });
    await expect(authorizationCodeRefusal(vencido, apresentado(), deps())).resolves.toBe('expired');
  });

  // Sem esta conferência, um código obtido para um destino vale para outro.
  it('recusa o redirecionamento diferente do que autorizou', async () => {
    await expect(authorizationCodeRefusal(pedido(), apresentado({ redirectUri: 'https://claude.ai/outro' }), deps()))
      .resolves.toBe('redirect-mismatch');
  });

  it('o client_id é opcional, mas apresentado tem de casar', async () => {
    await expect(authorizationCodeRefusal(pedido(), apresentado({ clientId: '' }), deps()))
      .resolves.toBeNull();
    await expect(authorizationCodeRefusal(pedido(), apresentado({ clientId: 'https://outro/doc' }), deps()))
      .resolves.toBe('client-mismatch');
  });

  it('recusa o verificador que não gera o desafio autorizado', async () => {
    await expect(authorizationCodeRefusal(pedido(), apresentado({ verifier: 'outro-verificador' }), deps()))
      .resolves.toBe('pkce');
  });

  // Gasto vence vencido, e os dois vencem o PKCE: o que não depende de hash nenhum é decidido
  // primeiro, e o único que custa uma volta de SHA-256 fica por último.
  it('a ordem das recusas é estável', async () => {
    const ruim = pedido({ usedAt: AGORA, expiresAt: new Date('2026-01-01T00:00:00Z') });
    await expect(authorizationCodeRefusal(ruim, apresentado({ verifier: 'errado' }), deps()))
      .resolves.toBe('used');
  });
});
