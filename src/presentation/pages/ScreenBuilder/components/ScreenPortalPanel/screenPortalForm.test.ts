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

describe('link curto de documento na aba Portal', () => {
  it('ida e volta com a validade declarada', () => {
    const portal = { subject: 'self' as const, fields: ['name'], documents: true, documentLinks: { expiresInMinutes: 5 } };
    const form = toPortalForm(portal);
    expect(form.documentLinks).toBe(true);
    expect(form.documentLinkMinutes).toBe('5');
    expect(fromPortalForm(form)).toEqual(portal);
  });

  it('desligado, a chave nem é gravada', () => {
    const form = { ...EMPTY_PORTAL_FORM, enabled: true, fields: ['a'], documentLinkMinutes: '30' };
    expect(fromPortalForm(form)).not.toHaveProperty('documentLinks');
  });

  it('o que não é número cai na validade padrão — nunca desliga o link curto', () => {
    const form = { ...EMPTY_PORTAL_FORM, enabled: true, fields: ['a'], documentLinks: true, documentLinkMinutes: 'abc' };
    expect(fromPortalForm(form)?.documentLinks).toEqual({ expiresInMinutes: 10 });
  });

  it('o fora do intervalo é gravado como digitado, para o aviso dizer o que corrigir', () => {
    const form = { ...EMPTY_PORTAL_FORM, enabled: true, fields: ['a'], documentLinks: true, documentLinkMinutes: '90' };
    expect(fromPortalForm(form)?.documentLinks).toEqual({ expiresInMinutes: 90 });
  });
});

describe('registro de aberturas na aba Portal', () => {
  it('ida e volta', () => {
    const portal = { subject: 'self' as const, fields: ['name'], documents: false, trackViews: true };
    const form = toPortalForm(portal);
    expect(form.trackViews).toBe(true);
    expect(fromPortalForm(form)).toEqual(portal);
  });

  it('desligado, a chave nem é gravada — a declaração de quem não usa o recurso fica como estava', () => {
    const portal = { subject: 'self' as const, fields: ['name'], documents: false };
    expect(toPortalForm(portal).trackViews).toBe(false);
    expect(fromPortalForm(toPortalForm(portal))).toEqual(portal);
  });
});

describe('ações no portal na aba Portal', () => {
  it('ida e volta, na ordem escolhida', () => {
    const portal = { subject: 'self' as const, fields: ['name'], documents: false, actions: ['accept', 'contact'] };
    const form = toPortalForm(portal);
    expect(form.actions).toEqual(['accept', 'contact']);
    expect(fromPortalForm(form)).toEqual(portal);
  });

  it('sem ação marcada, a chave nem é gravada — a declaração de quem não usa o recurso fica como estava', () => {
    const portal = { subject: 'self' as const, fields: ['name'], documents: false };
    expect(toPortalForm(portal).actions).toEqual([]);
    expect(fromPortalForm({ ...toPortalForm(portal), actions: [] })).toEqual(portal);
  });
});

describe('nome de registro vinculado na aba Portal', () => {
  it('ida e volta', () => {
    const portal = { subject: 'self' as const, fields: ['name', 'holder'], documents: false, referenceTitles: ['holder'] };
    expect(fromPortalForm(toPortalForm(portal))).toEqual(portal);
  });

  it('o vínculo que deixa de ser exposto deixa de levar o nome — e sem nenhum, a chave nem é gravada', () => {
    const form = { ...toPortalForm({ subject: 'self', fields: ['name', 'holder'], referenceTitles: ['holder'] }), fields: ['name'] };
    expect(fromPortalForm(form)).not.toHaveProperty('referenceTitles');
  });
});
