// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/portalIdentity.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Entrar no portal com IDENTIDADE VERIFICADA — o contrato que o navegador e o servidor dividem.
 *
 * O link de e-mail prova só que a pessoa lê aquela caixa de correio. Quando o ato do convidado produz
 * efeito (uma ciência, um aceite), o escritório precisa saber QUEM o praticou: um provedor de
 * identidade (OIDC) configurado pelo próprio escritório atesta atributos da pessoa — as claims —, e o
 * convite pode exigir que um deles coincida (`requiredClaim`).
 *
 * O kernel não conhece provedor nenhum pelo nome, nem o que uma claim significa: o escritório diz o
 * emissor, o cliente, os escopos e QUAIS claims aquele provedor atesta; o convite diz qual delas exige.
 *
 * Módulo-FOLHA, sem import: a página de entrada o lê antes de haver sessão, e o bootstrap do usuário
 * também — nenhum dos dois precisa do motor de expressões que `portal.ts` arrasta.
 */

/** Como o valor de uma claim é comparado: só os dígitos, sem caixa, ou exatamente (depois de aparar). */
export type PortalClaimNormalize = 'digits' | 'lowercase';

export const PORTAL_CLAIM_NORMALIZERS: readonly PortalClaimNormalize[] = ['digits', 'lowercase'];

/** O atributo que o convite exige de quem o aceita. `value` é gravado já normalizado. */
export interface PortalRequiredClaim {
  name: string;
  value: string;
  normalize?: PortalClaimNormalize;
}

/** Um provedor OIDC do portal de um escritório. O segredo do cliente nunca está aqui: mora só no servidor. */
export interface PortalIdentityProvider {
  /** Identificador estável — é ele que distingue a conta de quem entra, e por isso não muda. */
  id: string;
  /** O nome do botão, como o escritório o escreveu. Dado do escritório: não passa pelo catálogo. */
  label: string;
  /** O emissor (`iss`); a descoberta é lida em `<issuer>/.well-known/openid-configuration`. */
  issuer: string;
  clientId: string;
  /** Pedidos além de `openid`, que vai sempre. */
  scopes: string[];
  /** As claims que este provedor ATESTA — as únicas que um convite pode exigir dele. */
  claims: string[];
  /** A claim que diz o nível de confiabilidade da conta no provedor (`acr`, `amr`…). */
  levelClaim?: string;
  /** Completar as claims do ID token com as do `userinfo` (o provedor que só as entrega lá). */
  userInfo?: boolean;
}

/** Os métodos de entrada que o escritório aceita no portal. */
export interface PortalSignInSettings {
  /** O link de e-mail. Desligado, só entra quem prova a identidade por um provedor. */
  emailLink: boolean;
  providers: PortalIdentityProvider[];
}

/** O que o convidado provou, como o ator, a Auditoria e o registro o carregam. */
export interface PortalVerifiedIdentity {
  provider: string;
  /** A claim exigida pelo convite e atestada pelo provedor; `null` quando o convite não exigia nenhuma. */
  claim: { name: string; value: string } | null;
  /** O nível de confiabilidade informado pelo provedor, como ele o escreveu; `null` quando não informou. */
  level: string | null;
}

/**
 * O kernel a partir do qual `portal-invite` entende `requiredClaim*`. Um kernel anterior IGNORA a
 * entrada e convida pelo e-mail — falha ABERTO: a pessoa entraria sem provar nada. Por isso o pacote
 * que a usa é recusado no empacotamento sem o `kernel` a partir daqui.
 */
export const PORTAL_IDENTITY_CLAIM_SINCE_KERNEL = '2.74.0';

export const PORTAL_IDENTITY_PROVIDERS_MAX = 5;
export const PORTAL_CLAIM_VALUE_MAX = 256;

/**
 * O documento do servidor que guarda a configuração e os segredos dos clientes OIDC:
 * `tenants/{t}/secrets/portal-identity`. `secrets` é reservada e nenhuma regra a libera.
 */
export const PORTAL_IDENTITY_SECRET_ID = 'portal-identity';

/**
 * O prefixo do uid das contas abertas por um provedor do portal. Só o servidor cria conta com uid
 * escolhido, e por isso o prefixo é prova: o bootstrap não abre escritório para ela, e o navegador
 * não lhe pede o e-mail confirmado que ela não tem.
 */
export const PORTAL_IDENTITY_ACCOUNT_PREFIX = 'portal-id-';

export const isPortalIdentityAccount = (userId: string | null | undefined): boolean =>
  typeof userId === 'string' && userId.startsWith(PORTAL_IDENTITY_ACCOUNT_PREFIX);

/** Para onde o provedor devolve quem entrou. O endereço precisa estar registrado no cliente OIDC. */
export const PORTAL_SIGN_IN_CALLBACK_PATH = '/portal/signin/callback';

/**
 * Se o endereço pode ser o destino depois do acesso: só um caminho DENTRO do portal, e nunca a
 * própria página de acesso. Um destino livre faria do link de acesso um redirecionamento aberto.
 */
export const isPortalReturnPath = (value: string | null | undefined): value is string =>
  typeof value === 'string'
  && value.startsWith('/portal/')
  && !value.startsWith('//')
  && !value.includes('\\')
  && !value.startsWith('/portal/signin');

/** O endereço de volta é o do próprio portal, em HTTPS — ou numa máquina local, para desenvolvimento. */
export const isPortalSignInRedirectUri = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  return (url.protocol === 'https:' || (url.protocol === 'http:' && local))
    && url.pathname === PORTAL_SIGN_IN_CALLBACK_PATH
    && url.search === ''
    && url.hash === ''
    && url.username === ''
    && url.password === '';
};

const PROVIDER_ID_PATTERN = /^[a-z][a-z0-9-]{1,31}$/;
const CLAIM_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_.:-]{0,63}$/;
const SCOPE_PATTERN = /^[\x21\x23-\x5B\x5D-\x7E]{1,100}$/;
const LABEL_MAX = 60;

export const isPortalClaimName = (value: unknown): value is string =>
  typeof value === 'string' && CLAIM_NAME_PATTERN.test(value);

export const normalizePortalClaimValue = (value: string, normalize?: PortalClaimNormalize): string => {
  const trimmed = value.trim();
  if (normalize === 'digits') return trimmed.replace(/\D+/g, '');
  if (normalize === 'lowercase') return trimmed.toLowerCase();
  return trimmed;
};

/** A chave por que o convite é achado a partir de um login: o nome e o valor já normalizado. */
export const portalClaimKey = (name: string, normalizedValue: string): string => `${name}=${normalizedValue}`;

/**
 * A claim exigida, conferida e normalizada — ou o motivo da recusa. O valor vazio depois da
 * normalização é recusado: exigir "nada" deixaria entrar quem o provedor não atestou coisa nenhuma.
 */
export const asPortalRequiredClaim = (
  raw: unknown,
): { claim: PortalRequiredClaim } | { issue: string } => {
  if (typeof raw !== 'object' || raw === null) return { issue: '@core.tenant/portal.claim.invalid' };
  const data = raw as Record<string, unknown>;
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  if (!isPortalClaimName(name)) return { issue: '@core.tenant/portal.claim.name-invalid' };
  const normalize = data.normalize === undefined || data.normalize === null || data.normalize === ''
    ? undefined
    : data.normalize;
  if (normalize !== undefined && !PORTAL_CLAIM_NORMALIZERS.includes(normalize as PortalClaimNormalize)) {
    return { issue: '@core.tenant/portal.claim.normalize-invalid' };
  }
  const rawValue = typeof data.value === 'number' ? String(data.value) : data.value;
  if (typeof rawValue !== 'string') return { issue: '@core.tenant/portal.claim.value-missing' };
  const value = normalizePortalClaimValue(rawValue, normalize as PortalClaimNormalize | undefined);
  if (!value) return { issue: '@core.tenant/portal.claim.value-missing' };
  if (value.length > PORTAL_CLAIM_VALUE_MAX) return { issue: '@core.tenant/portal.claim.value-invalid' };
  return { claim: { name, value, ...(normalize ? { normalize: normalize as PortalClaimNormalize } : {}) } };
};

/**
 * As claims-padrão do OIDC que só valem com a marca de verificação ao lado (Core, 5.1): um e-mail ou
 * um telefone que o provedor apenas RECEBEU da pessoa não é atributo atestado.
 */
const VERIFICATION_FLAGS: Readonly<Record<string, string>> = {
  email: 'email_verified',
  phone_number: 'phone_number_verified',
};

/** O valor de uma claim como texto comparável: texto ou número; o resto não é atributo, é estrutura. */
export const portalClaimText = (claims: Readonly<Record<string, unknown>>, name: string): string | null => {
  const flag = VERIFICATION_FLAGS[name];
  if (flag && claims[flag] !== true) return null;
  const value = claims[name];
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
};

/** A claim do login satisfaz a exigida? Sempre pela normalização DO CONVITE. */
export const portalClaimMatches = (
  required: PortalRequiredClaim,
  claims: Readonly<Record<string, unknown>>,
): boolean => {
  const text = portalClaimText(claims, required.name);
  if (text === null) return false;
  const value = normalizePortalClaimValue(text, required.normalize);
  return value !== '' && value === required.value;
};

/**
 * As chaves de convite que um login pode satisfazer: cada claim que o provedor atesta, em cada forma
 * de comparar. É por elas que o servidor acha os convites sem varrer o escritório — e só pelas claims
 * declaradas: uma claim que o provedor não atesta não vale como prova, ainda que venha no token.
 */
export const portalLoginClaimKeys = (
  provider: Pick<PortalIdentityProvider, 'claims'>,
  claims: Readonly<Record<string, unknown>>,
): string[] => {
  const keys = new Set<string>();
  for (const name of provider.claims) {
    const text = portalClaimText(claims, name);
    if (text === null) continue;
    for (const normalize of [undefined, ...PORTAL_CLAIM_NORMALIZERS]) {
      const value = normalizePortalClaimValue(text, normalize);
      if (value && value.length <= PORTAL_CLAIM_VALUE_MAX) keys.add(portalClaimKey(name, value));
    }
  }
  return [...keys].sort();
};

/** O nível de confiabilidade, como o provedor o escreveu: lista vira texto, ausência vira `null`. */
export const portalIdentityLevel = (
  provider: Pick<PortalIdentityProvider, 'levelClaim'>,
  claims: Readonly<Record<string, unknown>>,
): string | null => {
  if (!provider.levelClaim) return null;
  const value = claims[provider.levelClaim];
  if (Array.isArray(value)) {
    const parts = value.filter((part): part is string | number => typeof part === 'string' || typeof part === 'number');
    return parts.length > 0 ? parts.map(String).join(' ') : null;
  }
  return portalClaimText(claims, provider.levelClaim);
};

const stringsOf = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean) : [];

const textOf = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** O emissor sem a barra final — a forma em que ele é comparado ao `iss` do token. */
export const normalizePortalIssuer = (issuer: string): string => issuer.trim().replace(/\/+$/, '');

const asProvider = (raw: unknown): PortalIdentityProvider | null => {
  if (typeof raw !== 'object' || raw === null) return null;
  const data = raw as Record<string, unknown>;
  const levelClaim = textOf(data.levelClaim);
  return {
    id: textOf(data.id),
    label: textOf(data.label),
    issuer: normalizePortalIssuer(textOf(data.issuer)),
    clientId: textOf(data.clientId),
    scopes: [...new Set(stringsOf(data.scopes).filter((scope) => scope !== 'openid'))],
    claims: [...new Set(stringsOf(data.claims))],
    ...(levelClaim ? { levelClaim } : {}),
    ...(data.userInfo === true ? { userInfo: true } : {}),
  };
};

/** Lê a configuração gravada. Ausente, só o link de e-mail — o portal como sempre foi. */
export const asPortalSignInSettings = (raw: unknown): PortalSignInSettings => {
  const data = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const providers = Array.isArray(data.providers)
    ? data.providers.map(asProvider).filter((provider): provider is PortalIdentityProvider => provider !== null)
    : [];
  return { emailLink: data.emailLink !== false, providers };
};

const isIssuerUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    return (url.protocol === 'https:' || (url.protocol === 'http:' && local)) && url.search === '' && url.hash === '';
  } catch {
    return false;
  }
};

/**
 * A primeira coisa errada na configuração, ou `null`. Desligar o link de e-mail sem provedor nenhum é
 * recusado: o portal ficaria sem porta de entrada, e o escritório só o descobriria pelo convidado.
 */
export const portalSignInSettingsIssue = (
  settings: PortalSignInSettings,
): { message: string; params?: Record<string, string> } | null => {
  if (settings.providers.length > PORTAL_IDENTITY_PROVIDERS_MAX) {
    return { message: '@core.tenant/portal.identity.too-many', params: { max: String(PORTAL_IDENTITY_PROVIDERS_MAX) } };
  }
  if (!settings.emailLink && settings.providers.length === 0) return { message: '@core.tenant/portal.identity.no-method' };
  const ids = new Set<string>();
  for (const provider of settings.providers) {
    const params = { provider: provider.label || provider.id };
    if (!PROVIDER_ID_PATTERN.test(provider.id)) return { message: '@core.tenant/portal.identity.id-invalid', params };
    if (ids.has(provider.id)) return { message: '@core.tenant/portal.identity.id-duplicate', params };
    ids.add(provider.id);
    if (!provider.label || provider.label.length > LABEL_MAX) return { message: '@core.tenant/portal.identity.label-invalid', params };
    if (!isIssuerUrl(provider.issuer)) return { message: '@core.tenant/portal.identity.issuer-invalid', params };
    if (!provider.clientId) return { message: '@core.tenant/portal.identity.client-missing', params };
    if (provider.scopes.some((scope) => !SCOPE_PATTERN.test(scope))) return { message: '@core.tenant/portal.identity.scope-invalid', params };
    if (provider.claims.some((claim) => !isPortalClaimName(claim))) return { message: '@core.tenant/portal.identity.claim-invalid', params };
    if (provider.levelClaim && !isPortalClaimName(provider.levelClaim)) {
      return { message: '@core.tenant/portal.identity.claim-invalid', params };
    }
  }
  return null;
};

/** As claims que algum provedor atesta — as que um convite deste escritório pode exigir. */
export const portalAttestedClaims = (settings: PortalSignInSettings): string[] =>
  [...new Set(settings.providers.flatMap((provider) => provider.claims))].sort();

/** O que a página de entrada do portal precisa saber antes de haver sessão: os métodos, e mais nada. */
export interface PortalSignInOptions {
  emailLink: boolean;
  providers: Array<{ id: string; label: string }>;
}

export const portalSignInOptions = (settings: PortalSignInSettings): PortalSignInOptions => ({
  emailLink: settings.emailLink,
  providers: settings.providers.map((provider) => ({ id: provider.id, label: provider.label })),
});

/** A identidade verificada gravada no convite do convidado, lida de volta com tolerância. */
export const asPortalVerifiedIdentity = (raw: unknown): PortalVerifiedIdentity | null => {
  if (typeof raw !== 'object' || raw === null) return null;
  const data = raw as Record<string, unknown>;
  const provider = textOf(data.provider);
  if (!provider) return null;
  const claim = typeof data.claim === 'object' && data.claim !== null
    ? (data.claim as Record<string, unknown>)
    : null;
  const claimName = claim ? textOf(claim.name) : '';
  const claimValue = claim ? textOf(claim.value) : '';
  return {
    provider,
    claim: claimName && claimValue ? { name: claimName, value: claimValue } : null,
    level: textOf(data.level) || null,
  };
};

/**
 * O campo do REGISTRO com a identidade de quem o gravou pelo portal pela última vez — a prova que uma
 * automação, um relatório ou um modelo de documento leem. Campo do sistema: nenhuma escrita o forja.
 */
export const RECORD_PORTAL_VERIFIED_FIELD = 'portalVerified';
