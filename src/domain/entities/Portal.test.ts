import { describe, expect, it } from 'vitest';
import { fillPortalWelcome, portalWelcomeValues } from './Portal';
import { asPortalProfile } from '../schema/portal';

const base = { accountName: '', email: 'ana@exemplo.com', office: 'Souza Advogados' };

describe('portalWelcomeValues', () => {
  it('usa o nome do perfil antes do nome da conta', () => {
    const values = portalWelcomeValues({ ...base, profile: { name: 'Ana Souza' }, accountName: 'Conta' });
    expect(values).toMatchObject({ firstName: 'Ana', name: 'Ana Souza', 'profile.name': 'Ana Souza' });
  });

  it('cai no nome da conta e, sem ele, no e-mail', () => {
    expect(portalWelcomeValues({ ...base, profile: {}, accountName: 'Bia Lima' }).firstName).toBe('Bia');
    expect(portalWelcomeValues({ ...base, profile: {} })).toMatchObject({ firstName: 'ana@exemplo.com', name: 'ana@exemplo.com', 'profile.name': '' });
  });
});

describe('fillPortalWelcome', () => {
  const values = portalWelcomeValues({ ...base, profile: { name: 'Ana Souza' } });

  it('preenche os marcadores conhecidos, inclusive os do perfil', () => {
    expect(fillPortalWelcome('Olá, {firstName}! {profile.name} no portal de {office}.', values))
      .toBe('Olá, Ana! Ana Souza no portal de Souza Advogados.');
  });

  it('mantém intacto o marcador desconhecido', () => {
    expect(fillPortalWelcome('Olá, {guest} — {email}', values)).toBe('Olá, {guest} — ana@exemplo.com');
  });

  it('não trata propriedade herdada como marcador', () => {
    expect(fillPortalWelcome('{constructor}', values)).toBe('{constructor}');
  });
});

describe('asPortalProfile', () => {
  it('guarda só as chaves conhecidas, aparadas e dentro do limite', () => {
    expect(asPortalProfile({ name: '  Ana  ', cpf: '123', extra: 1 })).toEqual({ name: 'Ana' });
    expect(asPortalProfile({ name: 'x'.repeat(200) }).name).toHaveLength(120);
    expect(asPortalProfile({ name: '   ' })).toEqual({});
    expect(asPortalProfile(null)).toEqual({});
  });
});
