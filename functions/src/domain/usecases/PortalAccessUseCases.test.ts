import { describe, expect, it, vi } from 'vitest';
import {
  makeGetPortalContextUseCase,
  makeGetPortalDocumentUrlUseCase,
  makeInvitePortalUserUseCase,
} from './PortalAccessUseCases';
import { makeProjectPortalRecordUseCase } from './PortalProjectionUseCases';
import { CITY_SCREENS, makeFakePortalRepository } from '../repositories/fakePortalRepository';
import type { IPortalAccountService } from '../repositories/IPortalRepository';

const TENANT = 'salvador';

const accountsWith = (existing: Record<string, string> = {}) => {
  const order: string[] = [];
  const accounts: IPortalAccountService = {
    findUserIdByEmail: vi.fn(async (email: string) =>
      (existing[email] ? { userId: existing[email], displayName: null } : null)),
    createAccount: vi.fn(async (email: string) => {
      order.push(`create:${email}`);
      return `uid-${email}`;
    }),
  };
  return { accounts, order };
};

describe('convite do portal', () => {
  it('grava a marca ANTES de criar a conta — é o que impede o bootstrap de abrir um escritório', async () => {
    const fake = makeFakePortalRepository(CITY_SCREENS);
    fake.records.set('companies/acme', { name: 'Acme' });
    const { accounts, order } = accountsWith();
    const markInvite = fake.repo.markInvite;
    fake.repo.markInvite = async (email, tenantId) => {
      order.push(`mark:${email}`);
      await markInvite(email, tenantId);
    };

    const result = await makeInvitePortalUserUseCase(fake.repo, accounts).execute({
      tenantId: TENANT, tenantName: 'Salvador', email: ' Ana@Acme.com ', subjectKey: 'companies/acme', invitedBy: 'fiscal',
    });

    expect(order).toEqual(['mark:ana@acme.com', 'create:ana@acme.com']);
    expect(result).toEqual({ userId: 'uid-ana@acme.com', created: true });
    expect(fake.users.get('uid-ana@acme.com')?.subjectKeys).toEqual(['companies/acme']);
  });

  it('quem já tem conta é só vinculado', async () => {
    const fake = makeFakePortalRepository(CITY_SCREENS);
    fake.records.set('companies/acme', { name: 'Acme' });
    const { accounts } = accountsWith({ 'ana@acme.com': 'ana' });

    const result = await makeInvitePortalUserUseCase(fake.repo, accounts).execute({
      tenantId: TENANT, tenantName: 'Salvador', email: 'ana@acme.com', subjectKey: 'companies/acme', invitedBy: 'fiscal',
    });

    expect(result.created).toBe(false);
    expect(accounts.createAccount).not.toHaveBeenCalled();
    expect(fake.invites).toEqual([]);
  });

  it('recusa sujeito que não é de uma tela-sujeito, ou que não existe', async () => {
    const fake = makeFakePortalRepository(CITY_SCREENS);
    fake.records.set('invoices/nf1', { number: 'NF-1' });
    const { accounts } = accountsWith();
    const invite = makeInvitePortalUserUseCase(fake.repo, accounts);
    const base = { tenantId: TENANT, tenantName: 'Salvador', email: 'ana@acme.com', invitedBy: 'fiscal' };

    await expect(invite.execute({ ...base, subjectKey: 'invoices/nf1' })).rejects.toThrow('@core.tenant/portal.subject.invalid');
    await expect(invite.execute({ ...base, subjectKey: 'companies/missing' })).rejects.toThrow('@core.tenant/portal.subject.invalid');
    await expect(invite.execute({ ...base, email: 'sem-arroba', subjectKey: 'companies/acme' })).rejects.toThrow('@core.tenant/portal.email.invalid');
  });
});

describe('documento compartilhado', () => {
  const setup = async () => {
    const fake = makeFakePortalRepository(CITY_SCREENS);
    fake.records.set('companies/acme', { name: 'Acme' });
    fake.users.set('ana', { userId: 'ana', email: 'ana@acme.com', displayName: 'Ana', subjectKeys: ['companies/acme'] });
    fake.users.set('bia', { userId: 'bia', email: 'bia@globex.com', displayName: 'Bia', subjectKeys: ['companies/globex'] });
    fake.records.set('invoices/nf1', { number: 'NF-1', companyId: 'acme' });
    await makeProjectPortalRecordUseCase(fake.repo).execute({
      tenantId: TENANT, collection: 'invoices', recordId: 'nf1', data: { number: 'NF-1', companyId: 'acme' },
    });
    fake.documents.set('invoices/nf1/d1', { name: 'nota.pdf', url: 'https://files/nota.pdf', portalShared: true });
    fake.documents.set('invoices/nf1/d2', { name: 'interno.pdf', url: 'https://files/interno.pdf', portalShared: false });
    return { fake, url: makeGetPortalDocumentUrlUseCase(fake.repo) };
  };

  it('entrega a URL a quem está no audience, só do documento compartilhado', async () => {
    const { url } = await setup();
    const input = { tenantId: TENANT, userId: 'ana', projectionId: 'invoices__nf1' };
    expect(await url.execute({ ...input, documentId: 'd1' })).toBe('https://files/nota.pdf');
    await expect(url.execute({ ...input, documentId: 'd2' })).rejects.toThrow('@core.tenant/portal.document.unavailable');
  });

  it('recusa quem é de outra empresa, com a mesma resposta', async () => {
    const { url } = await setup();
    await expect(url.execute({ tenantId: TENANT, userId: 'bia', projectionId: 'invoices__nf1', documentId: 'd1' }))
      .rejects.toThrow('@core.tenant/portal.document.unavailable');
  });
});

describe('contexto do portal', () => {
  it('só as telas do portal, e só com os campos expostos', async () => {
    const fake = makeFakePortalRepository(CITY_SCREENS);
    fake.users.set('ana', { userId: 'ana', email: 'ana@acme.com', displayName: 'Ana', subjectKeys: ['companies/acme'] });

    const context = await makeGetPortalContextUseCase(fake.repo).execute({
      tenantId: TENANT, userId: 'ana', tenant: { name: 'Salvador', logoURL: null }, locale: 'pt-BR', resolve: (value) => value.toUpperCase(),
    });

    expect(context.screens.map((screen) => screen.id)).toEqual(['companies', 'invoices', 'invoiceItems']);
    const invoices = context.screens.find((screen) => screen.id === 'invoices');
    expect(invoices?.fields.map((field) => field.key)).toEqual(['number', 'amount', 'companyId']);
    expect(invoices?.titlePlural).toBe('INVOICES');
  });

  it('quem não é convidado não recebe nada', async () => {
    const fake = makeFakePortalRepository(CITY_SCREENS);
    await expect(makeGetPortalContextUseCase(fake.repo).execute({
      tenantId: TENANT, userId: 'intruso', tenant: { name: 'Salvador', logoURL: null }, locale: 'pt-BR', resolve: (value) => value,
    })).rejects.toThrow('@core.tenant/portal.not-invited');
  });
});
