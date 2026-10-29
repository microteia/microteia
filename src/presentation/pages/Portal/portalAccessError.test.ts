import { describe, expect, it } from 'vitest';
import { portalAccessError, portalOffersSignInAgain, type PortalAccessState } from './portalAccessError';

const IDENTITY = 'portal-id-abc';
const EMAIL = 'uid-ana';

const state = (patch: Partial<PortalAccessState> = {}): PortalAccessState => ({
  userId: EMAIL,
  membershipsLoading: false,
  membershipsFailed: false,
  membershipCount: 1,
  contextError: null,
  ...patch,
});

describe('por que a casca não mostra o portal', () => {
  it('a conta do link de e-mail sem acesso continua sendo mandada ao link do convite', () => {
    expect(portalAccessError(state({ membershipCount: 0 }))).toBe('no-access');
    expect(portalOffersSignInAgain('no-access', EMAIL)).toBe(false);
  });

  it('a conta aberta por um provedor sem acesso é mandada a entrar de novo por ele — ela não tem link de e-mail', () => {
    expect(portalAccessError(state({ userId: IDENTITY, membershipCount: 0 }))).toBe('no-access-identity');
    expect(portalOffersSignInAgain('no-access-identity', IDENTITY)).toBe(true);
  });

  it('o convite revogado oferece entrar de novo só à conta de um provedor', () => {
    expect(portalAccessError(state({ userId: IDENTITY, contextError: 'not-invited' }))).toBe('not-invited');
    expect(portalOffersSignInAgain('not-invited', IDENTITY)).toBe(true);
    expect(portalOffersSignInAgain('not-invited', EMAIL)).toBe(false);
    expect(portalOffersSignInAgain('identity-required', EMAIL)).toBe(true);
  });

  it('a falha de leitura vem antes da falta de acesso, e nada é dito enquanto carrega', () => {
    expect(portalAccessError(state({ membershipsFailed: true, membershipCount: 0 }))).toBe('load-failed');
    expect(portalAccessError(state({ membershipsLoading: true, membershipCount: 0 }))).toBeNull();
    expect(portalAccessError(state({ contextError: 'failed' }))).toBe('context-failed');
    expect(portalAccessError(state())).toBeNull();
  });
});
