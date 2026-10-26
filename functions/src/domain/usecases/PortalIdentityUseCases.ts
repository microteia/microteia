import type {
  IOidcClient,
  IPortalIdentityAccountService,
  IPortalIdentityConfigRepository,
  IPortalIdentityRepository,
  IPortalSignInRequestRepository,
  PortalIdentityInvite,
  PortalSignInAudit,
  PortalSignInAuditEntry,
  PortalSignInRefusal,
} from '../repositories/IPortalIdentity';
import { OidcFailure } from '../repositories/IPortalIdentity';
import { failedPrecondition, invalidArgument, permissionDenied } from '../errors/DomainError';
import { codeChallengeFor } from '../schema/agent/agentOAuth';
import {
  PORTAL_IDENTITY_ACCOUNT_PREFIX,
  asPortalSignInSettings,
  isPortalReturnPath,
  isPortalSignInRedirectUri,
  portalClaimMatches,
  portalIdentityLevel,
  portalLoginClaimKeys,
  portalSignInOptions,
  portalSignInSettingsIssue,
  type PortalIdentityProvider,
  type PortalSignInOptions,
  type PortalSignInSettings,
  type PortalVerifiedIdentity,
} from '../schema/portalIdentity';

/** Quanto tempo a pessoa tem para voltar do provedor. */
export const PORTAL_SIGN_IN_REQUEST_TTL_MS = 10 * 60 * 1000;

const base64url = (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64url');

export const randomPortalToken = (bytes = 32): string => base64url(crypto.getRandomValues(new Uint8Array(bytes)));

export const sha256Base64url = async (text: string): Promise<string> =>
  base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))));

/**
 * A conta de quem entra por um provedor do portal: uma por ESCRITÓRIO, provedor e pessoa (`sub`).
 *
 * Nunca a conta do e-mail convidado, e nunca a mesma conta em dois escritórios. O provedor é
 * configurado pelo escritório — quem tem `portal.manage` escolhe o emissor —, e o que ele atesta só
 * pode valer DENTRO daquele escritório. Se o login abrisse a conta do e-mail, um escritório com um
 * emissor próprio entraria na conta de quem é convidado, ou membro, de outro.
 */
export const portalIdentityAccountId = async (tenantId: string, providerId: string, subject: string): Promise<string> =>
  `${PORTAL_IDENTITY_ACCOUNT_PREFIX}${await sha256Base64url(`${tenantId}\n${providerId}\n${subject}`)}`;

const textClaim = (claims: Record<string, unknown>, name: string): string =>
  (typeof claims[name] === 'string' ? (claims[name] as string).trim() : '');

/** O nome que a pessoa tem no provedor — o que a lista do escritório e a Auditoria mostram. */
const nameOf = (claims: Record<string, unknown>): string =>
  textClaim(claims, 'name')
  || [textClaim(claims, 'given_name'), textClaim(claims, 'family_name')].filter(Boolean).join(' ');

const auditQuietly = async (audit: PortalSignInAudit, entry: PortalSignInAuditEntry): Promise<void> => {
  try {
    await audit(entry);
  } catch {
    // A Auditoria é rastro: a recusa continua recusa, e a entrada aceita continua aceita.
  }
};

const providerOf = (settings: PortalSignInSettings, providerId: string): PortalIdentityProvider | undefined =>
  settings.providers.find((provider) => provider.id === providerId);

export type GetPortalSignInOptionsUseCase = {
  execute: (tenantId: string) => Promise<PortalSignInOptions>;
};

/** O que a página de entrada mostra antes de haver sessão: os métodos — nunca emissor, cliente ou segredo. */
export const makeGetPortalSignInOptionsUseCase = (config: IPortalIdentityConfigRepository): GetPortalSignInOptionsUseCase => ({
  execute: async (tenantId) => portalSignInOptions((await config.get(tenantId)).settings),
});

export interface StartPortalSignInDeps {
  config: IPortalIdentityConfigRepository;
  requests: IPortalSignInRequestRepository;
  oidc: IOidcClient;
  now: () => Date;
  random?: () => string;
}

export type StartPortalSignInUseCase = {
  execute: (input: {
    tenantId: string;
    providerId: string;
    redirectUri: string;
    next?: string | null;
    inviteId?: string | null;
  }) => Promise<{ url: string; state: string }>;
};

/**
 * A ida ao provedor. O servidor é o cliente OIDC: gera o `state`, o `nonce` e o verificador do PKCE,
 * guarda os três (o `state` só pelo hash), e devolve ao navegador o endereço de autorização. O
 * verificador nunca sai daqui — sem ele, o `code` que voltar não vale nada para quem o interceptar.
 *
 * O `state` também volta ao navegador: é com ele que a página de volta confere que a volta é da
 * entrada que ELA começou, e não de uma que alguém plantou no navegador dela.
 */
export const makeStartPortalSignInUseCase = (deps: StartPortalSignInDeps): StartPortalSignInUseCase => ({
  execute: async ({ tenantId, providerId, redirectUri, next, inviteId }) => {
    if (!isPortalSignInRedirectUri(redirectUri)) throw invalidArgument('@core.tenant/portal.signin.redirect-invalid');
    const { settings } = await deps.config.get(tenantId);
    const provider = providerOf(settings, providerId);
    if (!provider) throw failedPrecondition('@core.tenant/portal.signin.provider-unavailable');

    let authorizationEndpoint: string;
    try {
      authorizationEndpoint = (await deps.oidc.discover(provider.issuer)).authorizationEndpoint;
    } catch (error) {
      if (error instanceof OidcFailure) throw failedPrecondition('@core.tenant/portal.signin.provider-unreachable');
      throw error;
    }

    const random = deps.random ?? (() => randomPortalToken());
    const state = random();
    const nonce = random();
    const codeVerifier = random();
    await deps.requests.save(await sha256Base64url(state), {
      tenantId,
      providerId,
      redirectUri,
      codeVerifier,
      nonce,
      next: isPortalReturnPath(next) ? next : null,
      inviteId: typeof inviteId === 'string' && inviteId.trim() ? inviteId.trim() : null,
      expiresAt: new Date(deps.now().getTime() + PORTAL_SIGN_IN_REQUEST_TTL_MS),
    });

    const url = new URL(authorizationEndpoint);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', provider.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', ['openid', ...provider.scopes].join(' '));
    url.searchParams.set('state', state);
    url.searchParams.set('nonce', nonce);
    url.searchParams.set('code_challenge', await codeChallengeFor(codeVerifier));
    url.searchParams.set('code_challenge_method', 'S256');
    return { url: url.toString(), state };
  },
});

export interface CompletePortalSignInDeps {
  config: IPortalIdentityConfigRepository;
  requests: IPortalSignInRequestRepository;
  oidc: IOidcClient;
  identity: IPortalIdentityRepository;
  accounts: IPortalIdentityAccountService;
  audit: PortalSignInAudit;
  tenantName: (tenantId: string) => Promise<string>;
  now: () => Date;
  /** O motivo técnico de uma recusa do protocolo — para o log, nunca para a pessoa. */
  log?: (message: string, detail: Record<string, unknown>) => void;
}

export type CompletePortalSignInUseCase = {
  execute: (input: { state: string; code: string }) => Promise<{ token: string; tenantId: string; next: string | null }>;
};

/** A claim exigida que este login provou, para gravar no convite, no ator e na Auditoria. */
const provenClaim = (invites: PortalIdentityInvite[]): PortalVerifiedIdentity['claim'] => {
  const first = [...invites].sort((a, b) => a.claim.name.localeCompare(b.claim.name))[0];
  return first ? { name: first.claim.name, value: first.claim.value } : null;
};

/**
 * A volta do provedor — a decisão inteira de deixar alguém entrar.
 *
 * 1. O pedido é GASTO antes de tudo: a mesma volta não vale duas vezes.
 * 2. O código é trocado com o verificador do PKCE, e o ID token conferido contra as chaves do provedor.
 * 3. Os convites são achados pelas claims que o provedor ATESTA (`provider.claims`), e cada um é
 *    conferido de novo pela normalização dele. Uma claim que vem no token mas o escritório não
 *    declarou como atestada não prova nada.
 * 4. A conta é a do escritório, do provedor e da pessoa (`portalIdentityAccountId`), e o acesso dela é
 *    sempre a soma dos convites satisfeitos AGORA — o convite revogado não volta num login seguinte.
 *
 * Toda recusa é auditada; a pessoa lê uma frase só por classe (o protocolo falhou, o convite não
 * corresponde, não há convite), sem o detalhe que ajudaria a sondar o escritório.
 */
export const makeCompletePortalSignInUseCase = (deps: CompletePortalSignInDeps): CompletePortalSignInUseCase => ({
  execute: async ({ state, code }) => {
    const request = await deps.requests.consume(await sha256Base64url(state), deps.now());
    if (!request) throw failedPrecondition('@core.tenant/portal.signin.expired');
    const { tenantId } = request;

    const { settings, secrets } = await deps.config.get(tenantId);
    const provider = providerOf(settings, request.providerId);
    if (!provider) throw failedPrecondition('@core.tenant/portal.signin.provider-unavailable');

    const refuse = async (reason: PortalSignInRefusal, entry: Partial<PortalSignInAuditEntry> = {}): Promise<never> => {
      await auditQuietly(deps.audit, {
        tenantId, outcome: 'refused', provider: provider.id, userId: '', name: '', reason, ...entry,
      });
      throw permissionDenied(reason === 'mismatch' || reason === 'not-invited'
        ? `@core.tenant/portal.signin.${reason}`
        : '@core.tenant/portal.signin.identity-failed');
    };

    let claims: Record<string, unknown>;
    try {
      const discovery = await deps.oidc.discover(provider.issuer);
      const tokens = await deps.oidc.exchangeCode({
        discovery,
        clientId: provider.clientId,
        clientSecret: secrets[provider.id] ?? null,
        code,
        redirectUri: request.redirectUri,
        codeVerifier: request.codeVerifier,
      });
      claims = await deps.oidc.verifyIdToken({
        discovery, idToken: tokens.idToken, clientId: provider.clientId, nonce: request.nonce, now: deps.now(),
      });
      if (provider.userInfo) {
        if (!tokens.accessToken) throw new OidcFailure('userinfo', 'token response has no access_token');
        const info = await deps.oidc.userInfo({ discovery, accessToken: tokens.accessToken });
        // A especificação manda descartar o `userinfo` de outra pessoa (Core, 5.3.2).
        if (info.sub !== claims.sub) throw new OidcFailure('userinfo', 'userinfo subject does not match');
        claims = { ...info, ...claims };
      }
    } catch (error) {
      if (!(error instanceof OidcFailure)) throw error;
      deps.log?.('[portal] OIDC sign-in refused', { tenantId, provider: provider.id, step: error.step, detail: error.message });
      return refuse(error.step);
    }

    const subject = claims.sub as string;
    const userId = await portalIdentityAccountId(tenantId, provider.id, subject);
    const name = nameOf(claims);
    const keys = portalLoginClaimKeys(provider, claims);
    const found = keys.length > 0 ? await deps.identity.findInvitesByClaimKeys(tenantId, keys) : [];
    const matched = found.filter((invite) => provider.claims.includes(invite.claim.name) && portalClaimMatches(invite.claim, claims));

    if (request.inviteId && !matched.some((invite) => invite.id === request.inviteId)) {
      const pointed = await deps.identity.getInvite(tenantId, request.inviteId);
      if (pointed) {
        return refuse('mismatch', { userId, name, email: pointed.email, claimName: pointed.claim.name });
      }
    }

    const tenantName = await deps.tenantName(tenantId);
    const verified: PortalVerifiedIdentity = {
      provider: provider.id,
      claim: provenClaim(matched),
      level: portalIdentityLevel(provider, claims),
    };
    const first = matched[0];
    // Sem convite satisfeito, `bind` também DESFAZ o acesso que a conta tinha: o convite que deixou
    // de valer não pode continuar aberto até alguém lembrar de revogá-lo.
    await deps.identity.bind(tenantId, {
      userId,
      tenantName,
      email: first?.email ?? '',
      displayName: name || first?.displayName || '',
      invitedBy: first?.invitedBy ?? '',
      ...(first?.locale ? { locale: first.locale } : {}),
      subject,
      verified,
    }, matched);
    if (!first) return refuse('not-invited', { userId, name });

    await deps.accounts.ensureAccount(userId, name || first.displayName || first.email);
    await auditQuietly(deps.audit, {
      tenantId, outcome: 'verified', provider: provider.id, userId, name: name || first.displayName, verified, email: first.email,
    });
    return { token: await deps.accounts.signInToken(userId), tenantId, next: request.next };
  },
});

/** A configuração como a aba a vê: o segredo nunca volta — só SE existe. */
export interface PortalSignInSettingsView extends PortalSignInSettings {
  providers: Array<PortalIdentityProvider & { hasSecret: boolean }>;
}

export interface ManagePortalSignInDeps {
  config: IPortalIdentityConfigRepository;
  identity: IPortalIdentityRepository;
  oidc: IOidcClient;
}

export type ManagePortalSignInUseCase = {
  get: (tenantId: string) => Promise<PortalSignInSettingsView>;
  /**
   * `secrets`: por provedor, o segredo novo (texto), apagar (`null`) ou manter (ausente). O segredo
   * do provedor que saiu sai junto.
   */
  save: (input: {
    tenantId: string;
    userId: string;
    settings: unknown;
    secrets: Record<string, string | null>;
  }) => Promise<PortalSignInSettingsView>;
};

const viewOf = (settings: PortalSignInSettings, secrets: Record<string, string>): PortalSignInSettingsView => ({
  ...settings,
  providers: settings.providers.map((provider) => ({ ...provider, hasSecret: !!secrets[provider.id] })),
});

const SECRET_MAX = 2048;

/**
 * Configurações › Portal › Entrada. Salvar confere a forma e ALCANÇA cada emissor — o emissor
 * digitado errado só apareceria no primeiro convidado recusado, longe de quem o digitou.
 *
 * Desligar o link de e-mail SUSPENDE quem entra por ele (e religar devolve): a regra do Firestore lê a
 * suspensão no convite, e por isso a decisão vale no instante, e não só na próxima tela que o servidor
 * monta.
 */
export const makeManagePortalSignInUseCase = (deps: ManagePortalSignInDeps): ManagePortalSignInUseCase => ({
  get: async (tenantId) => {
    const { settings, secrets } = await deps.config.get(tenantId);
    return viewOf(settings, secrets);
  },
  save: async ({ tenantId, userId, settings: raw, secrets: typed }) => {
    const settings = asPortalSignInSettings(raw);
    const issue = portalSignInSettingsIssue(settings);
    if (issue) throw invalidArgument(issue.message);

    for (const provider of settings.providers) {
      try {
        await deps.oidc.discover(provider.issuer);
      } catch (error) {
        if (error instanceof OidcFailure) throw failedPrecondition('@core.tenant/portal.identity.issuer-unreachable');
        throw error;
      }
    }

    const current = await deps.config.get(tenantId);
    const secrets: Record<string, string> = {};
    for (const provider of settings.providers) {
      const change = typed[provider.id];
      if (typeof change === 'string' && change.trim() !== '') secrets[provider.id] = change.trim().slice(0, SECRET_MAX);
      else if (change === undefined && current.secrets[provider.id]) secrets[provider.id] = current.secrets[provider.id];
    }
    await deps.config.save(tenantId, { settings, secrets }, userId);
    if (settings.emailLink !== current.settings.emailLink) {
      await deps.identity.setEmailGuestsSuspended(tenantId, !settings.emailLink);
    }
    return viewOf(settings, secrets);
  },
});
