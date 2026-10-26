import { describe, expect, it } from 'vitest';
import { EMPTY_PORTAL_FORM, fromPortalForm, toPortalForm } from './screenPortalForm';

describe('convite por automação na aba Portal', () => {
  it('ida e volta na tela-sujeito', () => {
    const portal = { subject: 'self' as const, fields: ['name'], documents: false, invites: { automation: true } };
    const form = toPortalForm(portal);
    expect(form.automationInvites).toBe(true);
    expect(fromPortalForm(form)).toEqual(portal);
  });

  it('desligado, a chave nem é gravada — a declaração antiga volta igual', () => {
    const portal = { subject: 'self' as const, fields: ['name'], documents: false };
    expect(fromPortalForm(toPortalForm(portal))).toEqual(portal);
  });

  it('fora da tela-sujeito não é gravado: o servidor nunca aceitaria o convite', () => {
    const form = { ...EMPTY_PORTAL_FORM, enabled: true, subjectKind: 'parent' as const, fields: ['a'], automationInvites: true };
    expect(fromPortalForm(form)).not.toHaveProperty('invites');
  });
});
