import { describe, it, expect } from 'vitest';
import { makeWaitForStepDefinition } from './WaitForStep';
import type { WorkflowContext } from '../../../domain/entities/WorkflowContext';

const NOW = new Date('2026-11-12T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

const context = (canSuspend = true): WorkflowContext => ({
  event: { id: 'ev', tenantId: 't1', name: 'faturas.saved', payload: { id: 'f1' }, timestamp: NOW },
  outputs: {},
  variables: {},
  services: { logger: { info: () => undefined, warn: () => undefined, error: () => undefined }, now: () => NOW },
  logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
  execution: { id: 'e1', workflowDefinitionId: 'wf', tenantId: 't1' },
  input: {},
  canSuspend,
});

const step = () => makeWaitForStepDefinition().createExecutor();

describe('passo wait-for', () => {
  it('pede a pausa com o que espera, e as saídas de quem chega ao prazo', async () => {
    const result = await step().execute(
      { eventName: 'faturas.saved', recordId: 'f1', until: 'event.status == "paid"', timeoutInDays: 7 },
      context(),
    );

    expect(result.success).toBe(true);
    expect(result.suspend).toEqual({
      resumeAt: new Date(NOW.getTime() + 7 * DAY),
      wait: { eventName: 'faturas.saved', recordId: 'f1', until: 'event.status == "paid"' },
    });
    expect(result.outputs).toMatchObject({ matched: false, timedOut: true });
  });

  it('sem prazo, 30 dias; o prazo acima do teto vira o teto', async () => {
    const semPrazo = await step().execute({ eventName: 'faturas.saved', recordId: 'f1' }, context());
    expect(semPrazo.suspend?.resumeAt).toEqual(new Date(NOW.getTime() + 30 * DAY));
    const longo = await step().execute({ eventName: 'faturas.saved', recordId: 'f1', timeoutInDays: 900 }, context());
    expect(longo.suspend?.resumeAt).toEqual(new Date(NOW.getTime() + 365 * DAY));
  });

  it('aceita o registro hidratado que um caminho de referência devolve', async () => {
    const result = await step().execute({ eventName: 'faturas.saved', recordId: { id: 'f9', numero: 3 } }, context());
    expect(result.suspend?.wait?.recordId).toBe('f9');
  });

  it('recusa onde a execução não pode esperar, antes de pedir qualquer coisa', async () => {
    const result = await step().execute({ eventName: 'faturas.saved', recordId: 'f1' }, context(false));
    expect(result).toMatchObject({ success: false, message: '@core.automation/step.wait-for.cannot-wait' });
  });

  it('recusa evento que não é de registro e registro vazio', async () => {
    expect((await step().execute({ eventName: 'schedule', recordId: 'f1' }, context())).message)
      .toBe('@core.automation/step.wait-for.event-invalid');
    expect((await step().execute({ eventName: 'faturas.saved', recordId: '' }, context())).message)
      .toBe('@core.automation/step.wait-for.no-record');
  });
});
