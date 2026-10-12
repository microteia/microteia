import { describe, it, expect } from 'vitest';
import { isSwitchedOff, makeRunWorkflowsForEventUseCase } from './RunWorkflowsForEventUseCase';
import type { StepRegistry } from '../engine/StepRegistry';
import type { WorkflowContextHydrator } from '../engine/WorkflowContextHydrator';
import type { WorkflowServices } from '../entities/WorkflowContext';
import type { WorkflowDefinition, WorkflowEvent, WorkflowExecution } from '../entities/Workflow';
import type { IWorkflowDefinitionRepository } from '../repositories/IWorkflowDefinitionRepository';
import type { IWorkflowExecutionRepository } from '../repositories/IWorkflowExecutionRepository';

const registry: StepRegistry = { register: () => undefined, resolve: () => undefined, list: () => [] };

const services: WorkflowServices = {
  logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
  now: () => new Date('2026-10-12T11:00:00Z'),
  timeZone: 'UTC',
};

const passthroughHydrator = {
  collectReferencedPaths: () => [],
  hydrate: async (event: unknown) => event,
} as unknown as WorkflowContextHydrator;

const definition = (overrides: Partial<WorkflowDefinition>): WorkflowDefinition => ({
  id: 'wf',
  tenantId: 't1',
  name: 'Automação',
  eventName: 'schedule',
  enabled: true,
  version: 1,
  condition: { kind: 'AlwaysTrue' },
  steps: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const event = (overrides: Partial<WorkflowEvent>): WorkflowEvent => ({
  id: 'ev',
  tenantId: 't1',
  name: 'schedule',
  payload: {},
  timestamp: new Date(),
  ...overrides,
});

const setup = (definitions: WorkflowDefinition[], deactivated: string[] = []) => {
  const executed: string[] = [];
  const dateChecked: string[] = [];
  const queried: string[] = [];
  const definitionRepository: IWorkflowDefinitionRepository = {
    findEnabledByEvent: async (_tenantId, eventName) => {
      queried.push(eventName);
      return definitions.filter((one) => one.enabled && one.eventName === eventName);
    },
    findEnabledByEvents: async (_tenantId, eventNames) => {
      queried.push(...eventNames);
      return definitions.filter((one) => one.enabled && eventNames.includes(one.eventName));
    },
    findById: async (_tenantId, id) => definitions.find((one) => one.id === id) ?? null,
    findByRef: async (_tenantId, ref) => definitions.find((one) => one.id === ref) ?? null,
  };
  const executionRepository: IWorkflowExecutionRepository = {
    create: async (execution: WorkflowExecution) => {
      executed.push(execution.workflowDefinitionId);
    },
  } as IWorkflowExecutionRepository;
  const useCase = makeRunWorkflowsForEventUseCase(
    definitionRepository,
    executionRepository,
    registry,
    services,
    passthroughHydrator,
    async () => new Set(deactivated),
    async (_event, dated) => {
      dateChecked.push(...dated.map((one) => one.id));
    },
  );
  return { useCase, executed, queried, dateChecked };
};

describe('RunWorkflowsForEventUseCase — alvo', () => {
  it('o evento com alvo acorda só a automação apontada, sem consultar as outras', async () => {
    const { useCase, executed, queried } = setup([definition({ id: 'a' }), definition({ id: 'b' })]);
    await useCase.execute(event({ target: 'b' }));
    expect(executed).toEqual(['b']);
    expect(queried).toEqual([]);
  });

  it('o alvo desligado, ou de outro gatilho, não roda', async () => {
    const { useCase, executed } = setup([
      definition({ id: 'off', enabled: false }),
      definition({ id: 'saved', eventName: 'medico.saved' }),
    ]);
    await useCase.execute(event({ target: 'off' }));
    await useCase.execute(event({ target: 'saved' }));
    await useCase.execute(event({ target: 'ghost' }));
    expect(executed).toEqual([]);
  });
});

describe('RunWorkflowsForEventUseCase — extensão desativada', () => {
  it('a automação de uma extensão desligada não roda; a do escritório e a compartilhada com uma ligada, sim', async () => {
    const { useCase, executed } = setup(
      [
        definition({ id: 'office', eventName: 'medico.saved' }),
        definition({ id: 'off', eventName: 'medico.saved', ownerPluginIds: ['com.x.off'] }),
        definition({ id: 'shared', eventName: 'medico.saved', ownerPluginIds: ['com.x.off', 'com.x.on'] }),
      ],
      ['com.x.off'],
    );
    await useCase.execute(event({ name: 'medico.saved' }));
    expect(executed.sort()).toEqual(['office', 'shared']);
  });

  it('isSwitchedOff só para quando TODAS as donas estão desligadas', () => {
    const off = new Set(['a']);
    expect(isSwitchedOff(definition({ ownerPluginIds: ['a'] }), off)).toBe(true);
    expect(isSwitchedOff(definition({ ownerPluginIds: ['a', 'b'] }), off)).toBe(false);
    expect(isSwitchedOff(definition({ ownerPluginIds: [] }), off)).toBe(false);
    expect(isSwitchedOff(definition({ ownerPluginIds: null }), off)).toBe(false);
  });
});

describe('RunWorkflowsForEventUseCase — gatilho de data na gravação', () => {
  it('a gravação pergunta, na mesma consulta, pelas automações de data da coleção, e não as executa como de gravação', async () => {
    const { useCase, executed, queried, dateChecked } = setup([
      definition({ id: 'on-save', eventName: 'prazo.saved' }),
      definition({ id: 'on-date', eventName: 'prazo.dateReached', dateReached: { field: 'dueDate', offset: '0d' } }),
      definition({ id: 'off', eventName: 'prazo.dateReached', ownerPluginIds: ['com.x.off'] }),
    ], ['com.x.off']);
    await useCase.execute(event({ name: 'prazo.saved', payload: { id: 'r1' } }));
    expect(queried).toEqual(['prazo.saved', 'prazo.dateReached']);
    expect(executed).toEqual(['on-save']);
    expect(dateChecked).toEqual(['on-date']);
  });

  it('o evento de data publicado pelo relógio roda a automação apontada', async () => {
    const { useCase, executed, dateChecked } = setup([
      definition({ id: 'on-date', eventName: 'prazo.dateReached' }),
    ]);
    await useCase.execute(event({ name: 'prazo.dateReached', target: 'on-date', payload: { id: 'r1' } }));
    expect(executed).toEqual(['on-date']);
    expect(dateChecked).toEqual([]);
  });
});
