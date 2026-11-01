import { describe, expect, it } from 'vitest';
import { makeResolvePortalGuestsUseCase } from './ResolvePortalGuestsUseCase';
import { CITY_SCREENS, PUBLIC_CITY_SCREENS, makeFakePortalRepository } from '../repositories/fakePortalRepository';

const TENANT = 'salvador';

const setup = (screens = CITY_SCREENS) => {
  const fake = makeFakePortalRepository(screens);
  fake.records.set('companies/acme', { name: 'Acme' });
  fake.records.set('companies/globex', { name: 'Globex' });
  fake.records.set('invoices/nf1', { number: 'NF-1', companyId: 'acme' });
  fake.records.set('invoiceItems/i1', { description: 'Item', invoiceId: 'nf1' });
  fake.records.set('inspections/x1', { title: 'Interna', companyId: 'acme' });
  fake.users.set('ana', { userId: 'ana', email: 'ana@acme.com', displayName: 'Ana', subjectKeys: ['companies/acme'], locale: 'pt-BR' });
  fake.users.set('bia', { userId: 'bia', email: 'bia@globex.com', displayName: 'Bia', subjectKeys: ['companies/globex'] });
  return { ...fake, uc: makeResolvePortalGuestsUseCase(fake.repo) };
};

describe('quem do portal vê um registro', () => {
  it('segue a corrente até o sujeito e devolve só os convidados dele, com o idioma do convite', async () => {
    const { uc } = setup();
    const seen = await uc.execute(TENANT, { collection: 'invoiceItems', recordId: 'i1' });
    expect(seen).toEqual({ inPortal: true, guests: [{ userId: 'ana', email: 'ana@acme.com', locale: 'pt-BR' }] });
  });

  it('a raiz (`self`) é o próprio sujeito', async () => {
    const { uc } = setup();
    const seen = await uc.execute(TENANT, { collection: 'companies', recordId: 'globex' });
    expect(seen.guests.map((guest) => guest.userId)).toEqual(['bia']);
  });

  it('tela fora do portal não tem convidado a avisar', async () => {
    const { uc } = setup();
    expect(await uc.execute(TENANT, { collection: 'inspections', recordId: 'x1' })).toEqual({ inPortal: false, guests: [] });
  });

  it('o registro que não passa no `visibleWhen` não avisa ninguém — nem confirma que existe', async () => {
    const hidden = CITY_SCREENS.map((screen) => (screen.id === 'invoices'
      ? { ...screen, portal: { ...screen.portal!, visibleWhen: 'amount > 0' } }
      : screen));
    const { uc } = setup(hidden);
    expect(await uc.execute(TENANT, { collection: 'invoices', recordId: 'nf1' })).toEqual({ inPortal: false, guests: [] });
  });

  it('registro apagado não leva a ninguém', async () => {
    const { uc } = setup();
    expect((await uc.execute(TENANT, { collection: 'invoices', recordId: 'missing' })).inPortal).toBe(false);
  });

  it('o convite revogado vale no instante: quem saiu não recebe, mesmo antes de o `audience` ser refeito', async () => {
    const { uc, users } = setup();
    users.delete('ana');
    expect(await uc.execute(TENANT, { collection: 'invoices', recordId: 'nf1' })).toEqual({ inPortal: true, guests: [] });
  });
});

describe('aviso de um registro público (EV-43)', () => {
  it('está no portal, e ninguém recebe: avisar todo convidado seria mala direta', async () => {
    const { uc, records } = setup(PUBLIC_CITY_SCREENS);
    records.set('outages/o1', { description: 'Manutenção', kind: 'outage' });
    expect(await uc.execute(TENANT, { collection: 'outages', recordId: 'o1' })).toEqual({ inPortal: true, guests: [] });
  });
});
