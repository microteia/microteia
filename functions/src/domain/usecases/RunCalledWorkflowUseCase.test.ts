import { describe, it, expect } from 'vitest';
import { makeRunCalledWorkflowUseCase } from './RunCalledWorkflowUseCase';
import type { StepRegistry } from '../engine/StepRegistry';
import type { StepDefinition } from '../engine/StepDefinition';
import type { WorkflowContextHydrator } from '../engine/WorkflowContextHydrator';
import type { WorkflowServices } from '../entities/WorkflowContext';
import type { WorkflowDefinition, WorkflowExecution } from '../entities/Workflow';
import type { IWorkflowDefinitionRepository } from '../repositories/IWorkflowDefinitionRepository';
import type { IWorkflowExecutionRepository } from '../repositories/IWorkflowExecutionRepository';
import { WORKFLOW_CALLED_EVENT } from '../schema/eventCatalog';

const recordStepDefinition: StepDefinition = {
  id: 'record',
  version: 1,
  name: 'Record',
  description: '',
  icon: 'x',
  category: 'Action',
  type: 'Action',
  configurable: true,
  inputs: [{ id: 'tag', label: 'Tag', required: true, type: 'String' }],
  outputDefinitions: [{ id: 'value', label: 'Value', type: 'String' }],
  createExecutor: () => ({
    execute: async (inputs) => ({ success: true, outputs: { value: String(inputs.tag) } }),
  }),
};

/** Um passo que RECUSA, com a frase e os parâmetros que a execução chamada grava no log. */
const refusingStepDefinition: StepDefinition = {
  ...recordStepDefinition,
  id: 'refuse',
  createExecutor: () => ({
    execute: async () => ({
      success: false,
      message: '@core.automation/step.validate.invalid-object',
      messageParams: { detail: 'CPF inválido' },
    }),
  }),
};

const registry: StepRegistry = {
  register: () => undefined,
  resolve: (id) => (id === 'record' ? recordStepDefinition : id === 'refuse' ? refusingStepDefinition : undefined),
  list: () => [recordStepDefinition, refusingStepDefinition],
};

const services: WorkflowServices = {
  logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
  now: () => new Date('2026-07-17T00:00:00Z'),
};

const passthroughHydrator = {
  collectReferencedPaths: () => [],
  hydrate: async (event: unknown) => event,
} as unknown as WorkflowContextHydrator;

const makeTarget = (overrides: Partial<WorkflowDefinition> = {}): WorkflowDefinition => ({
  id: 'wf-b',
  tenantId: 't1',
  name: 'Workflow B',
  eventName: WORKFLOW_CALLED_EVENT,
  enabled: true,
  version: 1,
  condition: { kind: 'AlwaysTrue' },
  parameters: [],
  steps: [
    {
      id: 's1',
      stepDefinitionId: 'record',
      type: 'Action',
      order: 0,
      configuration: { tag: { kind: 'Literal', value: 'B-out' } },
      enabled: true,
    },
  ],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeDeps = (target: WorkflowDefinition | null) => {
  const created: WorkflowExecution[] = [];
  const definitionRepository: IWorkflowDefinitionRepository = {
    findById: async () => target,
    findByRef: async () => target,
    findEnabledByEvent: async () => [],
    findEnabledByEvents: async () => [],
  } as unknown as IWorkflowDefinitionRepository;
  const executionRepository: IWorkflowExecutionRepository = {
    create: async (execution: WorkflowExecution) => {
      created.push(execution);
    },
  } as unknown as IWorkflowExecutionRepository;
  return { created, definitionRepository, executionRepository };
};

describe('RunCalledWorkflowUseCase', () => {
  it('executa o workflow-alvo e devolve os outputs do último step, persistindo a execução', async () => {
    const { created, definitionRepository, executionRepository } = makeDeps(makeTarget());
    const useCase = makeRunCalledWorkflowUseCase(
      definitionRepository,
      executionRepository,
      registry,
      services,
      passthroughHydrator,
    );

    const result = await useCase.execute({ tenantId: 't1', targetWorkflowId: 'wf-b', params: {}, callDepth: 1 });

    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.status).toBe('SUCCESS');
      expect(result.outputs).toEqual({ value: 'B-out' });
    }
    expect(created).toHaveLength(1);
    expect(created[0].outputs).toEqual({ value: 'B-out' });
  });

  it('retorna found:false quando o alvo está desativado', async () => {
    const { definitionRepository, executionRepository } = makeDeps(makeTarget({ enabled: false }));
    const useCase = makeRunCalledWorkflowUseCase(
      definitionRepository,
      executionRepository,
      registry,
      services,
      passthroughHydrator,
    );

    const result = await useCase.execute({ tenantId: 't1', targetWorkflowId: 'wf-b', params: {}, callDepth: 1 });
    expect(result.found).toBe(false);
  });

  /**
   * O motivo mora na execução CHAMADA e a pergunta nasce na chamadora. Sem as linhas de erro
   * subindo, o chamador só sabia dizer "terminou com status FAILED" — e quem lia tinha de sair da
   * tela para descobrir o que houve.
   */
  it('devolve as linhas de ERRO da execução chamada, com a referência e os parâmetros', async () => {
    const target = makeTarget({
      steps: [
        {
          id: 's1',
          stepDefinitionId: 'refuse',
          type: 'Action',
          order: 0,
          configuration: { tag: { kind: 'Literal', value: 'x' } },
          enabled: true,
        },
      ],
    });
    const { definitionRepository, executionRepository } = makeDeps(target);
    const useCase = makeRunCalledWorkflowUseCase(
      definitionRepository,
      executionRepository,
      registry,
      services,
      passthroughHydrator,
    );

    const result = await useCase.execute({ tenantId: 't1', targetWorkflowId: 'wf-b', params: {}, callDepth: 1 });

    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.status).toBe('FAILED');
      expect(result.failures).toEqual([
        { message: '@core.automation/step.validate.invalid-object', messageParams: { detail: 'CPF inválido' } },
      ]);
    }
  });

  it('não devolve falha nenhuma quando a execução chamada termina bem', async () => {
    const { definitionRepository, executionRepository } = makeDeps(makeTarget());
    const useCase = makeRunCalledWorkflowUseCase(
      definitionRepository,
      executionRepository,
      registry,
      services,
      passthroughHydrator,
    );

    const result = await useCase.execute({ tenantId: 't1', targetWorkflowId: 'wf-b', params: {}, callDepth: 1 });
    expect(result.found && result.failures).toEqual([]);
  });

  it('retorna found:false quando o alvo não existe', async () => {
    const { definitionRepository, executionRepository } = makeDeps(null);
    const useCase = makeRunCalledWorkflowUseCase(
      definitionRepository,
      executionRepository,
      registry,
      services,
      passthroughHydrator,
    );

    const result = await useCase.execute({ tenantId: 't1', targetWorkflowId: 'missing', params: {}, callDepth: 1 });
    expect(result.found).toBe(false);
  });
});
