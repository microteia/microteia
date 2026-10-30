import { describe, expect, it } from 'vitest';
import { fillPortalWelcome, portalWelcomeValues } from './Portal';

const base = { accountName: '', email: 'ana@exemplo.com', office: 'Souza Advogados' };

describe('portalWelcomeValues', () => {
  it('usa o nome da conta', () => {
    expect(portalWelcomeValues({ ...base, accountName: 'Bia Lima' })).toMatchObject({ firstName: 'Bia', name: 'Bia Lima' });
  });

  it('sem nome na conta, cai no e-mail', () => {
    expect(portalWelcomeValues(base)).toMatchObject({ firstName: 'ana@exemplo.com', name: 'ana@exemplo.com' });
  });
});

describe('fillPortalWelcome', () => {
  const values = portalWelcomeValues({ ...base, accountName: 'Ana Souza' });

  it('preenche os marcadores conhecidos', () => {
    expect(fillPortalWelcome('Olá, {firstName}! {name} no portal de {office}.', values))
      .toBe('Olá, Ana! Ana Souza no portal de Souza Advogados.');
  });

  it('mantém intacto o marcador desconhecido', () => {
    expect(fillPortalWelcome('Olá, {guest} — {email}', values)).toBe('Olá, {guest} — ana@exemplo.com');
  });

  it('não trata propriedade herdada como marcador', () => {
    expect(fillPortalWelcome('{constructor}', values)).toBe('{constructor}');
  });
});
