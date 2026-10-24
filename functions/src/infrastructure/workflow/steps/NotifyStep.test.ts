import { describe, expect, it } from 'vitest';
import { makeNotifyStepDefinition } from './NotifyStep';
import type { DispatchNotificationRequest, DispatchNotificationUseCase } from '../../../domain/usecases/DispatchNotificationUseCase';
import type { SchemaScreen } from '../../../domain/schema/pathResolver';
import type { InputMapping, WorkflowEvent } from '../../../domain/entities/Workflow';
import type { WorkflowContext } from '../../../domain/entities/WorkflowContext';
import { fakeScreenProvider } from '../../../domain/repositories/fakeScreenProvider';

const casesScreen: SchemaScreen = {
  id: 'cases',
  titleSingular: 'Case',
  titleFieldKey: 'title',
  fields: [{ key: 'title', label: 'Title', type: 'text', required: false, order: 0, origin: 'plugin' }],
};

const hearingsScreen: SchemaScreen = {
  id: 'hearings',
  eventPrefix: 'hearing',
  titleSingular: 'Hearing',
  titleFieldKey: 'title',
  fields: [
    { key: 'title', label: 'Title', type: 'text', required: false, order: 0, origin: 'plugin' },
    { key: 'caseId', label: 'Case', type: 'reference', refEntity: 'cases', required: false, order: 1, origin: 'plugin' },
  ],
};

const logger = { info: () => {}, warn: () => {}, error: () => {} };

const run = async (inputs: Record<string, unknown>, configuration: Record<string, InputMapping> = {}) => {
  const requests: DispatchNotificationRequest[] = [];
  const dispatch: DispatchNotificationUseCase = {
    execute: async (request) => {
      requests.push(request);
      return {
        recipients: 1,
        delivered: { audit: 0, inApp: 1, email: 0, push: 0 },
        failed: { audit: 0, inApp: 0, email: 0, push: 0 },
        issues: [],
      };
    },
  };
  const context: WorkflowContext = {
    event: {
      id: 'e1',
      tenantId: 't1',
      name: 'hearing.saved',
      payload: { id: 'h1', title: 'Hearing', caseId: 'k1' },
      timestamp: new Date(),
    } as WorkflowEvent,
    outputs: {},
    variables: {},
    services: { logger, now: () => new Date() },
    logger,
    execution: { id: 'x1', workflowDefinitionId: 'w1', tenantId: 't1' },
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
