import { describe, expect, it } from 'vitest';
import {
  isValidPortalRole,
  mergePortalSubjectRoles,
  portalGuestActor,
  portalRolesOn,
  readPortalRoleInput,
  readPortalSubjectRoles,
  withPortalSubjectRole,
  withoutPortalSubjectRoles,
} from './portalRole';

describe('o papel é chave, não rótulo', () => {
  it('aceita minúsculas, dígitos e _ . -, até 40', () => {
    expect(['socio', 'contador-2', 'sindico.sub', 'a_b', 'x'.repeat(40)].every(isValidPortalRole)).toBe(true);
    expect(['Sócio', 'socio adm', '-socio', '', 'x'.repeat(41)].some(isValidPortalRole)).toBe(false);
  });

  it('o pedido ausente ou vazio não mexe no papel; o inválido é recusa, nunca um convite sem papel', () => {
    expect(readPortalRoleInput(undefined)).toBeNull();
    expect(readPortalRoleInput(null)).toBeNull();
    expect(readPortalRoleInput('  ')).toBeNull();
    expect(readPortalRoleInput(' socio ')).toBe('socio');
    expect(readPortalRoleInput('Sócio')).toBe(false);
    expect(readPortalRoleInput(1)).toBe(false);
  });
});

describe('os papéis do convite', () => {
  it('lidos com desconfiança: o malformado e o repetido somem', () => {
    expect(readPortalSubjectRoles([
      { subjectKey: 'companies/acme', role: 'socio' },
      { subjectKey: 'companies/acme', role: 'socio' },
      { subjectKey: 'companies/beta', role: 'Sócio' },
      { subjectKey: '', role: 'socio' },
      'socio',
    ])).toEqual([{ subjectKey: 'companies/acme', role: 'socio' }]);
    expect(readPortalSubjectRoles(undefined)).toEqual([]);
  });

  it('um papel por sujeito no convite: trocar substitui, revogar leva junto', () => {
    const roles = withPortalSubjectRole([{ subjectKey: 'companies/acme', role: 'socio' }], 'companies/acme', 'contador');
    expect(roles).toEqual([{ subjectKey: 'companies/acme', role: 'contador' }]);
    expect(withoutPortalSubjectRoles([...roles, { subjectKey: 'companies/beta', role: 'socio' }], 'companies/acme'))
      .toEqual([{ subjectKey: 'companies/beta', role: 'socio' }]);
    expect(withoutPortalSubjectRoles(roles, null)).toEqual([]);
  });

  it('a soma dos convites por identidade fica só com os sujeitos que a conta recebe, em ordem', () => {
    expect(mergePortalSubjectRoles([
      [{ subjectKey: 'companies/beta', role: 'socio' }, { subjectKey: 'companies/gone', role: 'socio' }],
      [{ subjectKey: 'companies/acme', role: 'contador' }, { subjectKey: 'companies/beta', role: 'socio' }],
    ], ['companies/acme', 'companies/beta'])).toEqual([
      { subjectKey: 'companies/acme', role: 'contador' },
      { subjectKey: 'companies/beta', role: 'socio' },
    ]);
  });
});

describe('os papéis do convidado NUM registro', () => {
  const guest = {
    userId: 'ana',
    subjectKeys: ['companies/acme', 'companies/beta'],
    subjectRoles: [
      { subjectKey: 'companies/acme', role: 'socio' },
      { subjectKey: 'companies/beta', role: 'contador' },
      { subjectKey: 'companies/revoked', role: 'socio' },
    ],
  };

  it('são os dos sujeitos do registro que estão no convite', () => {
    expect(portalRolesOn(guest, ['companies/acme'])).toEqual(['socio']);
    expect(portalRolesOn(guest, ['companies/acme', 'companies/beta'])).toEqual(['contador', 'socio']);
    expect(portalRolesOn(guest, ['companies/revoked'])).toEqual([]);
    expect(portalRolesOn({ subjectKeys: ['companies/acme'] }, ['companies/acme'])).toEqual([]);
  });

  it('o ator das condições: quem é, o que provou e os papéis — sem permissão nenhuma', () => {
    expect(portalGuestActor(guest, ['companies/beta'])).toEqual({ id: 'ana', via: 'portal', verified: null, portalRoles: ['contador'] });
  });
});
