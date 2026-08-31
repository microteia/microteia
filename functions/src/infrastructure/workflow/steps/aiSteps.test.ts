import { describe, it, expect } from 'vitest';
import { makeAIDetectWorkflowStepDefinition } from './AIDetectWorkflowStep';
import { makeAIExtractParametersStepDefinition } from './AIExtractParametersStep';
import type { AIStepDeps } from '../stepDeps';
import type { IAIConnectionRepository } from '../../../domain/repositories/IAIConnectionRepository';
import type { IWorkflowDefinitionRepository } from '../../../domain/repositories/IWorkflowDefinitionRepository';
import { parseArtifactRef } from '../../../domain/schema/plugin/artifactRef';
import type { AICredentials } from '../../../domain/entities/AICredentials';
import type { WorkflowDefinition, WorkflowEvent } from '../../../domain/entities/Workflow';
import type { WorkflowContext } from '../../../domain/entities/WorkflowContext';
import type { CallAIInput, CallAIUseCase } from '../../../domain/usecases/CallAIUseCase';
import { AIResponseFormatError } from '../../../domain/usecases/CallAIUseCase';
import { WORKFLOW_CALLED_EVENT } from '../../../domain/schema/eventCatalog';

const credentials: AICredentials = {
  provider: 'openai',
  apiKey: 'k',
  model: 'gpt',
  temperature: 0,
  maxTokens: 1000,
};

class FakeConnections implements IAIConnectionRepository {
  readonly asked: string[] = [];
  async getDefaultCredentials(): Promise<AICredentials> {
    this.asked.push('default');
    return credentials;
  }
  async getAllCredentials(): Promise<AICredentials[]> {
    return [credentials];
  }
  async getCredentialsById(_tenantId: string, connectionId: string): Promise<AICredentials> {
    this.asked.push(connectionId);
    return credentials;
  }
}

const workflow = (overrides: Partial<WorkflowDefinition>): WorkflowDefinition => ({
  id: 'w-x',
  tenantId: 't1',
  name: 'Automação',
  eventName: WORKFLOW_CALLED_EVENT,
  enabled: true,
  version: 1,
  condition: { kind: 'AlwaysTrue' },
  steps: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

class FakeDefinitions implements IWorkflowDefinitionRepository {
  constructor(private readonly all: WorkflowDefinition[]) {}
  async findEnabledByEvent(_tenantId: string, eventName: string): Promise<WorkflowDefinition[]> {
    return this.all.filter((one) => one.eventName === eventName && one.enabled);
  }
  async findById(_tenantId: string, id: string): Promise<WorkflowDefinition | null> {
    return this.all.find((one) => one.id === id) ?? null;
  }
  async findByRef(tenantId: string, ref: string): Promise<WorkflowDefinition | null> {
    const qualified = parseArtifactRef(ref);
    if (!qualified) return this.findById(tenantId, ref);
    return this.all.find((one) => one.sourceId === qualified.artifactId
      && (one.ownerPluginIds ?? []).includes(qualified.pluginId)) ?? null;
  }
}

const fakeAI = (answer: unknown): CallAIUseCase & { calls: CallAIInput[] } => {
  const calls: CallAIInput[] = [];
  return {
    calls,
    execute: async (input) => {
      calls.push(input);
      return JSON.stringify(answer);
    },
    executeJson: async <T>(input: CallAIInput): Promise<T> => {
      calls.push(input);
      if (answer instanceof Error) throw answer;
      return answer as T;
    },
  };
};

const depsWith = (
  definitions: WorkflowDefinition[],
  ai: CallAIUseCase,
  connections: IAIConnectionRepository = new FakeConnections(),
): AIStepDeps => ({
  workflowDefinitionRepository: new FakeDefinitions(definitions),
  aiConnectionRepository: connections,
  callAIUseCase: ai,
});

const logger = { info: () => {}, warn: () => {}, error: () => {} };

const context = (workflowDefinitionId = 'w-atual'): WorkflowContext => ({
  event: {
    id: 'e1',
    tenantId: 't1',
    name: WORKFLOW_CALLED_EVENT,
    payload: {},
    timestamp: new Date(),
  } as WorkflowEvent,
  outputs: {},
  variables: {},
  services: { logger, now: () => new Date() },
  logger,
  execution: { id: 'x1', workflowDefinitionId, tenantId: 't1' },
});

describe('passo "Detectar Automação"', () => {
  it('devolve a mais adequada e a lista ordenada dos candidatos', async () => {
    const ai = fakeAI({ workflowIds: ['w-reparo', 'w-indenizacao'] });
    const definition = makeAIDetectWorkflowStepDefinition(
      depsWith(
        [
          workflow({ id: 'w-indenizacao', name: 'Indenização total', description: 'perda total' }),
          workflow({ id: 'w-reparo', name: 'Reparação', description: 'dano parcial' }),
        ],
        ai,
      ),
    );

    const result = await definition.createExecutor().execute({ text: 'o carro amassou o para-lama' }, context());

    expect(result.success).toBe(true);
    expect(result.outputs).toEqual({
      found: true,
      workflowId: 'w-reparo',
      workflowName: 'Reparação',
      candidates: [
        { id: 'w-reparo', name: 'Reparação' },
        { id: 'w-indenizacao', name: 'Indenização total' },
      ],
    });
  });

  /**
   * Nada no texto impede o modelo de escolher a própria automação que está rodando, e o único freio
   * seria o limite de profundidade — dez execuções depois. Ela não entra na lista.
   */
  it('não se oferece a si mesma como candidata', async () => {
    const ai = fakeAI({ workflowIds: [] });
    const definition = makeAIDetectWorkflowStepDefinition(
      depsWith([workflow({ id: 'w-atual', name: 'Triagem', description: 'qualquer sinistro' })], ai),
    );

    const result = await definition.createExecutor().execute({ text: 'sinistro' }, context('w-atual'));

    expect(result.success).toBe(false);
    expect(result.message).toBe('@core.automation/step.ai-detect-workflow.no-candidates');
  });

  it('não encontrar nada é sucesso com `found` falso, para a Condição decidir', async () => {
    const ai = fakeAI({ workflowIds: [] });
    const definition = makeAIDetectWorkflowStepDefinition(
      depsWith([workflow({ id: 'w-1', name: 'Reparação', description: 'dano parcial' })], ai),
    );

    const result = await definition.createExecutor().execute({ text: 'receita de bolo' }, context());

    expect(result.success).toBe(true);
    expect(result.outputs).toMatchObject({ found: false, workflowId: '' });
  });

  it('ignora id que o modelo invente fora da lista de candidatos', async () => {
    const ai = fakeAI({ workflowIds: ['w-inventado', 'w-1'] });
    const definition = makeAIDetectWorkflowStepDefinition(
      depsWith([workflow({ id: 'w-1', name: 'Reparação', description: 'dano parcial' })], ai),
    );

    const result = await definition.createExecutor().execute({ text: 'batida leve' }, context());

    expect(result.outputs).toMatchObject({ workflowId: 'w-1' });
  });

  it('usa a conexão padrão do escritório quando o passo não nomeia nenhuma', async () => {
    const connections = new FakeConnections();
    const definition = makeAIDetectWorkflowStepDefinition(
      depsWith(
        [workflow({ id: 'w-1', name: 'Reparação', description: 'dano' })],
        fakeAI({ workflowIds: ['w-1'] }),
        connections,
      ),
    );

    await definition.createExecutor().execute({ text: 'batida' }, context());
    expect(connections.asked).toEqual(['default']);

    await definition.createExecutor().execute({ text: 'batida', connectionId: 'conn-2' }, context());
    expect(connections.asked).toEqual(['default', 'conn-2']);
  });
});

describe('passo "Extrair Parâmetros"', () => {
  const alvo = workflow({
    id: 'w-reparo',
    name: 'Reparação',
    parameters: [
      { key: 'placa', label: 'Placa', type: 'String' },
      { key: 'valor', label: 'Valor', type: 'Number' },
      { key: 'data', label: 'Data', type: 'Date' },
      { key: 'uf', label: 'UF', type: 'select', options: [{ value: 'BA', label: 'Bahia' }] },
    ],
  });

  it('coage o que o modelo devolveu para o tipo que o parâmetro declara', async () => {
    const ai = fakeAI({ values: { placa: 'ABC1D23', valor: '1200.50', data: '2026-08-12', uf: 'ba' } });
    const definition = makeAIExtractParametersStepDefinition(depsWith([alvo], ai));

    const result = await definition
      .createExecutor()
      .execute({ text: 'o veículo ABC1D23…', targetWorkflowId: 'w-reparo' }, context());

    expect(result.success).toBe(true);
    const params = (result.outputs as { params: Record<string, unknown> }).params;
    expect(params.placa).toBe('ABC1D23');
    expect(params.valor).toBe(1200.5);
    expect(params.data).toBeInstanceOf(Date);
    expect(params.uf).toBe('BA');
    expect((result.outputs as { filled: number }).filled).toBe(4);
  });

  /**
   * O prompt pede número PURO, e é o que a coerção entende: "1.200,50" com separador de milhar
   * brasileiro volta nulo em vez de virar 1,20. Fica registrado porque é o mesmo caminho que a tela
   * do Extrator de Dados sempre usou — um número formatado ali nunca chegou preenchido —, e porque
   * um dia alguém vai ler o nulo na execução e precisar saber que a causa é o formato, não o texto.
   */
  it('número com separador de milhar volta nulo, não um valor mil vezes menor', async () => {
    const ai = fakeAI({ values: { valor: '1.200,50' } });
    const definition = makeAIExtractParametersStepDefinition(depsWith([alvo], ai));

    const result = await definition
      .createExecutor()
      .execute({ text: 'texto', targetWorkflowId: 'w-reparo' }, context());

    expect((result.outputs as { params: Record<string, unknown> }).params.valor).toBeNull();
  });

  it('recusa alvo que pede um registro já existente', async () => {
    const comReferencia = workflow({
      id: 'w-ref',
      parameters: [{ key: 'cliente', label: 'Cliente', type: 'EntityReference', entityType: 'members' }],
    });
    const definition = makeAIExtractParametersStepDefinition(
      depsWith([comReferencia], fakeAI({ values: {} })),
    );

    const result = await definition
      .createExecutor()
      .execute({ text: 'qualquer coisa', targetWorkflowId: 'w-ref' }, context());

    expect(result.success).toBe(false);
    expect(result.message).toBe('@core.automation/step.ai-extract-parameters.has-references');
  });

  it('recusa alvo que não é chamável por outra automação', async () => {
    const porGatilho = workflow({ id: 'w-gatilho', eventName: 'custom_record.saved' });
    const definition = makeAIExtractParametersStepDefinition(
      depsWith([porGatilho], fakeAI({ values: {} })),
    );

    const result = await definition
      .createExecutor()
      .execute({ text: 'texto', targetWorkflowId: 'w-gatilho' }, context());

    expect(result.success).toBe(false);
    expect(result.message).toBe('@core.automation/step.ai-extract-parameters.target-missing');
  });

  /**
   * Resposta cortada no limite de saída e resposta que não é JSON têm correções diferentes — mais
   * limite na conexão contra menos texto —, e por isso não podem chegar ao log com a mesma frase.
   */
  it('distingue a resposta cortada da que não é JSON', async () => {
    const truncada = makeAIExtractParametersStepDefinition(
      depsWith([alvo], fakeAI(new AIResponseFormatError('{"values": {', true))),
    );
    const cortada = await truncada
      .createExecutor()
      .execute({ text: 'texto', targetWorkflowId: 'w-reparo' }, context());
    expect(cortada.message).toBe('@core.automation/step.ai.response-truncated');
    expect(cortada.messageParams).toEqual({ limit: '1000' });

    const prosa = makeAIExtractParametersStepDefinition(
      depsWith([alvo], fakeAI(new AIResponseFormatError('desculpe, não consigo', false))),
    );
    const naoJson = await prosa
      .createExecutor()
      .execute({ text: 'texto', targetWorkflowId: 'w-reparo' }, context());
    expect(naoJson.message).toBe('@core.automation/step.ai.response-not-json');
  });

  it('leva o motivo adiante quando o próprio modelo diz que não conseguiu', async () => {
    const definition = makeAIExtractParametersStepDefinition(
      depsWith([alvo], fakeAI({ error: 'volume de itens excede o limite' })),
    );

    const result = await definition
      .createExecutor()
      .execute({ text: 'texto', targetWorkflowId: 'w-reparo' }, context());

    expect(result.success).toBe(false);
    expect(result.message).toBe('@core.automation/step.ai-extract-parameters.refused');
    expect(result.messageParams).toEqual({ detail: 'volume de itens excede o limite' });
  });

  it('alvo sem parâmetros é sucesso com objeto vazio, sem chamar o modelo', async () => {
    const ai = fakeAI({ values: {} });
    const definition = makeAIExtractParametersStepDefinition(
      depsWith([workflow({ id: 'w-sem-params' })], ai),
    );

    const result = await definition
      .createExecutor()
      .execute({ text: 'texto', targetWorkflowId: 'w-sem-params' }, context());

    expect(result.success).toBe(true);
    expect(result.outputs).toEqual({ params: {}, filled: 0 });
    expect(ai.calls).toHaveLength(0);
  });
});
