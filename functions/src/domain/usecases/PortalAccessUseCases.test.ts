import { describe, expect, it, vi } from 'vitest';
import {
  makeGetPortalContextUseCase,
  makeGetPortalDocumentUrlUseCase,
  makeInvitePortalUserUseCase,
  makeRevokePortalUserUseCase,
  makeSubmitPortalRecordUseCase,
  makeAttachPortalDocumentUseCase,
  makeUpdatePortalRecordUseCase,
} from './PortalAccessUseCases';
import type { PortalAccessAuditEntry, PortalAccessDeps } from './PortalAccessUseCases';
import { makeProjectPortalRecordUseCase } from './PortalProjectionUseCases';
import { CITY_SCREENS, EXTENSION_CITY_SCREENS, makeFakePortalRepository } from '../repositories/fakePortalRepository';
import type { IPortalAccountService, PortalScreen } from '../repositories/IPortalRepository';
import { makeFakePortalIdentity } from '../repositories/fakePortalIdentity';
import { makeFakeRecordDocumentLinks } from '../repositories/fakeRecordDocumentLinks';

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

const FISCAL = { userId: 'fiscal', userName: 'Fiscal' };

const accessDeps = (
  fake: ReturnType<typeof makeFakePortalRepository>,
  accounts: IPortalAccountService,
  options: { quota?: number } = {},
) => {
  const audited: PortalAccessAuditEntry[] = [];
  let used = 0;
  const identity = makeFakePortalIdentity(fake.users);
  const deps: PortalAccessDeps = {
    repo: fake.repo,
    identity: identity.identity,
    signIn: identity.config,
    accounts,
    audit: async (entry) => { audited.push(entry); },
    quota: {
      consume: async (_tenantId, limit) => {
        if (used >= Math.min(limit, options.quota ?? limit)) return false;
        used += 1;
        return true;
      },
    },
    now: () => new Date('2026-10-26T14:00:00Z'),
  };
  return { deps, audited, quotaUsed: () => used, identity };
};

const withInvites = (screens: PortalScreen[]): PortalScreen[] => screens.map((screen) =>
  (screen.id === 'companies' && screen.portal ? { ...screen, portal: { ...screen.portal, invites: { automation: true } } } : screen));

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

    const result = await makeInvitePortalUserUseCase(accessDeps(fake, accounts).deps).execute({
      tenantId: TENANT, tenantName: 'Salvador', email: ' Ana@Acme.com ', subjectKey: 'companies/acme', actor: FISCAL,
    });

    expect(order).toEqual(['mark:ana@acme.com', 'create:ana@acme.com']);
    expect(result).toEqual({ userId: 'uid-ana@acme.com', created: true, granted: true });
    expect(fake.users.get('uid-ana@acme.com')?.subjectKeys).toEqual(['companies/acme']);
  });

  it('o convite guarda o idioma de quem convidou — o do portal enquanto ninguém escolher outro', async () => {
    const fake = makeFakePortalRepository(CITY_SCREENS);
    fake.records.set('companies/acme', { name: 'Acme' });
    const grant = vi.spyOn(fake.repo, 'grantSubject');
    const { accounts } = accountsWith({ 'ana@acme.com': 'ana' });

    await makeInvitePortalUserUseCase(accessDeps(fake, accounts).deps).execute({
      tenantId: TENANT, tenantName: 'Salvador', email: 'ana@acme.com', subjectKey: 'companies/acme', actor: FISCAL, locale: 'pt-BR',
    });

    expect(grant).toHaveBeenCalledWith(TENANT, expect.objectContaining({ locale: 'pt-BR', invitedBy: 'fiscal' }), 'companies/acme');
  });

  it('quem já tem conta é só vinculado', async () => {
    const fake = makeFakePortalRepository(CITY_SCREENS);
    fake.records.set('companies/acme', { name: 'Acme' });
    const { accounts } = accountsWith({ 'ana@acme.com': 'ana' });

    const result = await makeInvitePortalUserUseCase(accessDeps(fake, accounts).deps).execute({
      tenantId: TENANT, tenantName: 'Salvador', email: 'ana@acme.com', subjectKey: 'companies/acme', actor: FISCAL,
    });

    expect(result.created).toBe(false);
    expect(accounts.createAccount).not.toHaveBeenCalled();
    expect(fake.invites).toEqual([]);
  });

  it('recusa sujeito que não é de uma tela-sujeito, ou que não existe', async () => {
    const fake = makeFakePortalRepository(CITY_SCREENS);
    fake.records.set('invoices/nf1', { number: 'NF-1' });
    const { accounts } = accountsWith();
    const invite = makeInvitePortalUserUseCase(accessDeps(fake, accounts).deps);
    const base = { tenantId: TENANT, tenantName: 'Salvador', email: 'ana@acme.com', actor: FISCAL };

    await expect(invite.execute({ ...base, subjectKey: 'invoices/nf1' })).rejects.toThrow('@core.tenant/portal.subject.invalid');
    await expect(invite.execute({ ...base, subjectKey: 'companies/missing' })).rejects.toThrow('@core.tenant/portal.subject.invalid');
    await expect(invite.execute({ ...base, email: 'sem-arroba', subjectKey: 'companies/acme' })).rejects.toThrow('@core.tenant/portal.email.invalid');
  });

  it('o vínculo novo deixa linha na Auditoria, com quem convidou e de onde', async () => {
    const fake = makeFakePortalRepository(CITY_SCREENS);
    fake.records.set('companies/acme', { name: 'Acme' });
    const { accounts } = accountsWith();
    const { deps, audited } = accessDeps(fake, accounts);

    await makeInvitePortalUserUseCase(deps).execute({
      tenantId: TENANT, tenantName: 'Salvador', email: 'ana@acme.com', subjectKey: 'companies/acme', actor: FISCAL,
    });

    expect(audited).toEqual([{
      tenantId: TENANT, change: 'granted', email: 'ana@acme.com', subjectKey: 'companies/acme', actor: FISCAL, origin: 'settings',
    }]);
  });
});

describe('convite por automação', () => {
  const MOTOR = { userId: 'workflow-engine', userName: '@core.automation/run.actor' };
  const automation = { tenantId: TENANT, tenantName: 'Salvador', actor: MOTOR, origin: 'automation' as const, workflowId: 'wf-cred' };

  it('dá o mesmo convite da tela: a mesma conta, a mesma marca, o mesmo vínculo', async () => {
    const manual = makeFakePortalRepository(withInvites(CITY_SCREENS));
    const automated = makeFakePortalRepository(withInvites(CITY_SCREENS));
    for (const fake of [manual, automated]) fake.records.set('companies/acme', { name: 'Acme' });

    const viaSettings = await makeInvitePortalUserUseCase(accessDeps(manual, accountsWith().accounts).deps).execute({
      tenantId: TENANT, tenantName: 'Salvador', email: 'ana@acme.com', subjectKey: 'companies/acme', actor: FISCAL,
    });
    const viaFlow = await makeInvitePortalUserUseCase(accessDeps(automated, accountsWith().accounts).deps).execute({
      ...automation, email: 'ana@acme.com', subjectKey: 'companies/acme',
    });

    expect(viaFlow).toEqual(viaSettings);
    expect(automated.users.get(viaFlow.userId)).toEqual(manual.users.get(viaSettings.userId));
    expect(automated.invites).toEqual(manual.invites);
  });

  it('só convida para a tela que declara portal.invites.automation — a tela, e não quem dispara, abre a porta', async () => {
    const fake = makeFakePortalRepository(CITY_SCREENS);
    fake.records.set('companies/acme', { name: 'Acme' });
    const { accounts } = accountsWith();
    const { deps, quotaUsed } = accessDeps(fake, accounts);

    await expect(makeInvitePortalUserUseCase(deps).execute({ ...automation, email: 'ana@acme.com', subjectKey: 'companies/acme' }))
      .rejects.toThrow('@core.tenant/portal.invite.automation-closed');
    expect(accounts.createAccount).not.toHaveBeenCalled();
    expect(fake.invites).toEqual([]);
    expect(quotaUsed()).toBe(0);
  });

  it('é idempotente por (e-mail, sujeito): rodar de novo não escreve, não conta no limite e não audita', async () => {
    const fake = makeFakePortalRepository(withInvites(CITY_SCREENS));
    fake.records.set('companies/acme', { name: 'Acme' });
    const { accounts } = accountsWith();
    const { deps, audited, quotaUsed } = accessDeps(fake, accounts);
    const invite = makeInvitePortalUserUseCase(deps);
    const input = { ...automation, email: 'ana@acme.com', subjectKey: 'companies/acme' };

    const first = await invite.execute(input);
    (accounts.findUserIdByEmail as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: first.userId, displayName: null });
    const grant = vi.spyOn(fake.repo, 'grantSubject');
    const second = await invite.execute({ ...input, email: ' ANA@acme.com' });

    expect(first).toEqual({ userId: 'uid-ana@acme.com', created: true, granted: true });
    expect(second).toEqual({ userId: 'uid-ana@acme.com', created: false, granted: false });
    expect(grant).not.toHaveBeenCalled();
    expect(quotaUsed()).toBe(1);
    expect(audited).toHaveLength(1);
    expect(audited[0]).toMatchObject({ origin: 'automation', workflowId: 'wf-cred', actor: MOTOR });
  });

  it('o convite NOVO de quem já é convidado de outro sujeito vincula e conta', async () => {
    const fake = makeFakePortalRepository(withInvites(CITY_SCREENS));
    fake.records.set('companies/acme', { name: 'Acme' });
    fake.records.set('companies/beta', { name: 'Beta' });
    fake.users.set('ana', { userId: 'ana', email: 'ana@acme.com', displayName: 'Ana', subjectKeys: ['companies/beta'] });
    const { accounts } = accountsWith({ 'ana@acme.com': 'ana' });
    const { deps, quotaUsed } = accessDeps(fake, accounts);

    const result = await makeInvitePortalUserUseCase(deps).execute({ ...automation, email: 'ana@acme.com', subjectKey: 'companies/acme' });

    expect(result).toEqual({ userId: 'ana', created: false, granted: true });
    expect(fake.users.get('ana')?.subjectKeys).toEqual(['companies/beta', 'companies/acme']);
    expect(quotaUsed()).toBe(1);
  });

  it('esgotado o limite da hora, recusa ANTES de criar a conta', async () => {
    const fake = makeFakePortalRepository(withInvites(CITY_SCREENS));
    fake.records.set('companies/acme', { name: 'Acme' });
    const { accounts } = accountsWith();
    const { deps } = accessDeps(fake, accounts, { quota: 0 });

    await expect(makeInvitePortalUserUseCase(deps).execute({ ...automation, email: 'ana@acme.com', subjectKey: 'companies/acme' }))
      .rejects.toThrow('@core.tenant/portal.invite.rate-limited');
    expect(accounts.createAccount).not.toHaveBeenCalled();
    expect(fake.invites).toEqual([]);
  });

  it('o nome informado pela automação é o que o escritório lista enquanto o convidado não informa o dele', async () => {
    const fake = makeFakePortalRepository(withInvites(CITY_SCREENS));
    fake.records.set('companies/acme', { name: 'Acme' });
    const { deps } = accessDeps(fake, accountsWith().accounts);

    const result = await makeInvitePortalUserUseCase(deps).execute({
      ...automation, email: 'ana@acme.com', subjectKey: 'companies/acme', displayName: '  Ana Souza ',
    });

    expect(fake.users.get(result.userId)?.displayName).toBe('Ana Souza');
  });

  it('a falha da Auditoria não desfaz o convite', async () => {
    const fake = makeFakePortalRepository(withInvites(CITY_SCREENS));
    fake.records.set('companies/acme', { name: 'Acme' });
    const { deps } = accessDeps(fake, accountsWith().accounts);
    deps.audit = async () => { throw new Error('auditoria fora do ar'); };

    const result = await makeInvitePortalUserUseCase(deps).execute({ ...automation, email: 'ana@acme.com', subjectKey: 'companies/acme' });

    expect(result.granted).toBe(true);
  });
});

describe('revogação do portal', () => {
  const MOTOR = { userId: 'workflow-engine', userName: '@core.automation/run.actor' };
  const setup = () => {
    const fake = makeFakePortalRepository(CITY_SCREENS);
    fake.users.set('ana', { userId: 'ana', email: 'ana@acme.com', displayName: 'Ana', subjectKeys: ['companies/acme', 'companies/beta'] });
    const { accounts } = accountsWith({ 'ana@acme.com': 'ana' });
    const access = accessDeps(fake, accounts);
    return { fake, accounts, ...access, revoke: makeRevokePortalUserUseCase(access.deps) };
  };
  const base = { tenantId: TENANT, actor: MOTOR, origin: 'automation' as const, workflowId: 'wf-cred' };

  it('pelo e-mail, tira só aquele sujeito, e audita', async () => {
    const { fake, revoke, audited } = setup();

    const result = await revoke.execute({ ...base, guest: { email: 'Ana@Acme.com' }, subjectKey: 'companies/acme' });

    expect(result).toEqual({ userId: 'ana', revoked: true });
    expect(fake.users.get('ana')?.subjectKeys).toEqual(['companies/beta']);
    expect(audited).toEqual([expect.objectContaining({ change: 'revoked', email: 'ana@acme.com', subjectKey: 'companies/acme' })]);
  });

  it('com allSubjects, o convite inteiro — mas só de quem tem aquele sujeito', async () => {
    const { fake, revoke } = setup();

    expect(await revoke.execute({ ...base, guest: { email: 'ana@acme.com' }, subjectKey: 'companies/other', allSubjects: true }))
      .toEqual({ userId: 'ana', revoked: false });
    expect(fake.users.has('ana')).toBe(true);

    expect(await revoke.execute({ ...base, guest: { email: 'ana@acme.com' }, subjectKey: 'companies/beta', allSubjects: true }))
      .toEqual({ userId: 'ana', revoked: true });
    expect(fake.users.has('ana')).toBe(false);
  });

  it('é idempotente: quem não tem o sujeito, ou nem conta tem, volta sem escrever nem auditar', async () => {
    const { revoke, audited } = setup();

    expect(await revoke.execute({ ...base, guest: { email: 'ana@acme.com' }, subjectKey: 'companies/zeta' }))
      .toEqual({ userId: 'ana', revoked: false });
    expect(await revoke.execute({ ...base, guest: { email: 'ninguem@acme.com' }, subjectKey: 'companies/acme' }))
      .toEqual({ userId: null, revoked: false });
    expect(audited).toEqual([]);
  });

  it('não pede portal.invites: recolher nunca expõe nada', async () => {
    const { revoke } = setup();
    expect((await revoke.execute({ ...base, guest: { email: 'ana@acme.com' }, subjectKey: 'companies/acme' })).revoked).toBe(true);
  });

  it('recusa e-mail inválido com erro nomeado', async () => {
    const { revoke } = setup();
    await expect(revoke.execute({ ...base, guest: { email: 'sem-arroba' }, subjectKey: 'companies/acme' }))
      .rejects.toThrow('@core.tenant/portal.email.invalid');
  });

  it('pela tela, sem sujeito, o convite inteiro', async () => {
    const { fake, revoke, audited } = setup();

    await revoke.execute({ tenantId: TENANT, guest: { userId: 'ana' }, subjectKey: null, actor: FISCAL });

    expect(fake.users.has('ana')).toBe(false);
    expect(audited).toEqual([expect.objectContaining({ change: 'revoked', subjectKey: null, origin: 'settings' })]);
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
    return { fake, url: makeGetPortalDocumentUrlUseCase(fake.repo, makeFakeRecordDocumentLinks(fake.documents, TENANT).links) };
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

describe('documento compartilhado com link curto (portal.documentLinks)', () => {
  const NOW = new Date('2026-10-26T12:00:00.000Z');
  const signedScreens = (documentLinks: { expiresInMinutes: number } | null) => CITY_SCREENS.map((screen) => (
    screen.id === 'invoices' ? { ...screen, portal: { ...screen.portal!, ...(documentLinks ? { documentLinks } : {}) } } : screen
  )) as typeof CITY_SCREENS;

  const setup = async (documentLinks: { expiresInMinutes: number } | null = { expiresInMinutes: 5 }) => {
    const fake = makeFakePortalRepository(signedScreens(documentLinks));
    fake.records.set('companies/acme', { name: 'Acme' });
    fake.users.set('ana', { userId: 'ana', email: 'ana@acme.com', displayName: 'Ana', subjectKeys: ['companies/acme'] });
    fake.records.set('invoices/nf1', { number: 'NF-1', companyId: 'acme' });
    await makeProjectPortalRecordUseCase(fake.repo).execute({
      tenantId: TENANT, collection: 'invoices', recordId: 'nf1', data: { number: 'NF-1', companyId: 'acme' },
    });
    const files = makeFakeRecordDocumentLinks(fake.documents, TENANT);
    files.attach('invoices', 'nf1', 'd1', { portalShared: true, portalSharedAt: 'antes' });
    const url = makeGetPortalDocumentUrlUseCase(fake.repo, files.links, () => NOW);
    const input = { tenantId: TENANT, userId: 'ana', projectionId: 'invoices__nf1', documentId: 'd1' };
    return { fake, files, url, input };
  };

  it('entrega a URL assinada, com a validade declarada — nunca o link permanente', async () => {
    const { fake, files, url, input } = await setup();
    const permanent = String(fake.documents.get('invoices/nf1/d1')?.url);

    const delivered = await url.execute(input);

    expect(delivered).toContain('https://signed.test/');
    expect(delivered).not.toBe(permanent);
    expect(files.signed).toEqual([{
      storagePath: 'tenants/salvador/invoices/nf1/d1.pdf',
      fileName: 'd1.pdf',
      expiresAt: new Date('2026-10-26T12:05:00.000Z'),
    }]);
  });

  it('o token permanente que pode ter saído é trocado na primeira abertura, e o novo fica selado', async () => {
    const { fake, files, url, input } = await setup();
    const permanent = String(fake.documents.get('invoices/nf1/d1')?.url);

    await url.execute(input);

    expect(files.opens(permanent)).toBe(false);
    const after = fake.documents.get('invoices/nf1/d1')!;
    expect(files.opens(String(after.url))).toBe(true);
    expect(after.portalLinkSeal).toBe(new URL(String(after.url)).searchParams.get('token'));
  });

  it('a validade fora do intervalo cai na padrão — nunca no link permanente', async () => {
    const { files, url, input } = await setup({ expiresInMinutes: 600 });
    await url.execute(input);
    expect(files.signed[0].expiresAt).toEqual(new Date('2026-10-26T12:10:00.000Z'));
  });

  it('revogado o convite, nenhum link novo sai', async () => {
    const { fake, files, url, input } = await setup();
    fake.users.delete('ana');
    await expect(url.execute(input)).rejects.toThrow('@core.tenant/portal.document.unavailable');
    expect(files.signed).toHaveLength(0);
  });

  it('o documento sem arquivo na pasta do registro não é assinado — o caminho é dado do cliente', async () => {
    const { fake, files, url, input } = await setup();
    fake.documents.set('invoices/nf1/d1', { ...fake.documents.get('invoices/nf1/d1'), storagePath: 'tenants/outro/invoices/nf1/d1.pdf' });
    await expect(url.execute(input)).rejects.toThrow('@core.tenant/portal.document.unavailable');
    expect(files.signed).toHaveLength(0);
  });

  it('a troca que falha não segura o link curto', async () => {
    const { files, fake, input } = await setup();
    const url = makeGetPortalDocumentUrlUseCase(
      fake.repo,
      { ...files.links, rotate: async () => { throw new Error('storage fora'); } },
      () => NOW,
    );
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(url.execute(input)).resolves.toContain('https://signed.test/');
    error.mockRestore();
  });

  it('sem a declaração sai o link permanente, como antes — e o selo cai, porque o token saiu', async () => {
    const { fake, files, url, input } = await setup(null);
    await files.links.seal({ tenantId: TENANT, collection: 'invoices', recordId: 'nf1', documentId: 'd1' });
    const permanent = String(fake.documents.get('invoices/nf1/d1')?.url);

    expect(await url.execute(input)).toBe(permanent);
    expect(files.signed).toHaveLength(0);
    expect(fake.documents.get('invoices/nf1/d1')).not.toHaveProperty('portalLinkSeal');
  });

  it('sem a declaração e sem selo, nada é gravado — quem não usa o recurso não paga por ele', async () => {
    const { fake, url, input } = await setup(null);
    const before = { ...fake.documents.get('invoices/nf1/d1') };
    await url.execute(input);
    expect(fake.documents.get('invoices/nf1/d1')).toEqual(before);
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
    expect(invoices?.parent).toEqual({ collection: 'companies' });
    expect(context.screens.find((screen) => screen.id === 'companies')?.parent).toBeNull();
  });

  it('entrega só as views de extensão de coleções expostas', async () => {
    const fake = makeFakePortalRepository(CITY_SCREENS);
    fake.users.set('ana', { userId: 'ana', email: 'ana@acme.com', displayName: 'Ana', subjectKeys: ['companies/acme'] });
    const view = (collection: string) => ({ pluginId: 'com.acme', viewKey: `v-${collection}`, collection, surface: 'list' as const, source: 'x' });

    const context = await makeGetPortalContextUseCase(fake.repo).execute({
      tenantId: TENANT, userId: 'ana', tenant: { name: 'Salvador', logoURL: null }, locale: 'pt-BR', resolve: (value) => value,
      extensionViews: { views: [view('invoices'), view('inspections')], bundles: [{ locale: 'pt-BR', namespace: 'com.acme', messages: {} }] },
    });

    expect(context.views.map((one) => one.collection)).toEqual(['invoices']);
    expect(context.bundles).toHaveLength(1);
  });

  it('entrega os temas instalados, mesmo sem view de extensão', async () => {
    const fake = makeFakePortalRepository(CITY_SCREENS);
    fake.users.set('ana', { userId: 'ana', email: 'ana@acme.com', displayName: 'Ana', subjectKeys: ['companies/acme'] });
    const theme = { id: 'indigo', point: 'theme.definition', apiVersion: '1.0.0', pluginId: 'com.acme.theme', metadata: { id: 'indigo', name: 'Indigo', extends: 'dark' } };

    const context = await makeGetPortalContextUseCase(fake.repo).execute({
      tenantId: TENANT, userId: 'ana', tenant: { name: 'Salvador', logoURL: null }, locale: 'pt-BR', resolve: (value) => value,
      themes: [theme],
    });

    expect(context.views).toEqual([]);
    expect(context.themes).toEqual([theme]);
  });

  it('monta o menu: telas de topo e páginas de extensão, na ordem e sem o que o escritório escondeu', async () => {
    const fake = makeFakePortalRepository(CITY_SCREENS);
    fake.users.set('ana', { userId: 'ana', email: 'ana@acme.com', displayName: 'Ana', subjectKeys: ['companies/acme'] });
    fake.homeSettings.welcome = 'Bem-vindo';
    fake.homeSettings.menu = { order: ['page.com.acme.statement'], hidden: ['page.com.acme.hidden'] };
    const page = (key: string, order?: number) => ({
      pluginId: 'com.acme', viewKey: key, key, title: `@com.acme/${key}`, icon: 'file', surface: 'page' as const, source: 'x', order,
    });

    const context = await makeGetPortalContextUseCase(fake.repo).execute({
      tenantId: TENANT, userId: 'ana', tenant: { name: 'Salvador', logoURL: null }, locale: 'pt-BR', resolve: (value) => value.toUpperCase(),
      extensionViews: {
        views: [
          page('statement', 50), page('hidden'), page('schedule', 1),
          { pluginId: 'com.acme', viewKey: 'w', key: 'pending', surface: 'widget' as const, source: 'x' },
        ],
        bundles: [],
      },
    });

    // As notas e os itens têm pai exposto: não são raiz. A página que o escritório ordenou vem primeiro.
    expect(context.home.menu.map((entry) => entry.id)).toEqual(['page.com.acme.statement', 'companies', 'page.com.acme.schedule']);
    expect(context.home.menu[0]).toMatchObject({ kind: 'page', title: '@COM.ACME/STATEMENT', viewKey: 'statement' });
    expect(context.home.widgets.map((entry) => entry.id)).toEqual(['com.acme.pending']);
    expect(context.home.welcome).toBe('Bem-vindo');
    expect(context.home.view).toBeNull();
  });

  describe('o desenho declarado (`portal.template`)', () => {
    const withTemplate = (template: unknown): PortalScreen[] => CITY_SCREENS.map((screen) =>
      (screen.id === 'invoices' && screen.portal
        ? { ...screen, portal: { ...screen.portal, template: template as NonNullable<PortalScreen['portal']>['template'] } }
        : screen));

    const contextOf = async (screens: PortalScreen[]) => {
      const fake = makeFakePortalRepository(screens);
      fake.users.set('ana', { userId: 'ana', email: 'ana@acme.com', displayName: 'Ana', subjectKeys: ['companies/acme'] });
      return makeGetPortalContextUseCase(fake.repo).execute({
        tenantId: TENANT, userId: 'ana', tenant: { name: 'Salvador', logoURL: null }, locale: 'pt-BR', resolve: (value) => value.toUpperCase(),
      });
    };

    it('sem declaração, a tela não leva template — o portal de sempre', async () => {
      const context = await contextOf(CITY_SCREENS);
      expect(context.screens.every((screen) => !('template' in screen))).toBe(true);
    });

    it('nada do que não saiu do escritório chega ao convidado, e todo texto vai no idioma dele', async () => {
      const context = await contextOf(withTemplate({
        card: {
          layout: 'grid',
          accent: { field: 'auditNote' },
          body: [
            { type: 'field', field: 'amount', variant: 'strong', label: '@acme/total' },
            { type: 'field', field: 'auditNote' },
            { type: 'text', text: '@acme/flagged', tone: 'danger', hiddenWhen: 'auditNote == "ok"' },
            { type: 'text', text: '@acme/high', hiddenWhen: 'amount < 1000' },
          ],
        },
        detail: {
          body: [
            { type: 'section', title: '@acme/summary', children: [{ type: 'field', field: 'number', size: 'xl' }] },
            { type: 'fields', exclude: ['number', 'auditNote'] },
          ],
        },
      }));

      const template = context.screens.find((screen) => screen.id === 'invoices')?.template;
      expect(template).toEqual({
        card: {
          layout: 'grid',
          body: [
            { type: 'field', field: 'amount', variant: 'strong', label: '@ACME/TOTAL' },
            { type: 'text', text: '@ACME/HIGH', hiddenWhen: 'amount < 1000' },
          ],
        },
        detail: {
          body: [
            { type: 'section', title: '@ACME/SUMMARY', children: [{ type: 'field', field: 'number', size: 'xl' }] },
            { type: 'fields', exclude: ['number'] },
          ],
        },
      });
      expect(JSON.stringify(context.screens)).not.toContain('auditNote');
    });

    it('o desenho que só nomeava o que não saiu vira o padrão, e não um cartão vazio', async () => {
      const context = await contextOf(withTemplate({ card: { body: [{ type: 'field', field: 'auditNote' }] } }));
      expect(context.screens.find((screen) => screen.id === 'invoices')?.template).toBeUndefined();
    });
  });

  describe('opções de lista', () => {
    const select = (key: string, extra: Partial<PortalScreen['fields'][number]> = {}) =>
      ({ key, label: key, type: 'select', ...extra });
    const screensWith = (fields: PortalScreen['fields'], portal: NonNullable<PortalScreen['portal']>) =>
      CITY_SCREENS.map((screen) => (screen.id === 'invoices'
        ? { ...screen, fields: [...screen.fields, ...fields], portal: { ...screen.portal!, ...portal } }
        : screen));
    const contextOf = async (fake: ReturnType<typeof makeFakePortalRepository>) => {
      fake.users.set('ana', { userId: 'ana', email: 'ana@acme.com', displayName: 'Ana', subjectKeys: ['companies/acme'] });
      const context = await makeGetPortalContextUseCase(fake.repo).execute({
        tenantId: TENANT, userId: 'ana', tenant: { name: 'Salvador', logoURL: null }, locale: 'pt-BR', resolve: (value) => value.toUpperCase(),
      });
      return context.screens.find((screen) => screen.id === 'invoices')!;
    };

    it('o campo exposto leva as opções da lista do escritório, com rótulo traduzido e cor', async () => {
      const fake = makeFakePortalRepository(screensWith(
        [select('kind', { lookupCollection: 'invoiceKinds' })],
        { subject: { field: 'companyId' }, fields: ['number', 'kind'] },
      ));
      fake.lookups.set('invoiceKinds', [{ key: 'service', label: '@acme/kind.service', color: 'success' }, { key: 'goods', label: 'Goods' }]);

      const invoices = await contextOf(fake);

      expect(invoices.fields.find((field) => field.key === 'kind')?.options).toEqual([
        { key: 'service', label: '@ACME/KIND.SERVICE', color: 'success' },
        { key: 'goods', label: 'GOODS' },
      ]);
    });

    it('criar e alterar levam as opções também — inclusive de campo que só se preenche', async () => {
      const fake = makeFakePortalRepository(screensWith(
        [select('kind', { lookupCollection: 'invoiceKinds' }), select('presence', { lookupCollection: 'presences' })],
        { subject: { field: 'companyId' }, fields: ['number', 'presence'], create: { fields: ['kind'] }, edit: { fields: ['presence'] } },
      ));
      fake.lookups.set('invoiceKinds', [{ key: 'service', label: 'Service' }]);
      fake.lookups.set('presences', [{ key: 'online', label: 'Online' }]);

      const invoices = await contextOf(fake);

      expect(invoices.create?.fields.find((field) => field.key === 'kind')?.options).toEqual([{ key: 'service', label: 'SERVICE' }]);
      expect(invoices.edit?.fields.find((field) => field.key === 'presence')?.options).toEqual([{ key: 'online', label: 'ONLINE' }]);
    });

    it('só as listas dos campos expostos são lidas', async () => {
      const fake = makeFakePortalRepository(screensWith(
        [select('kind', { lookupCollection: 'invoiceKinds' }), select('risk', { lookupCollection: 'riskLevels' })],
        { subject: { field: 'companyId' }, fields: ['number', 'kind'] },
      ));
      const read = vi.spyOn(fake.repo, 'getLookupOptions');

      await contextOf(fake);

      expect(read.mock.calls.map(([, collection]) => collection)).toEqual(['invoiceKinds']);
    });

    it('nunca lê como lista a coleção de uma tela, nem uma do sistema', async () => {
      const fake = makeFakePortalRepository(screensWith(
        [select('kind', { lookupCollection: 'inspections' }), select('who', { lookupCollection: 'portalUsers' })],
        { subject: { field: 'companyId' }, fields: ['number', 'kind', 'who'] },
      ));
      const read = vi.spyOn(fake.repo, 'getLookupOptions');

      const invoices = await contextOf(fake);

      expect(read).not.toHaveBeenCalled();
      expect(invoices.fields.find((field) => field.key === 'kind')?.options).toBeUndefined();
    });

    it('as declaradas no campo vêm antes, e a cor delas só sai em lista colorida', async () => {
      const declared = [{ key: 'urgent', label: 'Urgent', color: 'danger' }];
      const fake = makeFakePortalRepository(screensWith(
        [
          select('kind', { lookupCollection: 'invoiceKinds', options: declared }),
          select('flag', { options: declared, optionsColored: true }),
        ],
        { subject: { field: 'companyId' }, fields: ['number', 'kind', 'flag'] },
      ));
      fake.lookups.set('invoiceKinds', [{ key: 'urgent', label: 'Repetida' }, { key: 'normal', label: 'Normal' }]);

      const invoices = await contextOf(fake);

      expect(invoices.fields.find((field) => field.key === 'kind')?.options).toEqual([
        { key: 'urgent', label: 'URGENT' },
        { key: 'normal', label: 'NORMAL' },
      ]);
      expect(invoices.fields.find((field) => field.key === 'flag')?.options).toEqual([{ key: 'urgent', label: 'URGENT', color: 'danger' }]);
    });

    it('a lista do kernel leva só o que está gravado — o kernel não traz opção nenhuma', async () => {
      const fake = makeFakePortalRepository(screensWith(
        [select('docType', { lookupCollection: 'documentTypes' })],
        { subject: { field: 'companyId' }, fields: ['number', 'docType'] },
      ));

      expect((await contextOf(fake)).fields.find((field) => field.key === 'docType')?.options).toBeUndefined();

      fake.lookups.set('documentTypes', [{ key: 'Invoice', label: 'Invoice' }]);
      expect((await contextOf(fake)).fields.find((field) => field.key === 'docType')?.options)
        .toEqual([{ key: 'Invoice', label: 'INVOICE' }]);
    });

    it('a lista que falha ao ser lida não derruba o portal', async () => {
      const fake = makeFakePortalRepository(screensWith(
        [select('kind', { lookupCollection: 'invoiceKinds' })],
        { subject: { field: 'companyId' }, fields: ['number', 'kind'] },
      ));
      vi.spyOn(fake.repo, 'getLookupOptions').mockRejectedValue(new Error('unavailable'));

      const invoices = await contextOf(fake);

      expect(invoices.fields.find((field) => field.key === 'kind')?.options).toBeUndefined();
    });
  });

  describe('máscara e busca externa de quem preenche', () => {
    const ZIP_LOOKUP = { provider: 'com.acme/zip-lookup', map: { street: 'street' } };
    const screens = CITY_SCREENS.map((screen) => (screen.id === 'invoices'
      ? {
        ...screen,
        fields: [
          ...screen.fields,
          { key: 'zip', label: 'Zip', type: 'masked', mask: 'com.acme/zip', onChangeLookup: ZIP_LOOKUP },
          { key: 'street', label: 'Street', type: 'text' },
        ],
        portal: { ...screen.portal!, fields: ['number', 'zip', 'street'], create: { fields: ['zip', 'street'] }, edit: { fields: ['zip'] } },
      }
      : screen));
    const fieldInputs = {
      fieldRulePresets: [{ key: 'com.acme/zip', label: 'Zip', mask: { templates: ['#####-###'], inputMode: 'numeric' as const } }],
      lookupProviders: [{
        key: 'com.acme/zip-lookup',
        label: 'Zip lookup',
        request: { url: 'https://zip.example.com/{value}.json' },
        map: { street: 'logradouro' },
        errorMessage: '@com.acme/zip.failed',
      }],
    };
    const invoicesOf = async (inputs?: typeof fieldInputs) => {
      const fake = makeFakePortalRepository(screens);
      fake.users.set('ana', { userId: 'ana', email: 'ana@acme.com', displayName: 'Ana', subjectKeys: ['companies/acme'] });
      const context = await makeGetPortalContextUseCase(fake.repo).execute({
        tenantId: TENANT, userId: 'ana', tenant: { name: 'Salvador', logoURL: null }, locale: 'pt-BR',
        resolve: (value) => value.toUpperCase(), fieldInputs: inputs,
      });
      return context.screens.find((screen) => screen.id === 'invoices')!;
    };

    it('criar e alterar levam o molde da máscara e o provedor resolvidos nas extensões ligadas', async () => {
      const invoices = await invoicesOf(fieldInputs);

      for (const zip of [invoices.create?.fields[0], invoices.edit?.fields[0]]) {
        expect(zip).toMatchObject({ key: 'zip', mask: { templates: ['#####-###'], inputMode: 'numeric' } });
        expect(zip?.lookup?.binding).toEqual(ZIP_LOOKUP);
        expect(zip?.lookup?.provider).toMatchObject({ key: 'com.acme/zip-lookup', errorMessage: '@COM.ACME/ZIP.FAILED' });
      }
      expect(invoices.create?.fields[1]).toEqual({ key: 'street', label: 'STREET', type: 'text', required: false });
    });

    it('o campo só exibido não leva nada disso: quem só lê não digita', async () => {
      const invoices = await invoicesOf(fieldInputs);

      expect(invoices.fields.find((field) => field.key === 'zip')).toEqual({ key: 'zip', label: 'ZIP', type: 'masked' });
    });

    it('sem a extensão que declara, o campo sai como sempre saiu', async () => {
      const invoices = await invoicesOf();

      expect(invoices.create?.fields[0]).toEqual({ key: 'zip', label: 'ZIP', type: 'masked', required: false });
    });
  });

  it('quem não é convidado não recebe nada', async () => {
    const fake = makeFakePortalRepository(CITY_SCREENS);
    await expect(makeGetPortalContextUseCase(fake.repo).execute({
      tenantId: TENANT, userId: 'intruso', tenant: { name: 'Salvador', logoURL: null }, locale: 'pt-BR', resolve: (value) => value,
    })).rejects.toThrow('@core.tenant/portal.not-invited');
  });
});

describe('o convidado cria um registro', () => {
  const screens = CITY_SCREENS.map((screen) => (screen.id === 'invoices'
    ? { ...screen, portal: { ...screen.portal!, create: { fields: ['number', 'amount'] } } }
    : screen));

  const setup = () => {
    const fake = makeFakePortalRepository(screens);
    fake.users.set('ana', { userId: 'ana', email: 'ana@acme.com', displayName: 'Ana', subjectKeys: ['companies/acme'] });
    const written: Array<{ collection: string; data: Record<string, unknown>; userId: string }> = [];
    const write = vi.fn(async (input: { collection: string; data: Record<string, unknown>; userId: string }) => {
      written.push(input);
      return { ok: true as const, id: 'new-1' };
    });
    return { fake, written, submit: makeSubmitPortalRecordUseCase(fake.repo, write) };
  };

  it('grava só os campos preenchíveis, com o vínculo carimbado pelo servidor', async () => {
    const { submit, written } = setup();
    const result = await submit.execute({
      tenantId: TENANT, userId: 'ana', collection: 'invoices', linkRecordId: 'acme',
      data: { number: 'NF-9', amount: 50, auditNote: 'forjado', companyId: 'globex' },
    });
    expect(result).toEqual({ id: 'new-1' });
    expect(written[0]).toEqual({ tenantId: TENANT, collection: 'invoices', userId: 'ana', data: { number: 'NF-9', amount: 50, companyId: 'acme' } });
  });

  it('recusa vincular a uma empresa que não é do convidado', async () => {
    const { submit, written } = setup();
    await expect(submit.execute({ tenantId: TENANT, userId: 'ana', collection: 'invoices', linkRecordId: 'globex', data: { number: 'X' } }))
      .rejects.toThrow('@core.tenant/portal.create.denied');
    expect(written).toEqual([]);
  });

  it('recusa quem não é convidado, e a tela que não aceita criação', async () => {
    const { submit } = setup();
    await expect(submit.execute({ tenantId: TENANT, userId: 'intruso', collection: 'invoices', linkRecordId: 'acme', data: {} }))
      .rejects.toThrow('@core.tenant/portal.create.denied');
    await expect(submit.execute({ tenantId: TENANT, userId: 'ana', collection: 'companies', linkRecordId: 'acme', data: {} }))
      .rejects.toThrow('@core.tenant/portal.create.denied');
  });

  it('pelo pai, só vincula a uma projeção em que o convidado está', async () => {
    const childScreens = screens.map((screen) => (screen.id === 'invoiceItems'
      ? { ...screen, portal: { ...screen.portal!, create: { fields: ['description'] } } }
      : screen));
    const fake = makeFakePortalRepository(childScreens);
    fake.users.set('ana', { userId: 'ana', email: 'ana@acme.com', displayName: 'Ana', subjectKeys: ['companies/acme'] });
    fake.projections.set('invoices__nf1', {
      collection: 'invoices', recordId: 'nf1', screenId: 'invoices', subjectKeys: ['companies/acme'],
      audience: ['ana'], title: '', data: {}, labels: {}, parentKeys: ['companies/acme'], parentKey: 'companies/acme', editable: false, portalOwner: null,
    });
    const write = vi.fn(async () => ({ ok: true as const, id: 'it-1' }));
    const submit = makeSubmitPortalRecordUseCase(fake.repo, write);

    await submit.execute({ tenantId: TENANT, userId: 'ana', collection: 'invoiceItems', linkRecordId: 'nf1', data: { description: 'Serviço' } });
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ data: { description: 'Serviço', invoiceId: 'nf1' } }));
    await expect(submit.execute({ tenantId: TENANT, userId: 'ana', collection: 'invoiceItems', linkRecordId: 'nf2', data: {} }))
      .rejects.toThrow('@core.tenant/portal.create.denied');
  });

  it('o vínculo pela coleção chega à tela do portal, mesmo com a âncora sem portal listada antes', async () => {
    const extensionScreens = EXTENSION_CITY_SCREENS.map((screen) => (screen.id === 'city_invoices'
      ? { ...screen, portal: { ...screen.portal!, create: { fields: ['number'] } } }
      : screen));
    const fake = makeFakePortalRepository(extensionScreens);
    fake.users.set('ana', { userId: 'ana', email: 'ana@acme.com', displayName: 'Ana', subjectKeys: ['companies/acme'] });
    const write = vi.fn(async () => ({ ok: true as const, id: 'nf-9' }));

    await makeSubmitPortalRecordUseCase(fake.repo, write).execute({
      tenantId: TENANT, userId: 'ana', collection: 'invoices', linkRecordId: 'acme', data: { number: 'NF-9' },
    });
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ data: { number: 'NF-9', companyId: 'acme' } }));
  });

  it('a recusa da validação sobe com os parâmetros, para ser traduzida', async () => {
    const fake = makeFakePortalRepository(screens);
    fake.users.set('ana', { userId: 'ana', email: 'ana@acme.com', displayName: 'Ana', subjectKeys: ['companies/acme'] });
    const write = vi.fn(async () => ({ ok: false as const, error: '@core.automation/mutation.upsert.invalid', errorParams: { detail: 'number' } }));
    await expect(makeSubmitPortalRecordUseCase(fake.repo, write).execute({
      tenantId: TENANT, userId: 'ana', collection: 'invoices', linkRecordId: 'acme', data: {},
    })).rejects.toMatchObject({ name: 'PortalSubmissionInvalid', params: { detail: 'number' } });
  });
});

describe('o convidado anexa um documento', () => {
  const TYPES = [{ key: 'Recibo', label: 'Recibo' }, { key: 'Nota', label: 'Nota' }];

  const setup = (uploads: { types: string[] } | null = { types: ['Nota'] }, documents = true) => {
    const screens = CITY_SCREENS.map((screen) => (screen.id === 'invoices'
      ? { ...screen, portal: { ...screen.portal!, documents, uploads } }
      : screen));
    const fake = makeFakePortalRepository(screens);
    fake.users.set('ana', { userId: 'ana', email: 'ana@acme.com', displayName: 'Ana', subjectKeys: ['companies/acme'] });
    fake.projections.set('invoices__nf1', {
      collection: 'invoices', recordId: 'nf1', screenId: 'invoices', subjectKeys: ['companies/acme'],
      audience: ['ana'], title: '', data: {}, labels: {}, parentKeys: ['companies/acme'], parentKey: 'companies/acme', editable: false, portalOwner: null,
    });
    fake.staged.set('ana/up1', { data: Buffer.from('pdf'), contentType: 'application/pdf' });
    const attach = vi.fn(async () => ({ id: 'doc-1' }));
    const useCase = makeAttachPortalDocumentUseCase(fake.repo, { documentTypes: async () => TYPES, attach });
    const input = { tenantId: TENANT, userId: 'ana', userName: 'Ana', collection: 'invoices', recordId: 'nf1', uploadId: 'up1', name: 'nota.pdf', type: 'Nota' };
    return { fake, attach, useCase, input };
  };

  it('anexa com um tipo permitido, e limpa a espera', async () => {
    const { useCase, input, attach, fake } = setup();
    expect(await useCase.execute(input)).toEqual({ id: 'doc-1' });
    expect(attach).toHaveBeenCalledWith(expect.objectContaining({ type: 'Nota', contentType: 'application/pdf', userId: 'ana' }));
    expect(fake.staged.size).toBe(0);
  });

  it('o tipo é escolhido entre os da tela — nunca um novo, nem um que a tela não oferece', async () => {
    const { useCase, input, attach } = setup();
    await expect(useCase.execute({ ...input, type: 'Inventado' })).rejects.toThrow('@core.tenant/portal.upload.type-invalid');
    await expect(useCase.execute({ ...input, type: 'Recibo' })).rejects.toThrow('@core.tenant/portal.upload.type-invalid');
    expect(attach).not.toHaveBeenCalled();
  });

  it('ver documentos não dá o direito de anexar', async () => {
    const { useCase, input } = setup(null);
    await expect(useCase.execute(input)).rejects.toThrow('@core.tenant/portal.upload.denied');
  });

  it('o registro de outra pessoa é recusado', async () => {
    const { useCase, input, fake } = setup();
    fake.users.set('bia', { userId: 'bia', email: 'bia@globex.com', displayName: 'Bia', subjectKeys: ['companies/globex'] });
    fake.staged.set('bia/up1', { data: Buffer.from('x'), contentType: 'application/pdf' });
    await expect(useCase.execute({ ...input, userId: 'bia' })).rejects.toThrow('@core.tenant/portal.upload.denied');
  });

  it('sem o arquivo na espera, recusa — e grande demais, recusa e limpa', async () => {
    const { useCase, input, fake } = setup();
    await expect(useCase.execute({ ...input, uploadId: 'nada' })).rejects.toThrow('@core.tenant/portal.upload.missing');
    fake.staged.set('ana/big', { data: Buffer.alloc(21 * 1024 * 1024), contentType: 'application/pdf' });
    await expect(useCase.execute({ ...input, uploadId: 'big' })).rejects.toThrow('@core.tenant/portal.upload.too-large');
    expect(fake.staged.has('ana/big')).toBe(false);
  });
});

describe('o convidado altera um registro', () => {
  const setup = (
    edit: { fields: string[]; when?: string; onlyOwn?: boolean } | null,
    record: Record<string, unknown> = {},
    visibleWhen?: string,
  ) => {
    const screens = CITY_SCREENS.map((screen) => (screen.id === 'invoices'
      ? { ...screen, portal: { ...screen.portal!, ...(edit ? { edit } : {}), ...(visibleWhen ? { visibleWhen } : {}) } }
      : screen));
    const fake = makeFakePortalRepository(screens);
    fake.users.set('ana', { userId: 'ana', email: 'ana@acme.com', displayName: 'Ana', subjectKeys: ['companies/acme'] });
    fake.users.set('bia', { userId: 'bia', email: 'bia@acme.com', displayName: 'Bia', subjectKeys: ['companies/acme'] });
    fake.records.set('invoices/nf1', { number: '1', amount: 10, auditNote: 'x', companyId: 'acme', status: 'draft', ...record });
    fake.projections.set('invoices__nf1', {
      collection: 'invoices', recordId: 'nf1', screenId: 'invoices', subjectKeys: ['companies/acme'],
      audience: ['ana', 'bia'], title: '', data: {}, labels: {}, parentKeys: ['companies/acme'], parentKey: 'companies/acme', editable: true, portalOwner: null,
    });
    const write = vi.fn(async () => ({ ok: true as const, id: 'nf1' }));
    const useCase = makeUpdatePortalRecordUseCase(fake.repo, write);
    const input = { tenantId: TENANT, userId: 'ana', collection: 'invoices', recordId: 'nf1', data: {} as Record<string, unknown> };
    return { fake, write, useCase, input };
  };

  it('grava só os campos editáveis — o vínculo e o que não está exposto são descartados', async () => {
    const { useCase, input, write } = setup({ fields: ['amount'] });
    await useCase.execute({ ...input, data: { amount: 20, companyId: 'globex', auditNote: 'hack' } });
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ recordId: 'nf1', data: { amount: 20 } }));
  });

  it('a tela sem edição declarada recusa', async () => {
    const { useCase, input, write } = setup(null);
    await expect(useCase.execute({ ...input, data: { amount: 20 } })).rejects.toThrow('@core.tenant/portal.edit.denied');
    expect(write).not.toHaveBeenCalled();
  });

  it('a condição vale sobre o registro INTEIRO de agora, e a inválida fecha', async () => {
    const open = setup({ fields: ['amount'], when: 'status == "draft"' });
    await open.useCase.execute({ ...open.input, data: { amount: 20 } });
    expect(open.write).toHaveBeenCalled();

    const closed = setup({ fields: ['amount'], when: 'status == "draft"' }, { status: 'filed' });
    await expect(closed.useCase.execute({ ...closed.input, data: { amount: 20 } })).rejects.toThrow('@core.tenant/portal.edit.denied');

    const broken = setup({ fields: ['amount'], when: 'status ==' });
    await expect(broken.useCase.execute({ ...broken.input, data: { amount: 20 } })).rejects.toThrow('@core.tenant/portal.edit.denied');
  });

  it('o registro que deixou de passar no visibleWhen é recusado, mesmo com a projeção ainda de pé', async () => {
    const visible = setup({ fields: ['amount'] }, { kind: 'revenue' }, 'kind == "revenue"');
    await visible.useCase.execute({ ...visible.input, data: { amount: 20 } });
    expect(visible.write).toHaveBeenCalled();

    const hidden = setup({ fields: ['amount'] }, { kind: 'expense' }, 'kind == "revenue"');
    await expect(hidden.useCase.execute({ ...hidden.input, data: { amount: 20 } })).rejects.toThrow('@core.tenant/portal.edit.denied');
    expect(hidden.write).not.toHaveBeenCalled();
  });

  it('com onlyOwn, só quem criou o registro pelo portal altera', async () => {
    const { useCase, input, write } = setup({ fields: ['amount'], onlyOwn: true }, { createdBy: 'ana', createdVia: 'portal' });
    await useCase.execute({ ...input, data: { amount: 20 } });
    expect(write).toHaveBeenCalledTimes(1);
    await expect(useCase.execute({ ...input, userId: 'bia', data: { amount: 30 } })).rejects.toThrow('@core.tenant/portal.edit.denied');

    const office = setup({ fields: ['amount'], onlyOwn: true }, { createdBy: 'ana', createdVia: 'ui' });
    await expect(office.useCase.execute({ ...office.input, data: { amount: 20 } })).rejects.toThrow('@core.tenant/portal.edit.denied');
  });

  it('quem não vê o registro é recusado', async () => {
    const { useCase, input, fake } = setup({ fields: ['amount'] });
    fake.users.set('caio', { userId: 'caio', email: 'caio@globex.com', displayName: 'Caio', subjectKeys: ['companies/globex'] });
    await expect(useCase.execute({ ...input, userId: 'caio', data: { amount: 1 } })).rejects.toThrow('@core.tenant/portal.edit.denied');
  });

  it('a recusa da validação sobe com os parâmetros, para ser traduzida', async () => {
    const { useCase, input, write } = setup({ fields: ['amount'] });
    write.mockResolvedValueOnce({ ok: false as const, error: '@core.automation/mutation.upsert.invalid', errorParams: { detail: 'amount' } } as never);
    await expect(useCase.execute({ ...input, data: { amount: -1 } }))
      .rejects.toMatchObject({ name: 'PortalSubmissionInvalid', params: { detail: 'amount' } });
  });
});

describe('o convite vale no instante, não quando o audience for refeito', () => {
  it('sujeito revogado: o audience ainda o lista, e mesmo assim tudo é recusado', async () => {
    const screens = CITY_SCREENS.map((screen) => (screen.id === 'invoices'
      ? { ...screen, portal: { ...screen.portal!, documents: true, uploads: { types: [] }, edit: { fields: ['amount'] } } }
      : screen));
    const fake = makeFakePortalRepository(screens);
    // Ana perdeu a Acme e ficou só com a Globex; o gatilho ainda não refez o audience da nota.
    fake.users.set('ana', { userId: 'ana', email: 'ana@acme.com', displayName: 'Ana', subjectKeys: ['companies/globex'] });
    fake.records.set('invoices/nf1', { number: '1', amount: 1, companyId: 'acme' });
    fake.projections.set('invoices__nf1', {
      collection: 'invoices', recordId: 'nf1', screenId: 'invoices', subjectKeys: ['companies/acme'],
      audience: ['ana'], title: '', data: {}, labels: {}, parentKeys: ['companies/acme'], parentKey: 'companies/acme', editable: true, portalOwner: null,
    });
    fake.documents.set('invoices/nf1/d1', { name: 'x.pdf', portalShared: true, url: 'https://x' });
    fake.staged.set('ana/up1', { data: Buffer.from('pdf'), contentType: 'application/pdf' });
    const write = vi.fn(async () => ({ ok: true as const, id: 'nf1' }));
    const attach = vi.fn(async () => ({ id: 'doc' }));

    await expect(makeUpdatePortalRecordUseCase(fake.repo, write).execute({
      tenantId: TENANT, userId: 'ana', collection: 'invoices', recordId: 'nf1', data: { amount: 2 },
    })).rejects.toThrow('@core.tenant/portal.edit.denied');
    await expect(makeGetPortalDocumentUrlUseCase(fake.repo, makeFakeRecordDocumentLinks(fake.documents, TENANT).links).execute({
      tenantId: TENANT, userId: 'ana', projectionId: 'invoices__nf1', documentId: 'd1',
    })).rejects.toThrow('@core.tenant/portal.document.unavailable');
    await expect(makeAttachPortalDocumentUseCase(fake.repo, { documentTypes: async () => [{ key: 'Nota', label: 'Nota' }], attach }).execute({
      tenantId: TENANT, userId: 'ana', userName: 'Ana', collection: 'invoices', recordId: 'nf1', uploadId: 'up1', name: 'a.pdf', type: 'Nota',
    })).rejects.toThrow('@core.tenant/portal.upload.denied');
    expect(write).not.toHaveBeenCalled();
    expect(attach).not.toHaveBeenCalled();
    // A recusa também limpa a espera — o arquivo não fica ocupando o escritório.
    expect(fake.staged.size).toBe(0);
  });
});


describe('o convite por identidade — `requiredClaim`', () => {
  const PROVIDER = {
    id: 'citizen', label: 'Citizen ID', issuer: 'https://id.example.test', clientId: 'c', scopes: [], claims: ['nationalId'],
  };
  const setup = (options: { emailLink?: boolean } = {}) => {
    const fake = makeFakePortalRepository(withInvites(CITY_SCREENS));
    fake.records.set('companies/acme', { name: 'Acme' });
    const { accounts } = accountsWith();
    const access = accessDeps(fake, accounts);
    access.identity.configs.set(TENANT, { settings: { emailLink: options.emailLink ?? true, providers: [PROVIDER] }, secrets: {} });
    return { fake, accounts, ...access, invite: makeInvitePortalUserUseCase(access.deps), revoke: makeRevokePortalUserUseCase(access.deps) };
  };
  const base = { tenantId: TENANT, tenantName: 'Salvador', email: 'Bia@Acme.com', subjectKey: 'companies/acme', actor: FISCAL };
  const claim = { name: 'nationalId', value: '123.456.789-00', normalize: 'digits' };

  it('não abre conta pelo e-mail nem grava a marca: só quem provar a claim o aceita', async () => {
    const { invite, fake, accounts, identity, audited } = setup();

    const result = await invite.execute({ ...base, requiredClaim: claim });

    expect(result).toEqual({ userId: '', created: false, granted: true, inviteId: 'inv-1' });
    expect(accounts.createAccount).not.toHaveBeenCalled();
    expect(accounts.findUserIdByEmail).not.toHaveBeenCalled();
    expect(fake.invites).toEqual([]);
    expect(fake.users.size).toBe(0);
    expect(identity.invites.get('inv-1')).toMatchObject({
      email: 'bia@acme.com', claim: { name: 'nationalId', value: '12345678900', normalize: 'digits' }, subjectKeys: ['companies/acme'],
    });
    expect(audited).toEqual([expect.objectContaining({ change: 'granted', claimName: 'nationalId' })]);
    expect(JSON.stringify(audited)).not.toContain('12345678900');
  });

  it('recusa a claim mal formada e a que nenhum provedor do escritório atesta', async () => {
    const { invite } = setup();
    await expect(invite.execute({ ...base, requiredClaim: { name: 'nationalId', value: '---', normalize: 'digits' } }))
      .rejects.toThrow('@core.tenant/portal.claim.value-missing');
    await expect(invite.execute({ ...base, requiredClaim: { name: 'nationalId', value: '1', normalize: 'rot13' } }))
      .rejects.toThrow('@core.tenant/portal.claim.normalize-invalid');
    await expect(invite.execute({ ...base, requiredClaim: { name: 'taxId', value: '1' } }))
      .rejects.toThrow('@core.tenant/portal.claim.unattested');
  });

  it('o escritório que desligou o link de e-mail recusa o convite sem claim — pela tela e pela automação', async () => {
    const { invite, accounts } = setup({ emailLink: false });
    await expect(invite.execute(base)).rejects.toThrow('@core.tenant/portal.invite.identity-required');
    await expect(invite.execute({ ...base, origin: 'automation' })).rejects.toThrow('@core.tenant/portal.invite.identity-required');
    expect(accounts.createAccount).not.toHaveBeenCalled();
    expect((await invite.execute({ ...base, requiredClaim: claim })).granted).toBe(true);
  });

  it('pela automação, é idempotente pela claim: rodar de novo não grava nem conta no limite', async () => {
    const { invite, quotaUsed, audited } = setup();
    await invite.execute({ ...base, origin: 'automation', requiredClaim: claim });
    const again = await invite.execute({ ...base, origin: 'automation', requiredClaim: { ...claim, value: '12345678900' } });
    expect(again).toEqual({ userId: '', created: false, granted: false, inviteId: 'inv-1' });
    expect(quotaUsed()).toBe(1);
    expect(audited).toHaveLength(1);
  });

  it('revogar a conta que aceitou mexe no CONVITE — senão o próximo login devolveria o acesso', async () => {
    const { invite, revoke, identity, fake } = setup();
    await invite.execute({ ...base, requiredClaim: claim });
    await identity.identity.bind(TENANT, {
      userId: 'portal-id-x', tenantName: 'Salvador', email: 'bia@acme.com', displayName: 'Bia', invitedBy: 'fiscal',
      subject: 'person-1', verified: { provider: 'citizen', claim: { name: 'nationalId', value: '12345678900' }, level: null }, proofKeys: [],
    }, [identity.invites.get('inv-1')!]);
    expect(fake.users.get('portal-id-x')?.subjectKeys).toEqual(['companies/acme']);

    const result = await revoke.execute({ tenantId: TENANT, guest: { userId: 'portal-id-x' }, subjectKey: 'companies/acme', actor: FISCAL });

    expect(result.revoked).toBe(true);
    expect(identity.invites.has('inv-1')).toBe(false);
    expect(fake.users.has('portal-id-x')).toBe(false);
  });

  it('a automação revoga pelo e-mail de contato o convite que ninguém aceitou ainda', async () => {
    const { invite, revoke, identity } = setup();
    await invite.execute({ ...base, requiredClaim: claim });
    const result = await revoke.execute({
      tenantId: TENANT, guest: { email: 'bia@acme.com' }, subjectKey: 'companies/acme', actor: FISCAL, origin: 'automation',
    });
    expect(result).toEqual({ userId: null, revoked: true });
    expect(identity.invites.size).toBe(0);
  });
});

describe('o convidado suspenso — o escritório desligou o método por que ele entra', () => {
  it('o convite continua, e nada abre: contexto, criação e documento recusados', async () => {
    const screens = CITY_SCREENS.map((screen) => (screen.id === 'invoices'
      ? { ...screen, portal: { ...screen.portal!, documents: true, create: { fields: ['number'] } } }
      : screen));
    const fake = makeFakePortalRepository(screens);
    fake.users.set('ana', { userId: 'ana', email: 'ana@acme.com', displayName: 'Ana', subjectKeys: ['companies/acme'], suspended: true });
    fake.projections.set('invoices__nf1', {
      collection: 'invoices', recordId: 'nf1', screenId: 'invoices', subjectKeys: ['companies/acme'],
      audience: ['ana'], title: '', data: {}, labels: {}, parentKeys: ['companies/acme'], parentKey: 'companies/acme', editable: true, portalOwner: null,
    });
    fake.documents.set('invoices/nf1/d1', { name: 'x.pdf', portalShared: true, url: 'https://x' });
    const write = vi.fn(async () => ({ ok: true as const, id: 'new' }));

    await expect(makeGetPortalContextUseCase(fake.repo).execute({
      tenantId: TENANT, userId: 'ana', tenant: { name: 'Salvador', logoURL: null }, locale: 'pt-BR', resolve: (value) => value,
    })).rejects.toThrow('@core.tenant/portal.signin.identity-required');
    await expect(makeSubmitPortalRecordUseCase(fake.repo, write).execute({
      tenantId: TENANT, userId: 'ana', collection: 'invoices', linkRecordId: 'acme', data: { number: '2' },
    })).rejects.toThrow('@core.tenant/portal.create.denied');
    await expect(makeGetPortalDocumentUrlUseCase(fake.repo, makeFakeRecordDocumentLinks(fake.documents, TENANT).links).execute({
      tenantId: TENANT, userId: 'ana', projectionId: 'invoices__nf1', documentId: 'd1',
    })).rejects.toThrow('@core.tenant/portal.document.unavailable');
    expect(write).not.toHaveBeenCalled();
  });
});
