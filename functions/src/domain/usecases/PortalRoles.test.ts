import { describe, expect, it, vi } from 'vitest';
import {
  makeGetPortalContextUseCase,
  makeInvitePortalUserUseCase,
  makeListPortalCreateTargetsUseCase,
  makeRevokePortalUserUseCase,
  makeSubmitPortalRecordUseCase,
  type PortalAccessAuditEntry,
  type PortalAccessDeps,
} from './PortalAccessUseCases';
import { makeListPortalRecordActionsUseCase, makeRunPortalRecordActionUseCase } from './PortalActionUseCases';
import { makeProjectPortalRecordUseCase } from './PortalProjectionUseCases';
import { CITY_SCREENS, makeFakePortalRepository } from '../repositories/fakePortalRepository';
import type { IPortalAccountService, PortalScreen } from '../repositories/IPortalRepository';
import { makeFakePortalIdentity } from '../repositories/fakePortalIdentity';

const TENANT = 'salvador';
const FISCAL = { userId: 'fiscal', userName: 'Fiscal' };
const MOTOR = { userId: 'workflow-engine', userName: '@core.automation/run.actor' };

/** A tela de pedidos da empresa: o convidado cria um pedido PARA ela, e só o sócio pode. */
const screensWith = (when: string | null, extra: (screen: PortalScreen) => PortalScreen = (screen) => screen): PortalScreen[] =>
  CITY_SCREENS.map((screen) => {
    if (screen.id === 'companies') return extra({ ...screen, portal: { ...screen.portal!, invites: { automation: true } } });
    if (screen.id === 'invoices') {
      return { ...screen, portal: { ...screen.portal!, create: { fields: ['number'], ...(when ? { when } : {}) } } };
    }
    return screen;
  });

const SOCIO_ONLY = '"socio" in actor.portalRoles';

const accounts = (existing: Record<string, string> = {}): IPortalAccountService => ({
  findUserIdByEmail: vi.fn(async (email: string) => (existing[email] ? { userId: existing[email], displayName: null } : null)),
  createAccount: vi.fn(async (email: string) => `uid-${email}`),
});

const accessDeps = (fake: ReturnType<typeof makeFakePortalRepository>, service: IPortalAccountService) => {
  const audited: PortalAccessAuditEntry[] = [];
  let used = 0;
  const identity = makeFakePortalIdentity(fake.users);
  const deps: PortalAccessDeps = {
    repo: fake.repo,
    identity: identity.identity,
    signIn: identity.config,
    accounts: service,
    audit: async (entry) => { audited.push(entry); },
    quota: { consume: async () => { used += 1; return true; } },
    now: () => new Date('2026-10-31T14:00:00Z'),
  };
  return { deps, audited, quotaUsed: () => used, identity };
};

/** Dois convidados da MESMA empresa: Ana é sócia; Caio, o contador, não tem papel. */
const twoGuests = (when: string | null) => {
  const fake = makeFakePortalRepository(screensWith(when));
  fake.records.set('companies/acme', { name: 'Acme', taxId: '123', status: 'active' });
  fake.users.set('ana', {
    userId: 'ana', email: 'ana@acme.com', displayName: 'Ana', subjectKeys: ['companies/acme'],
    subjectRoles: [{ subjectKey: 'companies/acme', role: 'socio' }],
  });
  fake.users.set('caio', { userId: 'caio', email: 'caio@contab.com', displayName: 'Caio', subjectKeys: ['companies/acme'] });
  const write = vi.fn(async () => ({ ok: true as const, id: 'new-1' }));
  return {
    fake,
    write,
    submit: makeSubmitPortalRecordUseCase(fake.repo, write),
    targets: makeListPortalCreateTargetsUseCase(fake.repo),
  };
};

const request = (userId: string) => ({
  tenantId: TENANT, userId, collection: 'invoices', linkRecordId: 'acme', data: { number: 'P-1' },
});

describe('o papel do convidado decide quem cria pelo portal (EV-38)', () => {
  it('dois convidados do mesmo registro: o sócio cria, o que não tem papel é recusado', async () => {
    const { submit, write } = twoGuests(SOCIO_ONLY);

    await expect(submit.execute(request('ana'))).resolves.toEqual({ id: 'new-1' });
    await expect(submit.execute(request('caio'))).rejects.toThrow('@core.tenant/portal.create.denied');

    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ userId: 'ana', data: { number: 'P-1', companyId: 'acme' } }));
  });

  it('a consulta da casca responde o mesmo: o botão aparece só para quem cria', async () => {
    const { targets } = twoGuests(SOCIO_ONLY);
    const ask = (userId: string) => targets.execute({ tenantId: TENANT, userId, collection: 'invoices', linkRecordIds: ['acme', 'globex'] });

    expect(await ask('ana')).toEqual(['acme']);
    expect(await ask('caio')).toEqual([]);
    expect(await ask('intruso')).toEqual([]);
  });

  it('a condição lê o registro-PAI inteiro, inclusive o que não sai do escritório', async () => {
    const { fake, submit } = twoGuests(`status == "active" and ${SOCIO_ONLY}`);
    fake.records.set('companies/acme', { name: 'Acme', status: 'suspended' });

    await expect(submit.execute(request('ana'))).rejects.toThrow('@core.tenant/portal.create.denied');
  });

  it('o papel é do vínculo: sócio de outra empresa não é sócio desta', async () => {
    const { fake, submit } = twoGuests(SOCIO_ONLY);
    fake.users.set('caio', {
      userId: 'caio', email: 'caio@contab.com', displayName: 'Caio', subjectKeys: ['companies/acme', 'companies/beta'],
      subjectRoles: [{ subjectKey: 'companies/beta', role: 'socio' }],
    });

    await expect(submit.execute(request('caio'))).rejects.toThrow('@core.tenant/portal.create.denied');
  });

  it('dentro de um pai que não é o sujeito, os papéis vêm dos sujeitos da projeção dele', async () => {
    const screens = screensWith(null).map((screen) => (screen.id === 'invoiceItems'
      ? { ...screen, portal: { ...screen.portal!, create: { fields: ['description'], when: SOCIO_ONLY } } }
      : screen));
    const fake = makeFakePortalRepository(screens);
    fake.users.set('ana', {
      userId: 'ana', email: 'ana@acme.com', displayName: 'Ana', subjectKeys: ['companies/acme'],
      subjectRoles: [{ subjectKey: 'companies/acme', role: 'socio' }],
    });
    fake.users.set('caio', { userId: 'caio', email: 'caio@contab.com', displayName: 'Caio', subjectKeys: ['companies/acme'] });
    fake.records.set('invoices/nf1', { number: 'NF-1', companyId: 'acme' });
    await makeProjectPortalRecordUseCase(fake.repo).execute({
      tenantId: TENANT, collection: 'invoices', recordId: 'nf1', data: { number: 'NF-1', companyId: 'acme' },
    });
    const targets = makeListPortalCreateTargetsUseCase(fake.repo);
    const ask = (userId: string) => targets.execute({ tenantId: TENANT, userId, collection: 'invoiceItems', linkRecordIds: ['nf1'] });

    expect(await ask('ana')).toEqual(['nf1']);
    expect(await ask('caio')).toEqual([]);
  });

  it('a condição inválida fecha para todos', async () => {
    const { submit } = twoGuests('"socio" in (');
    await expect(submit.execute(request('ana'))).rejects.toThrow('@core.tenant/portal.create.denied');
  });

  it('sem `create.when`, todo convidado que vê o pai cria — e o pai nem é lido', async () => {
    const { fake, submit, targets } = twoGuests(null);
    const read = vi.spyOn(fake.repo, 'getRecord');

    await expect(submit.execute(request('caio'))).resolves.toEqual({ id: 'new-1' });
    expect(await targets.execute({ tenantId: TENANT, userId: 'caio', collection: 'invoices', linkRecordIds: ['acme'] })).toEqual(['acme']);
    expect(read).not.toHaveBeenCalled();
  });

  it('a consulta recusa mais pais do que o lote aceita', async () => {
    const { targets } = twoGuests(SOCIO_ONLY);
    const many = Array.from({ length: 51 }, (_, index) => `c${index}`);
    await expect(targets.execute({ tenantId: TENANT, userId: 'ana', collection: 'invoices', linkRecordIds: many }))
      .rejects.toThrow('@core.tenant/portal.create.denied');
  });

  it('o contexto avisa a casca que a tela tem condição, sem entregar a condição', async () => {
    const context = (when: string | null) => {
      const { fake } = twoGuests(when);
      return makeGetPortalContextUseCase(fake.repo).execute({
        tenantId: TENANT, userId: 'caio', tenant: { name: 'Salvador', logoURL: null }, locale: 'en', resolve: (value) => value,
      });
    };
    const conditional = (await context(SOCIO_ONLY)).screens.find((screen) => screen.collection === 'invoices')?.create;
    const plain = (await context(null)).screens.find((screen) => screen.collection === 'invoices')?.create;

    expect(conditional).toMatchObject({ conditional: true });
    expect(JSON.stringify(conditional)).not.toContain('portalRoles');
    expect(plain).not.toHaveProperty('conditional');
  });
});

describe('o convite dá o papel no vínculo (EV-38)', () => {
  const automation = { tenantId: TENANT, tenantName: 'Salvador', actor: MOTOR, origin: 'automation' as const, workflowId: 'wf-socio' };

  const setup = () => {
    const fake = makeFakePortalRepository(screensWith(SOCIO_ONLY));
    fake.records.set('companies/acme', { name: 'Acme' });
    fake.records.set('companies/beta', { name: 'Beta' });
    const service = accounts();
    const access = accessDeps(fake, service);
    const invite = makeInvitePortalUserUseCase(access.deps);
    const known = () => (service.findUserIdByEmail as ReturnType<typeof vi.fn>)
      .mockResolvedValue({ userId: 'uid-ana@acme.com', displayName: null });
    return { fake, service, ...access, invite, known, revoke: makeRevokePortalUserUseCase(access.deps) };
  };

  it('o vínculo novo nasce com o papel, e a Auditoria o diz', async () => {
    const { invite, fake, audited } = setup();

    const result = await invite.execute({ ...automation, email: 'ana@acme.com', subjectKey: 'companies/acme', role: 'socio' });

    expect(result).toEqual({ userId: 'uid-ana@acme.com', created: true, granted: true, roleChanged: true });
    expect(fake.users.get('uid-ana@acme.com')?.subjectRoles).toEqual([{ subjectKey: 'companies/acme', role: 'socio' }]);
    expect(audited).toEqual([expect.objectContaining({ change: 'granted', role: 'socio', subjectKey: 'companies/acme' })]);
  });

  it('convidar de novo com o mesmo papel não escreve nada; com outro, troca o papel sem gastar vaga da hora', async () => {
    const { invite, fake, audited, quotaUsed, known } = setup();
    const input = { ...automation, email: 'ana@acme.com', subjectKey: 'companies/acme' };
    await invite.execute({ ...input, role: 'socio' });
    known();
    const grant = vi.spyOn(fake.repo, 'grantSubject');

    expect(await invite.execute({ ...input, role: 'socio' })).toEqual({ userId: 'uid-ana@acme.com', created: false, granted: false });
    expect(grant).not.toHaveBeenCalled();

    const changed = await invite.execute({ ...input, role: 'administrador' });
    expect(changed).toEqual({ userId: 'uid-ana@acme.com', created: false, granted: false, roleChanged: true });
    expect(fake.users.get('uid-ana@acme.com')?.subjectRoles).toEqual([{ subjectKey: 'companies/acme', role: 'administrador' }]);
    expect(quotaUsed()).toBe(1);
    expect(audited.map((entry) => [entry.change, entry.role])).toEqual([['granted', 'socio'], ['role', 'administrador']]);
  });

  it('convidar sem papel não tira o papel que alguém deu — e o convite sem papel responde como antes', async () => {
    const { invite, fake, known } = setup();
    const input = { tenantId: TENANT, tenantName: 'Salvador', actor: FISCAL, email: 'ana@acme.com' };
    await invite.execute({ ...input, subjectKey: 'companies/acme', role: 'socio' });
    known();

    expect(await invite.execute({ ...input, subjectKey: 'companies/acme' })).toEqual({ userId: 'uid-ana@acme.com', created: false, granted: false });
    expect(await invite.execute({ ...input, subjectKey: 'companies/beta' })).toEqual({ userId: 'uid-ana@acme.com', created: false, granted: true });
    expect(fake.users.get('uid-ana@acme.com')).toMatchObject({
      subjectKeys: ['companies/acme', 'companies/beta'],
      subjectRoles: [{ subjectKey: 'companies/acme', role: 'socio' }],
    });
  });

  it('revogar o sujeito leva o papel junto', async () => {
    const { invite, revoke, fake, known } = setup();
    const input = { tenantId: TENANT, tenantName: 'Salvador', actor: FISCAL, email: 'ana@acme.com' };
    await invite.execute({ ...input, subjectKey: 'companies/acme', role: 'socio' });
    known();
    await invite.execute({ ...input, subjectKey: 'companies/beta', role: 'contador' });

    await revoke.execute({ tenantId: TENANT, guest: { userId: 'uid-ana@acme.com' }, subjectKey: 'companies/acme', actor: FISCAL });

    expect(fake.users.get('uid-ana@acme.com')?.subjectRoles).toEqual([{ subjectKey: 'companies/beta', role: 'contador' }]);
  });

  it('o papel que não é chave é recusado antes de qualquer escrita', async () => {
    const { invite, fake, service, quotaUsed } = setup();
    for (const role of ['Sócio', 'socio administrador', 'x'.repeat(41), 42]) {
      await expect(invite.execute({ ...automation, email: 'ana@acme.com', subjectKey: 'companies/acme', role }))
        .rejects.toThrow('@core.tenant/portal.role.invalid');
    }
    expect(service.createAccount).not.toHaveBeenCalled();
    expect(fake.users.size).toBe(0);
    expect(quotaUsed()).toBe(0);
  });

  it('no convite por identidade, o papel chega à conta que já o aceitou', async () => {
    const { invite, fake, identity } = setup();
    identity.configs.set(TENANT, {
      settings: {
        emailLink: true,
        providers: [{ id: 'gov', label: 'Gov', issuer: 'https://id.example.test', clientId: 'c', scopes: [], claims: ['nationalId'] }],
      },
      secrets: {},
    });
    const claim = { name: 'nationalId', value: '12345678900' };
    const input = { ...automation, email: 'ana@acme.com', subjectKey: 'companies/acme', requiredClaim: claim };
    const first = await invite.execute(input);
    const accepted = identity.invites.get(first.inviteId!)!;
    identity.invites.set(accepted.id, { ...accepted, boundUserIds: ['gov-ana'] });
    fake.users.set('gov-ana', { userId: 'gov-ana', email: 'ana@acme.com', displayName: 'Ana', subjectKeys: ['companies/acme'] });

    const second = await invite.execute({ ...input, role: 'socio' });

    expect(second).toMatchObject({ granted: false, roleChanged: true, userId: 'gov-ana' });
    expect(fake.users.get('gov-ana')?.subjectRoles).toEqual([{ subjectKey: 'companies/acme', role: 'socio' }]);
  });
});

describe('o papel nas ações do registro aberto (EV-38)', () => {
  it('`actor.portalRoles` vale em hiddenWhen, avaliado no servidor para cada convidado', async () => {
    const fake = makeFakePortalRepository(screensWith(null, (screen) => ({
      ...screen,
      viewActionIds: ['act-request'],
      portal: { ...screen.portal!, actions: ['request'] },
    })));
    fake.users.set('ana', {
      userId: 'ana', email: 'ana@acme.com', displayName: 'Ana', subjectKeys: ['companies/acme'],
      subjectRoles: [{ subjectKey: 'companies/acme', role: 'socio' }],
    });
    fake.users.set('caio', { userId: 'caio', email: 'caio@contab.com', displayName: 'Caio', subjectKeys: ['companies/acme'] });
    fake.actions.set('act-request', {
      id: 'act-request', key: 'request', title: 'Request', icon: 'add', workflowId: 'wf-request', enabled: true,
      confirmMessage: null, danger: false, hiddenWhen: `!(${SOCIO_ONLY})`,
    });
    const company = { name: 'Acme' };
    fake.records.set('companies/acme', company);
    await makeProjectPortalRecordUseCase(fake.repo).execute({ tenantId: TENANT, collection: 'companies', recordId: 'acme', data: company });
    const ran = vi.fn(async () => ({ ok: true as const, outputs: {} }));
    const open = (userId: string) => ({ tenantId: TENANT, userId, projectionId: 'companies__acme', resolve: (value: string) => value });

    expect((await makeListPortalRecordActionsUseCase(fake.repo).execute(open('ana'))).map((action) => action.id)).toEqual(['act-request']);
    expect(await makeListPortalRecordActionsUseCase(fake.repo).execute(open('caio'))).toEqual([]);
    await expect(makeRunPortalRecordActionUseCase(fake.repo, ran).execute({ ...open('caio'), actionId: 'act-request' }))
      .rejects.toThrow('@core.tenant/portal.action.unavailable');
    expect(ran).not.toHaveBeenCalled();
  });
});
