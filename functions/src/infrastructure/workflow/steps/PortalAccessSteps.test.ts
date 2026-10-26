import { describe, expect, it, vi } from 'vitest';
import { makePortalInviteStepDefinition, makePortalRevokeStepDefinition } from './PortalAccessSteps';
import type { PortalAccessStepServices } from './PortalAccessSteps';
import {
  makeInvitePortalUserUseCase,
  makeRevokePortalUserUseCase,
  type PortalAccessAuditEntry,
} from '../../../domain/usecases/PortalAccessUseCases';
import type { DispatchNotificationRequest } from '../../../domain/usecases/DispatchNotificationUseCase';
import { CITY_SCREENS, makeFakePortalRepository } from '../../../domain/repositories/fakePortalRepository';
import type { IPortalAccountService, PortalScreen } from '../../../domain/repositories/IPortalRepository';
import type { WorkflowActor, WorkflowContext } from '../../../domain/entities/WorkflowContext';
import type { WorkflowEvent } from '../../../domain/entities/Workflow';
import { makeFakePortalIdentity } from '../../../domain/repositories/fakePortalIdentity';

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

const SCREENS: PortalScreen[] = CITY_SCREENS.map((screen) =>
  (screen.id === 'companies' && screen.portal ? { ...screen, portal: { ...screen.portal, invites: { automation: true } } } : screen));

const contextWith = (actor?: WorkflowActor): WorkflowContext => ({
  event: { id: 'e1', tenantId: 't1', name: 'representatives.saved', payload: {}, timestamp: new Date() } as WorkflowEvent,
  outputs: {},
  variables: {},
  services: { logger, now: () => new Date() },
  logger,
  execution: { id: 'x1', workflowDefinitionId: 'wf-cred', tenantId: 't1' },
  ...(actor ? { actor } : {}),
});

const setup = (options: { screens?: PortalScreen[]; emailDelivered?: number; quota?: number } = {}) => {
  const fake = makeFakePortalRepository(options.screens ?? SCREENS);
  const identity = makeFakePortalIdentity(fake.users);
  fake.records.set('companies/acme', { name: 'Acme' });
  const accountIds = new Map<string, string>();
  const accounts: IPortalAccountService = {
    findUserIdByEmail: async (email) => (accountIds.has(email) ? { userId: accountIds.get(email)!, displayName: null } : null),
    createAccount: async (email) => {
      accountIds.set(email, `uid-${email}`);
      return `uid-${email}`;
    },
  };
  const audited: PortalAccessAuditEntry[] = [];
  let left = options.quota ?? Number.POSITIVE_INFINITY;
  const deps = {
    repo: fake.repo,
    identity: identity.identity,
    signIn: identity.config,
    accounts,
    audit: async (entry: PortalAccessAuditEntry) => { audited.push(entry); },
    quota: { consume: async () => (left-- > 0) },
    now: () => new Date(),
  };
  const requests: DispatchNotificationRequest[] = [];
  const services: PortalAccessStepServices = {
    invite: makeInvitePortalUserUseCase(deps),
    revoke: makeRevokePortalUserUseCase(deps),
    dispatchNotification: {
      execute: async (request) => {
        requests.push(request);
        const email = options.emailDelivered ?? 1;
        return {
          recipients: email,
          delivered: { audit: 0, inApp: 0, email, push: 0 },
          failed: { audit: 0, inApp: 0, email: 1 - email, push: 0 },
          issues: email ? [] : [{ message: '@core.automation/step.notify.email.not-configured' }],
        };
      },
    },
    tenantName: async () => 'Salvador',
    officeLocale: async () => 'pt-BR',
  };
  const invite = (inputs: Record<string, unknown>, context = contextWith()) =>
    makePortalInviteStepDefinition(services).createExecutor().execute(inputs, context);
  const revoke = (inputs: Record<string, unknown>, context = contextWith()) =>
    makePortalRevokeStepDefinition(services).createExecutor().execute(inputs, context);
  return { fake, audited, requests, invite, revoke, identity };
};

const ANA = { subjectCollection: 'companies', subjectRecordId: 'acme', email: 'ana@acme.com' };

describe('passo portal-invite', () => {
  it('convida, publica o resultado e manda o e-mail de boas-vindas SÓ para quem foi convidado', async () => {
    const { fake, requests, invite } = setup();

    const result = await invite({ ...ANA, displayName: 'Ana' });

    expect(result).toMatchObject({
      success: true,
      message: '@core.automation/step.portal-invite.done',
      outputs: { guestId: 'uid-ana@acme.com', created: true, granted: true, emailed: true },
    });
    expect(fake.users.get('uid-ana@acme.com')).toMatchObject({ displayName: 'Ana', subjectKeys: ['companies/acme'] });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      audience: 'portal',
      recipientIds: ['uid-ana@acme.com'],
      target: { collection: 'companies', recordId: 'acme' },
      channels: { audit: false, inApp: false, email: true, push: false },
      params: { office: 'Salvador' },
      workflowId: 'wf-cred',
    });
  });

  it('rodar de novo não convida, não manda outro e-mail e não audita outra vez', async () => {
    const { audited, requests, invite } = setup();

    await invite(ANA);
    const again = await invite(ANA);

    expect(again).toMatchObject({
      success: true,
      message: '@core.automation/step.portal-invite.unchanged',
      outputs: { created: false, granted: false, emailed: false },
    });
    expect(requests).toHaveLength(1);
    expect(audited).toHaveLength(1);
  });

  it('sendEmail false convida sem avisar', async () => {
    const { requests, invite } = setup();
    const result = await invite({ ...ANA, sendEmail: false });
    expect(result.outputs).toMatchObject({ granted: true, emailed: false });
    expect(requests).toEqual([]);
  });

  it('o e-mail que não sai não desfaz o convite: o passo passa, e o log diz por quê', async () => {
    logger.warn.mockClear();
    const { fake, invite } = setup({ emailDelivered: 0 });

    const result = await invite(ANA);

    expect(result.success).toBe(true);
    expect(result.outputs).toMatchObject({ granted: true, emailed: false });
    expect(fake.users.has('uid-ana@acme.com')).toBe(true);
    expect(logger.warn).toHaveBeenCalledWith('@core.automation/step.notify.email.not-configured', undefined);
  });

  it('reprova, com a frase nomeada, a tela que não abriu a porta para a automação', async () => {
    const { fake, invite } = setup({ screens: CITY_SCREENS });
    const result = await invite(ANA);
    expect(result).toEqual({ success: false, message: '@core.tenant/portal.invite.automation-closed' });
    expect(fake.users.size).toBe(0);
  });

  it('reprova e-mail inválido, sujeito ausente e o limite da hora esgotado', async () => {
    expect(await setup().invite({ ...ANA, email: 'sem-arroba' }))
      .toEqual({ success: false, message: '@core.tenant/portal.email.invalid' });
    expect(await setup().invite({ ...ANA, subjectRecordId: '' }))
      .toEqual({ success: false, message: '@core.automation/step.portal-access.subject-missing' });
    expect(await setup({ quota: 0 }).invite(ANA))
      .toEqual({ success: false, message: '@core.tenant/portal.invite.rate-limited' });
  });

  it('responde na Auditoria a pessoa do escritório que disparou; o convidado do portal, nunca', async () => {
    const member: WorkflowActor = { userId: 'fiscal', name: 'Fiscal', photoURL: '', via: 'ui', permissions: [] };
    const guest: WorkflowActor = { userId: 'g1', name: 'Guest', photoURL: '', via: 'portal', permissions: [] };

    const byMember = setup();
    await byMember.invite(ANA, contextWith(member));
    expect(byMember.audited[0]).toMatchObject({ actor: { userId: 'fiscal', userName: 'Fiscal' }, origin: 'automation', workflowId: 'wf-cred' });
    expect(byMember.fake.users.get('uid-ana@acme.com')).toBeDefined();

    const byGuest = setup();
    await byGuest.invite(ANA, contextWith(guest));
    expect(byGuest.audited[0].actor).toEqual({ userId: 'workflow-engine', userName: '@core.automation/run.actor' });
  });
});

describe('passo portal-revoke', () => {
  it('tira o acesso no instante, e publica revoked', async () => {
    const { fake, invite, revoke } = setup();
    await invite(ANA);

    const result = await revoke(ANA);

    expect(result).toMatchObject({ success: true, message: '@core.automation/step.portal-revoke.done', outputs: { revoked: true } });
    expect(fake.users.has('uid-ana@acme.com')).toBe(false);
  });

  it('quem não tem acesso volta revoked false, com sucesso', async () => {
    const result = await setup().revoke(ANA);
    expect(result).toMatchObject({ success: true, message: '@core.automation/step.portal-revoke.unchanged', outputs: { guestId: '', revoked: false } });
  });

  it('allSubjects leva o convite inteiro de quem tem aquele sujeito', async () => {
    const { fake, invite, revoke } = setup();
    fake.records.set('companies/beta', { name: 'Beta' });
    await invite(ANA);
    await invite({ ...ANA, subjectRecordId: 'beta' });

    expect((await revoke({ ...ANA, allSubjects: true })).outputs).toMatchObject({ revoked: true });
    expect(fake.users.has('uid-ana@acme.com')).toBe(false);
  });
});

describe('passo portal-invite com identidade exigida', () => {
  const withProvider = (setupResult: ReturnType<typeof setup>) => {
    setupResult.identity.configs.set('t1', {
      settings: {
        emailLink: true,
        providers: [{ id: 'citizen', label: 'Citizen ID', issuer: 'https://id.example.test', clientId: 'c', scopes: [], claims: ['nationalId'] }],
      },
      secrets: {},
    });
    return setupResult;
  };

  it('convida pela claim, não abre conta pelo e-mail, e o log diz por que o e-mail não saiu', async () => {
    const { fake, requests, invite, identity } = withProvider(setup());
    logger.info.mockClear();

    const result = await invite({
      ...ANA, requiredClaimName: 'nationalId', requiredClaimValue: '123.456.789-00', requiredClaimNormalize: 'digits',
    });

    expect(result).toMatchObject({ success: true, outputs: { granted: true, emailed: false, inviteId: 'inv-1', guestId: '' } });
    expect(fake.users.size).toBe(0);
    expect(requests).toEqual([]);
    expect(identity.invites.get('inv-1')?.claim).toEqual({ name: 'nationalId', value: '12345678900', normalize: 'digits' });
    expect(logger.info).toHaveBeenCalledWith('@core.automation/step.portal-invite.identity-no-email', { email: 'ana@acme.com' });
  });

  it('o nome da claim ligado com o valor vazio FALHA — nunca vira convite pelo e-mail', async () => {
    const { fake, invite } = withProvider(setup());
    const result = await invite({ ...ANA, requiredClaimName: 'nationalId', requiredClaimValue: '' });
    expect(result).toEqual({ success: false, message: '@core.tenant/portal.claim.value-missing' });
    expect(fake.users.size).toBe(0);
  });
});
