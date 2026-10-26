import { describe, expect, it } from 'vitest';
import { FetchOidcClient } from './oidc/FetchOidcClient';
import { CLIENT_ID, ISSUER, NOW, fakeProvider, idTokenPayload, rsaKey, signToken } from './oidc/fakeOidcProvider';
import {
  makeCompletePortalSignInUseCase,
  makeStartPortalSignInUseCase,
  portalIdentityAccountId,
} from '../../domain/usecases/PortalIdentityUseCases';
import { makeInvitePortalUserUseCase } from '../../domain/usecases/PortalAccessUseCases';
import { codeChallengeFor } from '../../domain/schema/agent/agentOAuth';
import { CITY_SCREENS, makeFakePortalRepository } from '../../domain/repositories/fakePortalRepository';
import { makeFakePortalIdentity } from '../../domain/repositories/fakePortalIdentity';
import type { PortalSignInAuditEntry } from '../../domain/repositories/IPortalIdentity';

const TENANT = 'salvador';
const REDIRECT = 'https://office.example/portal/signin/callback';

/**
 * A entrada inteira, com a criptografia de verdade: o servidor manda a pessoa ao provedor, o provedor
 * (simulado, com chaves RSA reais) assina o ID token com o `nonce` que recebeu, e a volta confere tudo
 * — o PKCE que o provedor exige, a assinatura, o `nonce` — antes de abrir a conta do escritório.
 */
const scenario = (sign: (nonce: string) => string) => {
  const key = rsaKey();
  const seen: { nonce?: string; challenge?: string } = {};
  const provider = fakeProvider([key], { tokenResponse: () => ({ id_token: sign(seen.nonce ?? ''), access_token: 'at' }) });
  const client = new FetchOidcClient(provider.fetcher, () => NOW.getTime());

  const fake = makeFakePortalRepository(CITY_SCREENS);
  fake.records.set('companies/acme', { name: 'Acme' });
  const identity = makeFakePortalIdentity(fake.users);
  identity.configs.set(TENANT, {
    settings: {
      emailLink: false,
      providers: [{ id: 'citizen', label: 'Citizen ID', issuer: ISSUER, clientId: CLIENT_ID, scopes: [], claims: ['nationalId'], levelClaim: 'acr' }],
    },
    secrets: {},
  });
  const audit: PortalSignInAuditEntry[] = [];
  const start = makeStartPortalSignInUseCase({ config: identity.config, requests: identity.requests, oidc: client, now: () => NOW });
  const complete = makeCompletePortalSignInUseCase({
    config: identity.config,
    requests: identity.requests,
    oidc: client,
    identity: identity.identity,
    accounts: identity.accounts,
    audit: async (entry) => { audit.push(entry); },
    tenantName: async () => 'Salvador',
    now: () => NOW,
  });
  const invite = makeInvitePortalUserUseCase({
    repo: fake.repo,
    identity: identity.identity,
    signIn: identity.config,
    accounts: { findUserIdByEmail: async () => null, createAccount: async () => 'never' },
    audit: async () => undefined,
    quota: { consume: async () => true },
    now: () => NOW,
  });

  const signIn = async () => {
    const { url, state } = await start.execute({ tenantId: TENANT, providerId: 'citizen', redirectUri: REDIRECT });
    const params = new URL(url).searchParams;
    seen.nonce = params.get('nonce') ?? '';
    seen.challenge = params.get('code_challenge') ?? '';
    return complete.execute({ state, code: 'code-from-provider' });
  };
  return { key, provider, fake, invite, signIn, audit, seen };
};

describe('entrada no portal por OIDC, de ponta a ponta', () => {
  it('o ID token assinado pelo provedor, com o nonce do pedido, abre a conta do escritório', async () => {
    const run = scenario((nonce) => signToken(run.key, idTokenPayload({ nonce, nationalId: '123.456.789-00', acr: 'gold' })));
    await run.invite.execute({
      tenantId: TENANT, tenantName: 'Salvador', email: 'bia@acme.com', subjectKey: 'companies/acme',
      actor: { userId: 'fiscal', userName: 'Fiscal' }, requiredClaim: { name: 'nationalId', value: '12345678900', normalize: 'digits' },
    });

    const result = await run.signIn();

    const userId = await portalIdentityAccountId(TENANT, 'citizen', 'person-1');
    expect(result.token).toBe(`token-for:${userId}`);
    expect(run.fake.users.get(userId)?.identity).toEqual({
      provider: 'citizen', claim: { name: 'nationalId', value: '12345678900' }, level: 'gold',
    });

    // O provedor recebeu o verificador que corresponde ao desafio anunciado — e só o servidor o tinha.
    const exchange = run.provider.calls.find((call) => call.url.endsWith('/token'));
    const verifier = new URLSearchParams(String(exchange?.init?.body)).get('code_verifier') ?? '';
    expect(await codeChallengeFor(verifier)).toBe(run.seen.challenge);
  });

  it('o token de outro pedido (nonce trocado) é recusado e auditado, sem conta', async () => {
    const run = scenario(() => signToken(run.key, idTokenPayload({ nonce: 'replayed', nationalId: '12345678900' })));
    await run.invite.execute({
      tenantId: TENANT, tenantName: 'Salvador', email: 'bia@acme.com', subjectKey: 'companies/acme',
      actor: { userId: 'fiscal', userName: 'Fiscal' }, requiredClaim: { name: 'nationalId', value: '12345678900' },
    });

    await expect(run.signIn()).rejects.toThrow('@core.tenant/portal.signin.identity-failed');
    expect(run.audit).toEqual([expect.objectContaining({ outcome: 'refused', reason: 'token' })]);
    expect(run.fake.users.size).toBe(0);
  });

  it('o token forjado por outra chave é recusado', async () => {
    const intruder = rsaKey();
    const run = scenario((nonce) => signToken(intruder, idTokenPayload({ nonce, nationalId: '12345678900' })));
    await run.invite.execute({
      tenantId: TENANT, tenantName: 'Salvador', email: 'bia@acme.com', subjectKey: 'companies/acme',
      actor: { userId: 'fiscal', userName: 'Fiscal' }, requiredClaim: { name: 'nationalId', value: '12345678900' },
    });
    await expect(run.signIn()).rejects.toThrow('@core.tenant/portal.signin.identity-failed');
    expect(run.fake.users.size).toBe(0);
  });
});
