import { describe, expect, it } from 'vitest';
import { makeNotifyStepDefinition } from './NotifyStep';
import type { DispatchNotificationRequest, DispatchNotificationUseCase } from '../../../domain/usecases/DispatchNotificationUseCase';
import type { SchemaScreen } from '../../../domain/schema/pathResolver';
import type { InputMapping, WorkflowEvent, WorkflowParameter } from '../../../domain/entities/Workflow';
import type { WorkflowContext } from '../../../domain/entities/WorkflowContext';
import { fakeScreenProvider } from '../../../domain/repositories/fakeScreenProvider';

const casesScreen: SchemaScreen = {
  id: 'cases',
  titleSingular: 'Case',
  titleFieldKey: 'title',
  fields: [
    { key: 'title', label: 'Title', type: 'text', required: false, order: 0, origin: 'plugin' },
    { key: 'email', label: 'E-mail', type: 'text', required: false, order: 1, origin: 'plugin', contact: 'email' },
  ],
};

const hearingsScreen: SchemaScreen = {
  id: 'hearings',
  eventPrefix: 'hearing',
  titleSingular: 'Hearing',
  titleFieldKey: 'title',
  fields: [
    { key: 'title', label: 'Title', type: 'text', required: false, order: 0, origin: 'plugin' },
    { key: 'caseId', label: 'Case', type: 'reference', refEntity: 'cases', required: false, order: 1, origin: 'plugin' },
    { key: 'contactEmail', label: 'E-mail', type: 'text', required: false, order: 2, origin: 'plugin', contact: 'email' },
    { key: 'contactPhone', label: 'Phone', type: 'masked', required: false, order: 3, origin: 'plugin', contact: 'phone' },
    { key: 'notes', label: 'Notes', type: 'text', required: false, order: 4, origin: 'plugin' },
  ],
};

const logger = { info: () => {}, warn: () => {}, error: () => {} };

interface RunTrigger {
  name: string;
  payload: Record<string, unknown>;
  parameters?: WorkflowParameter[];
}

const HEARING_SAVED: RunTrigger = { name: 'hearing.saved', payload: { id: 'h1', title: 'Hearing', caseId: 'k1' } };

const run = async (
  inputs: Record<string, unknown>,
  configuration: Record<string, InputMapping> = {},
  trigger: RunTrigger = HEARING_SAVED,
) => {
  const requests: DispatchNotificationRequest[] = [];
  const dispatch: DispatchNotificationUseCase = {
    execute: async (request) => {
      requests.push(request);
      return {
        recipients: 1,
        delivered: { audit: 0, inApp: 1, email: 0, push: 0, sms: 0 },
        failed: { audit: 0, inApp: 0, email: 0, push: 0, sms: 0 },
        optedOut: 0,
        issues: [],
      };
    },
  };
  const context: WorkflowContext = {
    event: {
      id: 'e1',
      tenantId: 't1',
      name: trigger.name,
      payload: trigger.payload,
      timestamp: new Date(),
    } as WorkflowEvent,
    outputs: {},
    variables: {},
    services: { logger, now: () => new Date() },
    logger,
    execution: { id: 'x1', workflowDefinitionId: 'w1', tenantId: 't1' },
    ...(trigger.parameters ? { parameters: trigger.parameters } : {}),
    stepConfiguration: configuration,
  };
  const step = makeNotifyStepDefinition(dispatch, fakeScreenProvider([casesScreen, hearingsScreen]));
  const result = await step.createExecutor().execute({ title: 'T', message: 'M', ...inputs }, context);
  return { result, requests };
};

const literal = (value: unknown): InputMapping => ({ kind: 'Literal', value });

describe('NotifyStep — convidados do portal', () => {
  it('por padrão, avisa quem vê o registro do EVENTO, e nunca os membros', async () => {
    const { result, requests } = await run({ portalGuests: true, toEmail: true });
    expect(result.success).toBe(true);
    expect(requests[0]).toMatchObject({
      audience: 'portal',
      target: { collection: 'hearings', recordId: 'h1' },
      recipientIds: [],
      recipientPermissions: [],
    });
  });

  it('`portalRecord` aponta outro registro pelo caminho do evento — a coleção vem do tipo do caminho', async () => {
    const { result, requests } = await run(
      { portalGuests: true, toInApp: true, portalRecord: 'k1' },
      { portalRecord: { kind: 'Event', path: 'caseId' } },
    );
    expect(result.success).toBe(true);
    expect(requests[0].target).toEqual({ collection: 'cases', recordId: 'k1' });
  });

  it('o caminho que não leva a um registro é erro de configuração', async () => {
    const { result, requests } = await run(
      { portalGuests: true, toInApp: true, portalRecord: 'Hearing' },
      { portalRecord: { kind: 'Event', path: 'title' } },
    );
    expect(result).toMatchObject({ success: false, message: '@core.automation/step.notify.portal.record-invalid' });
    expect(requests).toEqual([]);
  });

  it('o caminho certo que veio vazio não é erro: o aviso só não tem registro', async () => {
    const { result, requests } = await run(
      { portalGuests: true, toInApp: true, portalRecord: '' },
      { portalRecord: { kind: 'Event', path: 'caseId' } },
    );
    expect(result.success).toBe(true);
    expect(requests[0].target).toBeNull();
  });

  it('recusa avisar o escritório e o portal no mesmo passo', async () => {
    const { result, requests } = await run(
      { portalGuests: true, toEmail: true, recipientPermission: 'cases.update' },
      { recipientPermission: literal('cases.update') },
    );
    expect(result).toMatchObject({ success: false, message: '@core.automation/step.notify.portal.mixed' });
    expect(requests).toEqual([]);
  });

  it('sem sino nem e-mail não há como chegar ao convidado', async () => {
    const { result } = await run({ portalGuests: true, toPush: true });
    expect(result).toMatchObject({ success: false, message: '@core.automation/step.notify.portal.no-channel' });
  });

  it('sem `portalGuests`, o passo continua avisando os membros como antes', async () => {
    const { result, requests } = await run(
      { toInApp: true, recipientMembers: ['u1'] },
      { recipientMembers: literal(['u1']) },
    );
    expect(result.success).toBe(true);
    expect(requests[0].audience).toBeUndefined();
    expect(requests[0].recipientIds).toEqual(['u1']);
  });
});

describe('NotifyStep — endereços de campos de contato', () => {
  const event = (path: string): InputMapping => ({ kind: 'Event', path });

  it('lê o e-mail e o telefone dos campos declarados `contact` e pede o público de endereços', async () => {
    const { result, requests } = await run(
      { toEmail: true, toSms: true, recipientAddresses: 'a@x.com; b@y.com', recipientPhones: '(71) 99999-8888' },
      { recipientAddresses: event('contactEmail'), recipientPhones: event('contactPhone') },
    );
    expect(result.success).toBe(true);
    expect(requests[0]).toMatchObject({
      audience: 'contacts',
      contacts: { email: ['a@x.com', 'b@y.com'], sms: ['(71) 99999-8888'] },
      channels: { email: true, sms: true },
      target: { collection: 'hearings', recordId: 'h1' },
      recipientIds: [],
      recipientPermissions: [],
    });
    expect(result.outputs).toMatchObject({ optedOut: 0, delivered: { sms: 0 } });
  });

  it('atravessa uma referência até o contato do registro apontado', async () => {
    const { result, requests } = await run(
      { toEmail: true, recipientAddresses: 'case@x.com' },
      { recipientAddresses: event('caseId.email') },
    );
    expect(result.success).toBe(true);
    expect(requests[0].contacts?.email).toEqual(['case@x.com']);
  });

  it('recusa um campo que a tela não declarou de contato — o valor não decide o que é e-mail', async () => {
    const { result, requests } = await run(
      { toEmail: true, recipientAddresses: 'parece@email.com' },
      { recipientAddresses: event('notes') },
    );
    expect(result).toMatchObject({
      success: false,
      message: '@core.automation/step.notify.contacts.not-contact-field.email',
      messageParams: { path: 'notes' },
    });
    expect(requests).toEqual([]);
  });

  it('recusa o telefone no lugar do e-mail', async () => {
    const { result } = await run(
      { toEmail: true, recipientAddresses: '7199998888' },
      { recipientAddresses: event('contactPhone') },
    );
    expect(result).toMatchObject({ success: false, message: '@core.automation/step.notify.contacts.not-contact-field.email' });
  });

  it('recusa um valor que não veio de um caminho do evento', async () => {
    const { result } = await run(
      { toEmail: true, recipientAddresses: 'a@x.com' },
      { recipientAddresses: literal('a@x.com') },
    );
    expect(result).toMatchObject({ success: false, message: '@core.automation/step.notify.contacts.not-contact-field.email' });
  });

  it('nunca junto com membros nem com o portal', async () => {
    const withMembers = await run(
      { toEmail: true, recipientAddresses: 'a@x.com', recipientMembers: ['u1'] },
      { recipientAddresses: event('contactEmail'), recipientMembers: literal(['u1']) },
    );
    expect(withMembers.result).toMatchObject({ success: false, message: '@core.automation/step.notify.contacts.mixed' });
    const withPortal = await run(
      { toEmail: true, portalGuests: true, recipientAddresses: 'a@x.com' },
      { recipientAddresses: event('contactEmail') },
    );
    expect(withPortal.result).toMatchObject({ success: false, message: '@core.automation/step.notify.contacts.mixed' });
  });

  it('o canal tem de alcançar o endereço configurado: e-mail sem `toEmail` não tem por onde ir', async () => {
    const { result } = await run(
      { toSms: true, recipientAddresses: 'a@x.com' },
      { recipientAddresses: event('contactEmail') },
    );
    expect(result).toMatchObject({ success: false, message: '@core.automation/step.notify.contacts.no-channel' });
  });

  it('sem as entradas novas, o passo segue exatamente como antes', async () => {
    const { result, requests } = await run({ toEmail: true, recipientMembers: ['u1'] }, { recipientMembers: literal(['u1']) });
    expect(result.success).toBe(true);
    expect(requests[0].audience).toBeUndefined();
    expect(requests[0].contacts).toBeUndefined();
    expect(requests[0].channels.sms).toBe(false);
  });
});

describe('NotifyStep — caminhos de um fluxo chamado partem dos parâmetros declarados', () => {
  const event = (path: string): InputMapping => ({ kind: 'Event', path });
  const parameters: WorkflowParameter[] = [
    { key: 'hearing', label: 'Hearing', type: 'EntityReference', entityType: 'hearings' },
    { key: 'note', label: 'Note', type: 'String' },
  ];
  const called = (payload: Record<string, unknown>): RunTrigger => ({ name: 'workflow.called', payload, parameters });

  it('um parâmetro de referência seguido de outra referência chega ao campo de contato', async () => {
    const { result, requests } = await run(
      { toEmail: true, recipientAddresses: 'case@x.com' },
      { recipientAddresses: event('hearing.caseId.email') },
      called({ hearing: 'h1' }),
    );
    expect(result.success).toBe(true);
    expect(requests[0]).toMatchObject({ audience: 'contacts', contacts: { email: ['case@x.com'] } });
  });

  it('o contato do próprio registro apontado pelo parâmetro também vale', async () => {
    const { result, requests } = await run(
      { toSms: true, recipientPhones: '(71) 99999-8888' },
      { recipientPhones: event('hearing.contactPhone') },
      called({ hearing: 'h1' }),
    );
    expect(result.success).toBe(true);
    expect(requests[0].contacts?.sms).toEqual(['(71) 99999-8888']);
  });

  it('a trava continua: parâmetro de texto não é campo de contato, ainda que o valor pareça e-mail', async () => {
    const plain = await run(
      { toEmail: true, recipientAddresses: 'parece@email.com' },
      { recipientAddresses: event('note') },
      called({ note: 'parece@email.com' }),
    );
    expect(plain.result).toMatchObject({
      success: false,
      message: '@core.automation/step.notify.contacts.not-contact-field.email',
      messageParams: { path: 'note' },
    });
    const notContact = await run(
      { toEmail: true, recipientAddresses: 'x' },
      { recipientAddresses: event('hearing.notes') },
      called({ hearing: 'h1' }),
    );
    expect(notContact.result).toMatchObject({ success: false, message: '@core.automation/step.notify.contacts.not-contact-field.email' });
    expect([...plain.requests, ...notContact.requests]).toEqual([]);
  });

  it('`portalRecord` aponta o registro pelo parâmetro — a coleção vem do tipo declarado', async () => {
    const direct = await run(
      { portalGuests: true, toEmail: true, portalRecord: 'h1' },
      { portalRecord: event('hearing') },
      called({ hearing: 'h1' }),
    );
    expect(direct.result.success).toBe(true);
    expect(direct.requests[0].target).toEqual({ collection: 'hearings', recordId: 'h1' });
    const through = await run(
      { portalGuests: true, toEmail: true, portalRecord: { id: 'k1' } },
      { portalRecord: event('hearing.caseId') },
      called({ hearing: 'h1' }),
    );
    expect(through.requests[0].target).toEqual({ collection: 'cases', recordId: 'k1' });
  });

  it('um parâmetro que não é referência não leva a registro nenhum', async () => {
    const { result } = await run(
      { portalGuests: true, toEmail: true, portalRecord: 'x' },
      { portalRecord: event('note') },
      called({ note: 'x' }),
    );
    expect(result).toMatchObject({ success: false, message: '@core.automation/step.notify.portal.record-invalid' });
  });

  it('sem parâmetros declarados o fluxo chamado recusa como antes — não há caminho por onde chegar', async () => {
    const { result } = await run(
      { toEmail: true, recipientAddresses: 'case@x.com' },
      { recipientAddresses: event('hearing.caseId.email') },
      { name: 'workflow.called', payload: { hearing: 'h1' } },
    );
    expect(result).toMatchObject({ success: false, message: '@core.automation/step.notify.contacts.not-contact-field.email' });
  });

  it('os parâmetros não mudam a raiz de um gatilho de registro', async () => {
    const { result, requests } = await run(
      { toEmail: true, recipientAddresses: 'case@x.com' },
      { recipientAddresses: event('caseId.email') },
      { ...HEARING_SAVED, parameters },
    );
    expect(result.success).toBe(true);
    expect(requests[0].contacts?.email).toEqual(['case@x.com']);
  });
});
