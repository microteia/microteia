import { describe, it, expect, vi } from 'vitest';
import { makeCallWorkflowStepDefinition } from './CallWorkflowStep';
import type { RunCalledWorkflowResult, RunCalledWorkflowUseCase } from '../../../domain/usecases/RunCalledWorkflowUseCase';
import type { WorkflowContext, WorkflowLogger } from '../../../domain/entities/WorkflowContext';
import type { WorkflowEvent } from '../../../domain/entities/Workflow';

// O passo importa a inicialização do Firebase para o caminho que NÃO espera retorno (ele publica um
// evento). Nenhum teste daqui passa por lá, e o módulo real abriria uma conexão só para ser ignorado.
vi.mock('../../firebase/initFirebase', () => ({ getDb: () => ({}) }));
const published = vi.hoisted(() => [] as unknown[][]);
vi.mock('../publishEvent', () => ({
  publishEvent: async (...args: unknown[]) => {
    published.push(args);
    return 'ev-1';
  },
}));

const makeContext = (logger: WorkflowLogger): WorkflowContext => {
  const event: WorkflowEvent = {
    id: 'e1',
    tenantId: 't1',
    name: 'workflow.called',
    payload: {},
    timestamp: new Date('2026-09-02T00:00:00Z'),
  };
  return {
    event,
    outputs: {},
    variables: {},
    services: { logger, now: () => new Date('2026-09-02T00:00:00Z') },
    logger,
    execution: { id: 'x1', workflowDefinitionId: 'wf-a', tenantId: 't1' },
    stepConfiguration: {},
  };
};

const runner = (result: RunCalledWorkflowResult): RunCalledWorkflowUseCase => ({
  execute: async () => result,
});

const capturingLogger = (): { logger: WorkflowLogger; errors: [string, Record<string, string> | undefined][] } => {
  const errors: [string, Record<string, string> | undefined][] = [];
  return {
    errors,
    logger: {
      info: () => undefined,
      warn: () => undefined,
      error: (message, params) => errors.push([message, params]),
    },
  };
};

describe('Step "Chamar Workflow" — o que ele conta quando o chamado falha', () => {
  /**
   * A REGRESSÃO: o passo dizia apenas "terminou com status FAILED". O motivo existia — gravado na
   * execução da automação chamada — e quem lia o log do chamador tinha de sair da tela, achar a
   * outra automação e casar a execução pelo horário. Agora o motivo chega junto.
   */
  it('repete as linhas de erro do chamado no log do chamador, antes do veredito', async () => {
    const { logger, errors } = capturingLogger();
    const definition = makeCallWorkflowStepDefinition(runner({
      found: true,
      status: 'FAILED',
      outputs: {},
      executionId: 'exec-b',
      failures: [{ message: '@core.automation/step.validate.invalid-object', messageParams: { detail: 'CPF inválido' } }],
    }));

    const result = await definition.createExecutor().execute(
      { targetWorkflowId: 'wf-b', waitForResult: true },
      makeContext(logger),
    );

    expect(errors).toEqual([
      ['@core.automation/step.validate.invalid-object', { detail: 'CPF inválido' }],
    ]);
    expect(result.success).toBe(false);
    expect(result.message).toBe('@core.automation/step.call-workflow.bad-status');
    expect(result.messageParams).toEqual({ status: 'FAILED' });
  });

  it('não escreve erro nenhum quando o chamado termina bem', async () => {
    const { logger, errors } = capturingLogger();
    const definition = makeCallWorkflowStepDefinition(runner({
      found: true,
      status: 'SUCCESS',
      outputs: { id: 'p1' },
      executionId: 'exec-b',
      failures: [],
    }));

    const result = await definition.createExecutor().execute(
      { targetWorkflowId: 'wf-b', waitForResult: true },
      makeContext(logger),
    );

    expect(errors).toEqual([]);
    expect(result.success).toBe(true);
    expect(result.outputs).toEqual({ id: 'p1' });
  });

  /**
   * A extensão ausente é a outra metade: ali não há execução nenhuma, e o que resolve não é o motivo
   * do erro, é o NOME de quem falta instalar.
   */
  it('quando o alvo é de outra extensão e não existe, nomeia a extensão', async () => {
    const { logger, errors } = capturingLogger();
    const definition = makeCallWorkflowStepDefinition(runner({ found: false }));

    const result = await definition.createExecutor().execute(
      { targetWorkflowId: 'com.acme.utils/wf-x', waitForResult: true },
      makeContext(logger),
    );

    expect(errors).toEqual([]);
    expect(result.message).toBe('@core.automation/step.call-workflow.target-missing-extension');
    expect(result.messageParams).toEqual({ artifact: 'wf-x', plugin: 'com.acme.utils' });
  });
});

describe('Step "Chamar Workflow" — a pessoa que causou a execução chega ao fluxo chamado', () => {
  const actor = { userId: 'u-ana', name: 'Ana Souza', photoURL: '', via: 'ui' as const, permissions: ['x.read'] };
  const silent: WorkflowLogger = { info: () => undefined, warn: () => undefined, error: () => undefined };

  it('esperando, leva o ator inteiro — identidade e permissões, porque roda nesta invocação', async () => {
    const calls: unknown[] = [];
    const definition = makeCallWorkflowStepDefinition({
      execute: async (params) => {
        calls.push(params.actor);
        return { found: true, status: 'SUCCESS', outputs: {}, executionId: 'b', failures: [] };
      },
    });

    await definition.createExecutor().execute(
      { targetWorkflowId: 'wf-b', waitForResult: true },
      { ...makeContext(silent), actor },
    );

    expect(calls).toEqual([actor]);
  });

  it('sem esperar, publica a IDENTIDADE ao lado do payload, e nunca as permissões', async () => {
    published.length = 0;
    const definition = makeCallWorkflowStepDefinition(runner({ found: false }));

    await definition.createExecutor().execute(
      { targetWorkflowId: 'wf-b', waitForResult: false },
      { ...makeContext(silent), actor },
    );

    const [, , , payload, publishedActor] = published[0];
    expect(publishedActor).toEqual({ userId: 'u-ana', name: 'Ana Souza', photoURL: '', via: 'ui' });
    expect(payload).not.toHaveProperty('actor');
  });

  it('sem pessoa por trás, não inventa ator em nenhum dos dois modos', async () => {
    published.length = 0;
    const calls: unknown[] = [];
    const definition = makeCallWorkflowStepDefinition({
      execute: async (params) => {
        calls.push(params.actor);
        return { found: true, status: 'SUCCESS', outputs: {}, executionId: 'b', failures: [] };
      },
    });

    await definition.createExecutor().execute({ targetWorkflowId: 'wf-b', waitForResult: true }, makeContext(silent));
    await definition.createExecutor().execute({ targetWorkflowId: 'wf-b', waitForResult: false }, makeContext(silent));

    expect(calls).toEqual([undefined]);
    expect(published[0][4]).toBeUndefined();
  });
});
