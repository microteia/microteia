import { describe, expect, it } from 'vitest';
import { makeTrackPortalView, type PortalViewFact } from './PortalViewUseCases';
import { makeGetPortalDocumentUrlUseCase, makeRecordPortalViewUseCase } from './PortalAccessUseCases';
import { makeProjectPortalRecordUseCase } from './PortalProjectionUseCases';
import { CITY_SCREENS, makeFakePortalRepository } from '../repositories/fakePortalRepository';
import { makeFakePortalViewMarks } from '../repositories/fakePortalViewMarks';
import { makeFakeRecordDocumentLinks } from '../repositories/fakeRecordDocumentLinks';
import type { PortalScreen } from '../repositories/IPortalRepository';
import { PORTAL_VIEW_REPEAT_MINUTES } from '../schema/portal';
import { portalViewAuditEntry, portalViewedPayload } from '../services/portalView';

const TENANT = 'salvador';
const START = new Date('2026-10-27T12:00:00.000Z');
const minutesLater = (minutes: number) => new Date(START.getTime() + minutes * 60_000);

const tracked = (trackViews: boolean): PortalScreen[] => CITY_SCREENS.map((screen) => (
  screen.id === 'invoices' ? { ...screen, portal: { ...screen.portal!, ...(trackViews ? { trackViews: true } : {}) } } : screen
));

const setup = async (trackViews = true) => {
  const fake = makeFakePortalRepository(tracked(trackViews));
  fake.records.set('companies/acme', { name: 'Acme' });
  fake.users.set('ana', { userId: 'ana', email: 'ana@acme.com', displayName: 'Ana', subjectKeys: ['companies/acme'] });
  fake.users.set('bia', { userId: 'bia', email: 'bia@globex.com', displayName: 'Bia', subjectKeys: ['companies/globex'] });
  fake.records.set('invoices/nf1', { number: 'NF-1', companyId: 'acme' });
  await makeProjectPortalRecordUseCase(fake.repo).execute({
    tenantId: TENANT, collection: 'invoices', recordId: 'nf1', data: { number: 'NF-1', companyId: 'acme' },
  });
  fake.documents.set('invoices/nf1/d1', { name: 'nota.pdf', url: 'https://files/nota.pdf', portalShared: true });

  let clock = START;
  const facts: PortalViewFact[] = [];
  let failing = false;
  const marks = makeFakePortalViewMarks();
  const track = makeTrackPortalView({
    marks: marks.port,
    record: async (fact) => {
      if (failing) throw new Error('auditoria fora');
      facts.push(fact);
    },
    now: () => clock,
  });
  return {
    fake,
    facts,
    marks,
    track,
    at: (date: Date) => { clock = date; },
    fail: (value: boolean) => { failing = value; },
    view: makeRecordPortalViewUseCase(fake.repo, track),
    url: makeGetPortalDocumentUrlUseCase(fake.repo, makeFakeRecordDocumentLinks(fake.documents, TENANT).links, () => clock, track),
  };
};

const OPEN = { tenantId: TENANT, userId: 'ana', projectionId: 'invoices__nf1' };

describe('abertura do registro pelo portal (portal.trackViews)', () => {
  it('registra a abertura conferida — o convidado, o registro e o instante do servidor, sem documento', async () => {
    const { view, facts } = await setup();
    expect(await view.execute(OPEN)).toEqual({ recorded: true });
    expect(facts).toHaveLength(1);
    expect(facts[0]).toMatchObject({ tenantId: TENANT, userId: 'ana', email: 'ana@acme.com', recordId: 'nf1', document: null, at: START });
    expect(facts[0].screen.collection).toBe('invoices');
  });

  it('a tela que não declara não grava nada — nem a marca: quem não usa o recurso não paga por ele', async () => {
    const { view, facts, marks } = await setup(false);
    expect(await view.execute(OPEN)).toEqual({ recorded: false });
    expect(facts).toHaveLength(0);
    expect(marks.marks.size).toBe(0);
  });

  it('a mesma abertura dentro da janela não é registrada de novo; passada a janela, é', async () => {
    const { view, facts, at } = await setup();
    await view.execute(OPEN);
    at(minutesLater(PORTAL_VIEW_REPEAT_MINUTES - 1));
    expect(await view.execute(OPEN)).toEqual({ recorded: false });
    at(minutesLater(PORTAL_VIEW_REPEAT_MINUTES));
    expect(await view.execute(OPEN)).toEqual({ recorded: true });
    expect(facts.map((fact) => fact.at)).toEqual([START, minutesLater(PORTAL_VIEW_REPEAT_MINUTES)]);
  });

  it('a janela é de cada convidado — a abertura de outro não cala a de ninguém', async () => {
    const { fake, view, facts } = await setup();
    fake.users.set('caio', { userId: 'caio', email: 'caio@acme.com', displayName: 'Caio', subjectKeys: ['companies/acme'] });
    await makeProjectPortalRecordUseCase(fake.repo).execute({
      tenantId: TENANT, collection: 'invoices', recordId: 'nf1', data: { number: 'NF-1', companyId: 'acme' },
    });
    await view.execute(OPEN);
    await view.execute({ ...OPEN, userId: 'caio' });
    expect(facts.map((fact) => fact.userId)).toEqual(['ana', 'caio']);
  });

  it('o registro que falha libera a marca: a próxima abertura é registrada, não tomada por repetição', async () => {
    const { view, facts, fail, marks } = await setup();
    fail(true);
    await expect(view.execute(OPEN)).rejects.toThrow('auditoria fora');
    expect(marks.marks.size).toBe(0);
    fail(false);
    expect(await view.execute(OPEN)).toEqual({ recorded: true });
    expect(facts).toHaveLength(1);
  });

  it('recusa quem não enxerga o registro, com a frase de sempre — e não grava nada', async () => {
    const { view, facts, fake } = await setup();
    await expect(view.execute({ ...OPEN, userId: 'bia' })).rejects.toThrow('@core.tenant/portal.record.unavailable');
    await expect(view.execute({ ...OPEN, projectionId: 'invoices__nf9' })).rejects.toThrow('@core.tenant/portal.record.unavailable');
    fake.users.set('ana', { ...fake.users.get('ana')!, suspended: true });
    await expect(view.execute(OPEN)).rejects.toThrow('@core.tenant/portal.record.unavailable');
    fake.users.delete('ana');
    await expect(view.execute(OPEN)).rejects.toThrow('@core.tenant/portal.record.unavailable');
    expect(facts).toHaveLength(0);
  });

  it('o convite revogado vale no instante, mesmo com o audience ainda por refazer', async () => {
    const { view, fake, facts } = await setup();
    fake.users.set('ana', { ...fake.users.get('ana')!, subjectKeys: [] });
    await expect(view.execute(OPEN)).rejects.toThrow('@core.tenant/portal.record.unavailable');
    expect(facts).toHaveLength(0);
  });
});

describe('obtenção do link de documento pelo portal (portal.trackViews)', () => {
  const DOCUMENT = { ...OPEN, documentId: 'd1' };

  it('registra ANTES de entregar, com o documento', async () => {
    const { url, facts } = await setup();
    expect(await url.execute(DOCUMENT)).toBe('https://files/nota.pdf');
    expect(facts).toHaveLength(1);
    expect(facts[0]).toMatchObject({ recordId: 'nf1', document: { id: 'd1', name: 'nota.pdf', type: null } });
  });

  it('se o registro falha, o documento NÃO é entregue — não há abertura sem registro', async () => {
    const { url, fail } = await setup();
    fail(true);
    await expect(url.execute(DOCUMENT)).rejects.toThrow('auditoria fora');
  });

  it('a repetição dentro da janela não é registrada, mas o documento é entregue', async () => {
    const { url, facts, at } = await setup();
    await url.execute(DOCUMENT);
    at(minutesLater(1));
    expect(await url.execute(DOCUMENT)).toBe('https://files/nota.pdf');
    expect(facts).toHaveLength(1);
  });

  it('abrir o registro e abrir o documento são aberturas distintas — uma não cala a outra', async () => {
    const { url, view, facts } = await setup();
    await view.execute(OPEN);
    await url.execute(DOCUMENT);
    expect(facts.map((fact) => fact.document?.id ?? null)).toEqual([null, 'd1']);
  });

  it('sem a declaração, nada é registrado e o link sai como antes', async () => {
    const { url, facts, marks } = await setup(false);
    expect(await url.execute(DOCUMENT)).toBe('https://files/nota.pdf');
    expect(facts).toHaveLength(0);
    expect(marks.marks.size).toBe(0);
  });

  it('a tela declara e não há quem registre: recusa, em vez de entregar sem registro', async () => {
    const { fake } = await setup();
    const url = makeGetPortalDocumentUrlUseCase(fake.repo, makeFakeRecordDocumentLinks(fake.documents, TENANT).links);
    await expect(url.execute(DOCUMENT)).rejects.toThrow('@core.tenant/portal.document.unavailable');
  });

  it('quem não enxerga o registro é recusado antes de qualquer registro', async () => {
    const { url, facts } = await setup();
    await expect(url.execute({ ...DOCUMENT, userId: 'bia' })).rejects.toThrow('@core.tenant/portal.document.unavailable');
    expect(facts).toHaveLength(0);
  });
});

describe('o que a abertura publica e audita', () => {
  const screen = tracked(true).find((one) => one.id === 'invoices')!;
  const fact: PortalViewFact = {
    tenantId: TENANT,
    userId: 'ana',
    email: 'ana@acme.com',
    screen: { ...screen, titleFieldKey: 'number' },
    recordId: 'nf1',
    document: { id: 'd1', name: 'nota.pdf', type: 'invoice' },
    at: START,
  };

  it('o payload é o registro na raiz, mais `portalView` — que não é sobrescrito por campo homônimo', () => {
    const payload = portalViewedPayload(fact, { number: 'NF-1', portalView: 'campo do registro' });
    expect(payload).toEqual({
      id: 'nf1',
      number: 'NF-1',
      portalView: { at: START, email: 'ana@acme.com', documentId: 'd1', documentName: 'nota.pdf', documentType: 'invoice' },
    });
  });

  it('a abertura do registro leva o documento vazio', () => {
    expect(portalViewedPayload({ ...fact, document: null }, {}).portalView).toEqual({
      at: START, email: 'ana@acme.com', documentId: null, documentName: null, documentType: null,
    });
  });

  it('a Auditoria aponta para o registro, pela coleção, com o convidado como autor', () => {
    const entry = portalViewAuditEntry(fact, { number: 'NF-1' }, 'Ana');
    expect(entry).toMatchObject({
      tenantId: TENANT,
      title: '@core.tenant/portal.audit.viewed-document',
      titleParams: { guest: 'Ana', record: 'NF-1', document: 'nota.pdf' },
      userId: 'ana',
      userName: 'Ana',
      action: 'SYSTEM',
      entity: 'invoices',
      entityId: 'nf1',
      linkCollection: 'invoices',
      linkRecordId: 'nf1',
      textParams: { email: 'ana@acme.com', minutes: String(PORTAL_VIEW_REPEAT_MINUTES) },
    });
  });

  it('sem nome, o autor é o e-mail do convite; sem título, o id do registro', () => {
    const entry = portalViewAuditEntry({ ...fact, document: null }, {}, '');
    expect(entry.title).toBe('@core.tenant/portal.audit.viewed');
    expect(entry.userName).toBe('ana@acme.com');
    expect(entry.titleParams).toMatchObject({ guest: 'ana@acme.com', record: 'nf1' });
    expect(entry.titleParams).not.toHaveProperty('document');
  });
});
