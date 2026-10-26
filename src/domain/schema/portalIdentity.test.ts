import { describe, expect, it } from 'vitest';
import {
  PORTAL_SIGN_IN_CALLBACK_PATH,
  asPortalRequiredClaim,
  asPortalSignInSettings,
  isPortalIdentityAccount,
  isPortalReturnPath,
  isPortalSignInRedirectUri,
  normalizePortalClaimValue,
  portalAttestedClaims,
  portalClaimMatches,
  portalIdentityLevel,
  portalLoginClaimKeys,
  portalSignInOptions,
  portalSignInSettingsIssue,
  type PortalIdentityProvider,
} from './portalIdentity';
import { PORTAL_BASE_PATH } from './portal';

const PROVIDER: PortalIdentityProvider = {
  id: 'citizen',
  label: 'Citizen ID',
  issuer: 'https://id.example.test',
  clientId: 'portal',
  scopes: ['profile'],
  claims: ['nationalId', 'email'],
};

describe('a claim exigida', () => {
  it('normaliza: só os dígitos, sem caixa, ou exatamente — sempre aparando', () => {
    expect(normalizePortalClaimValue(' 123.456.789-00 ', 'digits')).toBe('12345678900');
    expect(normalizePortalClaimValue(' Bia@Acme.COM ', 'lowercase')).toBe('bia@acme.com');
    expect(normalizePortalClaimValue(' AbC ')).toBe('AbC');
  });

  it('grava o valor já normalizado, e recusa o que não serve', () => {
    expect(asPortalRequiredClaim({ name: 'nationalId', value: '123.456.789-00', normalize: 'digits' }))
      .toEqual({ claim: { name: 'nationalId', value: '12345678900', normalize: 'digits' } });
    expect(asPortalRequiredClaim({ name: 'nationalId', value: 12345 })).toEqual({ claim: { name: 'nationalId', value: '12345' } });
    expect(asPortalRequiredClaim({ name: '1x', value: 'a' })).toEqual({ issue: '@core.tenant/portal.claim.name-invalid' });
    expect(asPortalRequiredClaim({ name: 'nationalId', value: '...', normalize: 'digits' }))
      .toEqual({ issue: '@core.tenant/portal.claim.value-missing' });
    expect(asPortalRequiredClaim({ name: 'nationalId', value: 'a', normalize: 'upper' }))
      .toEqual({ issue: '@core.tenant/portal.claim.normalize-invalid' });
    expect(asPortalRequiredClaim('nationalId')).toEqual({ issue: '@core.tenant/portal.claim.invalid' });
  });

  it('confere a claim do login pela normalização DO CONVITE', () => {
    const required = { name: 'nationalId', value: '12345678900', normalize: 'digits' as const };
    expect(portalClaimMatches(required, { nationalId: '123.456.789-00' })).toBe(true);
    expect(portalClaimMatches(required, { nationalId: '123.456.789-01' })).toBe(false);
    expect(portalClaimMatches(required, { nationalId: { value: '12345678900' } })).toBe(false);
    expect(portalClaimMatches(required, {})).toBe(false);
  });

  it('e-mail e telefone só valem como atributo com a marca de verificação do provedor', () => {
    const required = { name: 'email', value: 'bia@acme.com', normalize: 'lowercase' as const };
    expect(portalClaimMatches(required, { email: 'Bia@Acme.com', email_verified: true })).toBe(true);
    expect(portalClaimMatches(required, { email: 'Bia@Acme.com', email_verified: false })).toBe(false);
    expect(portalClaimMatches(required, { email: 'Bia@Acme.com' })).toBe(false);
  });

  it('as chaves de um login: só das claims que o provedor ATESTA, em cada forma de comparar', () => {
    const keys = portalLoginClaimKeys(PROVIDER, { nationalId: '123.456.789-00', taxId: '999', email: 'X@Y.com' });
    expect(keys).toContain('nationalId=12345678900');
    expect(keys).toContain('nationalId=123.456.789-00');
    expect(keys.some((key) => key.startsWith('taxId='))).toBe(false);
    expect(keys.some((key) => key.startsWith('email='))).toBe(false);
  });
});

describe('o nível de confiabilidade', () => {
  it('é a claim apontada, como o provedor a escreveu; lista vira texto; ausência é null', () => {
    expect(portalIdentityLevel({ levelClaim: 'acr' }, { acr: 'gold' })).toBe('gold');
    expect(portalIdentityLevel({ levelClaim: 'amr' }, { amr: ['pwd', 'otp'] })).toBe('pwd otp');
    expect(portalIdentityLevel({ levelClaim: 'acr' }, {})).toBeNull();
    expect(portalIdentityLevel({}, { acr: 'gold' })).toBeNull();
  });
});

describe('a configuração de entrada', () => {
  it('ausente, é o portal como sempre foi: só o link de e-mail', () => {
    expect(asPortalSignInSettings(undefined)).toEqual({ emailLink: true, providers: [] });
  });

  it('lê com tolerância: emissor sem barra final, `openid` implícito, listas sem repetição', () => {
    const settings = asPortalSignInSettings({
      emailLink: false,
      providers: [{ ...PROVIDER, issuer: 'https://id.example.test/', scopes: ['openid', 'profile', 'profile'], claims: ['a', 'a'] }],
    });
    expect(settings.emailLink).toBe(false);
    expect(settings.providers[0]).toMatchObject({ issuer: 'https://id.example.test', scopes: ['profile'], claims: ['a'] });
  });

  it('recusa o portal sem porta de entrada e o provedor mal formado', () => {
    expect(portalSignInSettingsIssue({ emailLink: false, providers: [] })?.message).toBe('@core.tenant/portal.identity.no-method');
    expect(portalSignInSettingsIssue({ emailLink: true, providers: [PROVIDER] })).toBeNull();
    expect(portalSignInSettingsIssue({ emailLink: true, providers: [{ ...PROVIDER, id: 'Gov BR' }] })?.message)
      .toBe('@core.tenant/portal.identity.id-invalid');
    expect(portalSignInSettingsIssue({ emailLink: true, providers: [PROVIDER, PROVIDER] })?.message)
      .toBe('@core.tenant/portal.identity.id-duplicate');
    expect(portalSignInSettingsIssue({ emailLink: true, providers: [{ ...PROVIDER, issuer: 'http://id.example.test' }] })?.message)
      .toBe('@core.tenant/portal.identity.issuer-invalid');
    expect(portalSignInSettingsIssue({ emailLink: true, providers: [{ ...PROVIDER, clientId: '' }] })?.message)
      .toBe('@core.tenant/portal.identity.client-missing');
  });

  it('a página de entrada recebe os botões — nunca emissor, cliente ou claims', () => {
    expect(portalSignInOptions({ emailLink: true, providers: [PROVIDER] }))
      .toEqual({ emailLink: true, providers: [{ id: 'citizen', label: 'Citizen ID' }] });
    expect(portalAttestedClaims({ emailLink: true, providers: [PROVIDER, { ...PROVIDER, id: 'x', claims: ['email', 'taxId'] }] }))
      .toEqual(['email', 'nationalId', 'taxId']);
  });
});

describe('os endereços', () => {
  it('a volta do provedor é a página do portal, em HTTPS (ou na máquina local)', () => {
    expect(PORTAL_SIGN_IN_CALLBACK_PATH.startsWith(`${PORTAL_BASE_PATH}/`)).toBe(true);
    expect(isPortalSignInRedirectUri(`https://office.example${PORTAL_SIGN_IN_CALLBACK_PATH}`)).toBe(true);
    expect(isPortalSignInRedirectUri(`http://localhost:5173${PORTAL_SIGN_IN_CALLBACK_PATH}`)).toBe(true);
    expect(isPortalSignInRedirectUri(`http://office.example${PORTAL_SIGN_IN_CALLBACK_PATH}`)).toBe(false);
    expect(isPortalSignInRedirectUri('https://office.example/elsewhere')).toBe(false);
    expect(isPortalSignInRedirectUri(`https://office.example${PORTAL_SIGN_IN_CALLBACK_PATH}?x=1`)).toBe(false);
    expect(isPortalSignInRedirectUri(`https://user:pw@office.example${PORTAL_SIGN_IN_CALLBACK_PATH}`)).toBe(false);
  });

  it('o destino depois de entrar é só um caminho do portal — nunca um redirecionamento aberto', () => {
    expect(isPortalReturnPath('/portal/salvador/companies?record=1')).toBe(true);
    for (const path of ['https://evil.example', '//evil.example', '/portal/signin', '/portal/signin/callback', '/admin', '/portal\\x']) {
      expect(isPortalReturnPath(path)).toBe(false);
    }
  });

  it('a conta aberta por um provedor é reconhecida pelo prefixo que só o servidor escolhe', () => {
    expect(isPortalIdentityAccount('portal-id-abc')).toBe(true);
    expect(isPortalIdentityAccount('Xy12abc')).toBe(false);
    expect(isPortalIdentityAccount(null)).toBe(false);
  });
});
