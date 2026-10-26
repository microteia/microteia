import { describe, expect, it } from 'vitest';
import {
  makeCompletePortalSignInUseCase,
  makeGetPortalSignInOptionsUseCase,
  makeManagePortalSignInUseCase,
  makeStartPortalSignInUseCase,
  portalIdentityAccountId,
  sha256Base64url,
} from './PortalIdentityUseCases';
import { makeInvitePortalUserUseCase, makeRevokePortalUserUseCase } from './PortalAccessUseCases';
import { CITY_SCREENS, makeFakePortalRepository } from '../repositories/fakePortalRepository';
import { makeFakePortalIdentity } from '../repositories/fakePortalIdentity';
import type { IOidcClient, OidcDiscovery, PortalSignInAuditEntry } from '../repositories/IPortalIdentity';
import { OidcFailure } from '../repositories/IPortalIdentity';
import type { IPortalAccountService } from '../repositories/IPortalRepository';
import type { PortalIdentityProvider } from '../schema/portalIdentity';
import { codeChallengeFor } from '../schema/agent/agentOAuth';

const TENANT = 'salvador';
const NOW = new Date('2026-10-26T12:00:00Z');
const REDIRECT = 'https://office.example/portal/signin/callback';
const FISCAL = { userId: 'fiscal', userName: 'Fiscal' };

const CITIZEN: PortalIdentityProvider = {
  id: 'citizen',
  label: 'Citizen ID',
  issuer: 'https://id.example.test',
  clientId: 'portal-client',
  scopes: ['profile'],
  claims: ['nationalId', 'email'],
  levelClaim: 'acr',
};

const DISCOVERY: OidcDiscovery = {
  issuer: CITIZEN.issuer,
  authorizationEndpoint: `${CITIZEN.issuer}/authorize`,
  tokenEndpoint: `${CITIZEN.issuer}/token`,
  jwksUri: `${CITIZEN.issuer}/jwks`,
  userinfoEndpoint: `${CITIZEN.issuer}/userinfo`,
  tokenAuthMethods: [],
};

/**
 * O provedor, do ponto de vista do domínio: o "ID token" é a lista de claims que o teste quer que ele
 * ateste, e a conferência é só a do `nonce` — a criptografia de verdade é provada em `FetchOidcClient`
 * e, de ponta a ponta, em `portalSignIn.integration.test.ts`.
 */
const fakeOidc = (claims: () => Record<string, unknown>, options: { fail?: OidcFailure['step']; userInfo?: Record<string, unknown> } = {}) => {
  const exchanges: Array<Parameters<IOidcClient['exchangeCode']>[0]> = [];
  const client: IOidcClient = {
    discover: async () => {
      if (options.fail === 'discovery') throw new OidcFailure('discovery', 'down');
      return DISCOVERY;
    },
    exchangeCode: async (input) => {
      exchanges.push(input);
      if (options.fail === 'exchange') throw new OidcFailure('exchange', 'invalid_grant');
      return { idToken: 'id-token', accessToken: 'access-token' };
    },
    verifyIdToken: async ({ nonce }) => {
      if (options.fail === 'token') throw new OidcFailure('token', 'signature does not verify');
      return { iss: CITIZEN.issuer, sub: 'person-1', nonce, ...claims() };
    },
    userInfo: async () => options.userInfo ?? {},
  };
  return { client, exchanges };
};

const noAccounts: IPortalAccountService = {
  findUserIdByEmail: async () => null,
  createAccount: async (email) => `uid-${email}`,
};

const setup = (options: {
  claims?: () => Record<string, unknown>;
  fail?: OidcFailure['step'];
  provider?: Partial<PortalIdentityProvider>;
  userInfo?: Record<string, unknown>;
} = {}) => {
  const fake = makeFakePortalRepository(CITY_SCREENS);
  fake.records.set('companies/acme', { name: 'Acme' });
  fake.records.set('companies/beta', { name: 'Beta' });
  const identity = makeFakePortalIdentity(fake.users);
  identity.configs.set(TENANT, {
    settings: { emailLink: true, providers: [{ ...CITIZEN, ...options.provider }] },
    secrets: { citizen: 'client-secret' },
  });
  const oidc = fakeOidc(options.claims ?? (() => ({ nationalId: '123.456.789-00', name: 'Bia Lima', acr: 'gold' })), options);
  const signInAudit: PortalSignInAuditEntry[] = [];
  const accessDeps = {
    repo: fake.repo,
    identity: identity.identity,
    signIn: identity.config,
    accounts: noAccounts,
    audit: async () => undefined,
    quota: { consume: async () => true },
    now: () => NOW,
  };
  let counter = 0;
  const start = makeStartPortalSignInUseCase({
    config: identity.config, requests: identity.requests, oidc: oidc.client, now: () => NOW, random: () => `rand-${++counter}`,
  });
  const complete = makeCompletePortalSignInUseCase({
    config: identity.config,
    requests: identity.requests,
    oidc: oidc.client,
    identity: identity.identity,
    accounts: identity.accounts,
    audit: async (entry) => { signInAudit.push(entry); },
    tenantName: async () => 'Salvador',
    now: () => NOW,
  });
  const invite = (subjectKey: string, claim: unknown = { name: 'nationalId', value: '12345678900', normalize: 'digits' }, email = 'bia@acme.com') =>
    makeInvitePortalUserUseCase(accessDeps).execute({
      tenantId: TENANT, tenantName: 'Salvador', email, subjectKey, actor: FISCAL, requiredClaim: claim,
    });
  const signIn = async (extra: { inviteId?: string; next?: string } = {}) => {
    const { state } = await start.execute({ tenantId: TENANT, providerId: 'citizen', redirectUri: REDIRECT, ...extra });
    return complete.execute({ state, code: 'code-1' });
  };
  return { fake, identity, oidc, signInAudit, start, complete, invite, signIn, accessDeps };
};

const refusalOf = async (promise: Promise<unknown>): Promise<string> => {
  try {
    await promise;
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error('esperava uma recusa');
};

describe('a ida ao provedor', () => {
  it('monta a autorização com PKCE S256, `openid` e os escopos do escritório, e guarda o pedido pelo hash do state', async () => {
    const { start, identity } = setup();
    const { url, state } = await start.execute({ tenantId: TENANT, providerId: 'citizen', redirectUri: REDIRECT, next: '/portal/salvador/companies' });

    const params = new URL(url).searchParams;
    expect(url.startsWith(DISCOVERY.authorizationEndpoint)).toBe(true);
    expect(params.get('response_type')).toBe('code');
    expect(params.get('client_id')).toBe('portal-client');
    expect(params.get('scope')).toBe('openid profile');
    expect(params.get('state')).toBe(state);
    expect(params.get('code_challenge_method')).toBe('S256');

    const stored = identity.requestStore.get(await sha256Base64url(state));
    expect(stored).toMatchObject({ tenantId: TENANT, providerId: 'citizen', next: '/portal/salvador/companies' });
    expect(params.get('code_challenge')).toBe(await codeChallengeFor(stored!.codeVerifier));
    expect(params.get('nonce')).toBe(stored!.nonce);
    expect(url).not.toContain(stored!.codeVerifier);
    expect(identity.requestStore.has(state)).toBe(false);
  });

  it('o destino de volta só pode ser um caminho do portal — nunca um redirecionamento aberto', async () => {
    const { start, identity } = setup();
    for (const next of ['https://evil.example', '//evil.example', '/portal/signin', '/admin']) {
      const { state } = await start.execute({ tenantId: TENANT, providerId: 'citizen', redirectUri: REDIRECT, next });
      expect(identity.requestStore.get(await sha256Base64url(state))?.next).toBeNull();
    }
  });

  it('recusa o endereço de volta fora do portal, e o provedor que o escritório não configurou', async () => {
    const { start } = setup();
    expect(await refusalOf(start.execute({ tenantId: TENANT, providerId: 'citizen', redirectUri: 'https://evil.example/cb' })))
      .toBe('@core.tenant/portal.signin.redirect-invalid');
    expect(await refusalOf(start.execute({ tenantId: TENANT, providerId: 'other', redirectUri: REDIRECT })))
      .toBe('@core.tenant/portal.signin.provider-unavailable');
    expect(await refusalOf(start.execute({ tenantId: 'other-office', providerId: 'citizen', redirectUri: REDIRECT })))
      .toBe('@core.tenant/portal.signin.provider-unavailable');
  });

  it('o provedor fora do ar é dito como tal, antes de mandar a pessoa para lá', async () => {
    const { start } = setup({ fail: 'discovery' });
    expect(await refusalOf(start.execute({ tenantId: TENANT, providerId: 'citizen', redirectUri: REDIRECT })))
      .toBe('@core.tenant/portal.signin.provider-unreachable');
  });

  it('a página de entrada recebe os métodos — nunca emissor, cliente ou segredo', async () => {
    const { identity } = setup();
    const options = await makeGetPortalSignInOptionsUseCase(identity.config).execute(TENANT);
    expect(options).toEqual({ emailLink: true, providers: [{ id: 'citizen', label: 'Citizen ID' }] });
  });
});

describe('a volta do provedor', () => {
  it('a claim coincide pela normalização do convite: abre a conta DO ESCRITÓRIO, com os sujeitos e a identidade', async () => {
    const { invite, signIn, fake, identity, signInAudit, oidc } = setup();
    await invite('companies/acme');

    const result = await signIn({ next: '/portal/salvador/companies' });

    const userId = await portalIdentityAccountId(TENANT, 'citizen', 'person-1');
    expect(result).toEqual({ token: `token-for:${userId}`, tenantId: TENANT, next: '/portal/salvador/companies' });
    expect(fake.users.get(userId)).toMatchObject({
      email: 'bia@acme.com',
      displayName: 'Bia Lima',
      subjectKeys: ['companies/acme'],
      identity: { provider: 'citizen', claim: { name: 'nationalId', value: '12345678900' }, level: 'gold' },
    });
    expect(identity.accountStore.get(userId)).toBe('Bia Lima');
    expect(signInAudit).toEqual([expect.objectContaining({ outcome: 'verified', userId, verified: expect.objectContaining({ level: 'gold' }) })]);
    expect(oidc.exchanges[0]).toMatchObject({ clientSecret: 'client-secret', redirectUri: REDIRECT, code: 'code-1' });
  });

  it('a conta nunca é a do e-mail, e a mesma pessoa em dois escritórios são duas contas', async () => {
    const one = await portalIdentityAccountId('salvador', 'citizen', 'person-1');
    const other = await portalIdentityAccountId('recife', 'citizen', 'person-1');
    expect(one).not.toBe(other);
    expect(one.startsWith('portal-id-')).toBe(true);
    expect(await portalIdentityAccountId('salvador', 'other', 'person-1')).not.toBe(one);
  });

  it('a mesma volta não vale duas vezes', async () => {
    const { invite, start, complete } = setup();
    await invite('companies/acme');
    const { state } = await start.execute({ tenantId: TENANT, providerId: 'citizen', redirectUri: REDIRECT });
    await complete.execute({ state, code: 'code-1' });
    expect(await refusalOf(complete.execute({ state, code: 'code-1' }))).toBe('@core.tenant/portal.signin.expired');
    expect(await refusalOf(complete.execute({ state: 'never-issued', code: 'code-1' }))).toBe('@core.tenant/portal.signin.expired');
  });

  it('o pedido vencido é recusado', async () => {
    const { invite, start, identity, complete } = setup();
    await invite('companies/acme');
    const { state } = await start.execute({ tenantId: TENANT, providerId: 'citizen', redirectUri: REDIRECT });
    const hash = await sha256Base64url(state);
    identity.requestStore.set(hash, { ...identity.requestStore.get(hash)!, expiresAt: new Date(NOW.getTime() - 1) });
    expect(await refusalOf(complete.execute({ state, code: 'code-1' }))).toBe('@core.tenant/portal.signin.expired');
  });

  it.each(['exchange', 'token'] as const)('a falha do protocolo (%s) é recusada, auditada, e não abre conta', async (step) => {
    const { invite, signIn, fake, signInAudit, identity } = setup({ fail: step });
    await invite('companies/acme');
    expect(await refusalOf(signIn())).toBe('@core.tenant/portal.signin.identity-failed');
    expect(signInAudit).toEqual([expect.objectContaining({ outcome: 'refused', reason: step })]);
    expect(fake.users.size).toBe(0);
    expect(identity.tokens).toEqual([]);
  });

  it('pelo link do convite, a claim diferente é recusada e auditada contra AQUELE convite — sem o valor', async () => {
    const { invite, signIn, fake, signInAudit } = setup({ claims: () => ({ nationalId: '999.999.999-99', name: 'Outra Pessoa' }) });
    const { inviteId } = await invite('companies/acme');

    expect(await refusalOf(signIn({ inviteId }))).toBe('@core.tenant/portal.signin.mismatch');
    expect(signInAudit).toEqual([expect.objectContaining({
      outcome: 'refused', reason: 'mismatch', email: 'bia@acme.com', claimName: 'nationalId', name: 'Outra Pessoa',
    })]);
    expect(JSON.stringify(signInAudit)).not.toContain('99999999999');
    expect(fake.users.size).toBe(0);
  });

  it('sem convite que a identidade satisfaça, recusa e audita', async () => {
    const { signIn, signInAudit } = setup();
    expect(await refusalOf(signIn())).toBe('@core.tenant/portal.signin.not-invited');
    expect(signInAudit).toEqual([expect.objectContaining({ outcome: 'refused', reason: 'not-invited' })]);
  });

  it('a claim que vem no token mas o escritório não declarou como atestada não prova nada', async () => {
    const { invite, signIn } = setup({ provider: { claims: ['email'] } });
    await expect(invite('companies/acme')).rejects.toThrow('@core.tenant/portal.claim.unattested');
    expect(await refusalOf(signIn())).toBe('@core.tenant/portal.signin.not-invited');
  });

  it('o e-mail só vale como claim quando o provedor diz que o verificou', async () => {
    const unverified = setup({ claims: () => ({ email: 'Bia@Acme.com', email_verified: false }) });
    await unverified.invite('companies/acme', { name: 'email', value: 'bia@acme.com', normalize: 'lowercase' });
    expect(await refusalOf(unverified.signIn())).toBe('@core.tenant/portal.signin.not-invited');

    const verified = setup({ claims: () => ({ email: 'Bia@Acme.com', email_verified: true }) });
    await verified.invite('companies/acme', { name: 'email', value: 'bia@acme.com', normalize: 'lowercase' });
    expect((await verified.signIn()).token).toMatch(/^token-for:portal-id-/);
  });

  it('o convite revogado não volta no login seguinte: a conta perde o acesso', async () => {
    const { invite, signIn, fake, accessDeps } = setup();
    const { inviteId } = await invite('companies/acme');
    await signIn();
    const userId = await portalIdentityAccountId(TENANT, 'citizen', 'person-1');
    expect(fake.users.has(userId)).toBe(true);

    await makeRevokePortalUserUseCase(accessDeps).execute({ tenantId: TENANT, guest: { inviteId: inviteId! }, subjectKey: null, actor: FISCAL });
    expect(fake.users.has(userId)).toBe(false);
    expect(await refusalOf(signIn())).toBe('@core.tenant/portal.signin.not-invited');
  });

  it('o sujeito convidado DEPOIS do aceite chega à conta na hora, sem novo login', async () => {
    const { invite, signIn, fake } = setup();
    await invite('companies/acme');
    await signIn();
    const userId = await portalIdentityAccountId(TENANT, 'citizen', 'person-1');

    await invite('companies/beta', { name: 'nationalId', value: '123.456.789-00', normalize: 'digits' }, 'outro@beta.com');

    expect(fake.users.get(userId)?.subjectKeys).toEqual(['companies/acme', 'companies/beta']);
  });

  it('com `userInfo`, completa as claims pelo provedor — e recusa o userinfo de outra pessoa', async () => {
    const merged = setup({
      provider: { userInfo: true },
      claims: () => ({ name: 'Bia' }),
      userInfo: { sub: 'person-1', nationalId: '12345678900' },
    });
    await merged.invite('companies/acme');
    expect((await merged.signIn()).token).toMatch(/^token-for:/);

    const other = setup({ provider: { userInfo: true }, userInfo: { sub: 'someone-else', nationalId: '12345678900' } });
    await other.invite('companies/acme');
    expect(await refusalOf(other.signIn())).toBe('@core.tenant/portal.signin.identity-failed');
    expect(other.signInAudit[0]).toMatchObject({ reason: 'userinfo' });
  });

  it('o nível vem da claim que o escritório apontou; sem ela, nenhum', async () => {
    const listed = setup({ provider: { levelClaim: 'amr' }, claims: () => ({ nationalId: '12345678900', amr: ['passwd', 'otp'] }) });
    await listed.invite('companies/acme');
    await listed.signIn();
    const userId = await portalIdentityAccountId(TENANT, 'citizen', 'person-1');
    expect(listed.fake.users.get(userId)?.identity?.level).toBe('passwd otp');

    const none = setup({ provider: { levelClaim: undefined } });
    await none.invite('companies/acme');
    await none.signIn();
    expect(none.fake.users.get(userId)?.identity?.level).toBeNull();
  });
});

describe('Configurações › Portal › Entrada', () => {
  const manageWith = (failDiscovery = false) => {
    const fake = makeFakePortalRepository(CITY_SCREENS);
    const identity = makeFakePortalIdentity(fake.users);
    const oidc = fakeOidc(() => ({}), failDiscovery ? { fail: 'discovery' } : {});
    return { fake, identity, manage: makeManagePortalSignInUseCase({ config: identity.config, identity: identity.identity, oidc: oidc.client }) };
  };

  it('o segredo entra e nunca sai: a vista diz só SE existe', async () => {
    const { manage, identity } = manageWith();
    const view = await manage.save({ tenantId: TENANT, userId: 'u', settings: { emailLink: true, providers: [CITIZEN] }, secrets: { citizen: ' s3cr3t ' } });
    expect(view.providers[0]).toMatchObject({ id: 'citizen', hasSecret: true });
    expect(JSON.stringify(view)).not.toContain('s3cr3t');
    expect(identity.configs.get(TENANT)?.secrets).toEqual({ citizen: 's3cr3t' });
    expect(JSON.stringify(await manage.get(TENANT))).not.toContain('s3cr3t');
  });

  it('ausente mantém o segredo, `null` apaga, e o provedor que sai leva o dele', async () => {
    const { manage, identity } = manageWith();
    const other = { ...CITIZEN, id: 'other', label: 'Other' };
    await manage.save({ tenantId: TENANT, userId: 'u', settings: { emailLink: true, providers: [CITIZEN, other] }, secrets: { citizen: 'a', other: 'b' } });
    await manage.save({ tenantId: TENANT, userId: 'u', settings: { emailLink: true, providers: [CITIZEN, other] }, secrets: {} });
    expect(identity.configs.get(TENANT)?.secrets).toEqual({ citizen: 'a', other: 'b' });
    await manage.save({ tenantId: TENANT, userId: 'u', settings: { emailLink: true, providers: [CITIZEN, other] }, secrets: { other: null } });
    expect(identity.configs.get(TENANT)?.secrets).toEqual({ citizen: 'a' });
    await manage.save({ tenantId: TENANT, userId: 'u', settings: { emailLink: true, providers: [other] }, secrets: {} });
    expect(identity.configs.get(TENANT)?.secrets).toEqual({});
  });

  it('recusa a configuração errada, e o portal sem porta de entrada', async () => {
    const { manage } = manageWith();
    expect(await refusalOf(manage.save({ tenantId: TENANT, userId: 'u', settings: { emailLink: false, providers: [] }, secrets: {} })))
      .toBe('@core.tenant/portal.identity.no-method');
    expect(await refusalOf(manage.save({
      tenantId: TENANT, userId: 'u', settings: { emailLink: true, providers: [{ ...CITIZEN, issuer: 'http://id.example.test' }] }, secrets: {},
    }))).toBe('@core.tenant/portal.identity.issuer-invalid');
  });

  it('o emissor que não responde é dito ao salvar, e não no primeiro convidado recusado', async () => {
    const { manage } = manageWith(true);
    expect(await refusalOf(manage.save({ tenantId: TENANT, userId: 'u', settings: { emailLink: true, providers: [CITIZEN] }, secrets: {} })))
      .toBe('@core.tenant/portal.identity.issuer-unreachable');
  });

  it('desligar o link de e-mail suspende quem entra por ele — e religar devolve; a conta verificada não muda', async () => {
    const { manage, fake } = manageWith();
    fake.users.set('uid-ana', { userId: 'uid-ana', email: 'ana@acme.com', displayName: 'Ana', subjectKeys: ['companies/acme'] });
    fake.users.set('portal-id-x', {
      userId: 'portal-id-x', email: 'bia@acme.com', displayName: 'Bia', subjectKeys: ['companies/acme'],
      identity: { provider: 'citizen', claim: null, level: null },
    });

    await manage.save({ tenantId: TENANT, userId: 'u', settings: { emailLink: false, providers: [CITIZEN] }, secrets: {} });
    expect(fake.users.get('uid-ana')?.suspended).toBe(true);
    expect(fake.users.get('portal-id-x')?.suspended).toBeUndefined();

    await manage.save({ tenantId: TENANT, userId: 'u', settings: { emailLink: true, providers: [CITIZEN] }, secrets: {} });
    expect(fake.users.get('uid-ana')?.suspended).toBeUndefined();
  });
});
