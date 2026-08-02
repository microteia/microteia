import { describe, expect, it } from 'vitest';
import { prazoPlugin } from '../src/plugins/marketplace/prazo';
import { processoPlugin } from '../src/plugins/marketplace/processo';
import { pessoaPlugin } from '../src/plugins/marketplace/pessoa';
import { runWorkflow } from '../functions/src/domain/engine/WorkflowExecutor';
import { makeMapStepDefinition } from '../functions/src/infrastructure/workflow/steps/MapStep';
import { makeExitStepDefinition } from '../functions/src/infrastructure/workflow/steps/ExitStep';
import { makeQueryStepDefinition } from '../functions/src/infrastructure/workflow/steps/QueryStep';
import { makeUpsertStepDefinition } from '../functions/src/infrastructure/workflow/steps/UpsertStep';
import { fakeScreenProvider } from '../functions/src/domain/repositories/fakeScreenProvider';
import type { StepRegistry } from '../functions/src/domain/engine/StepRegistry';
import type { WorkflowServices } from '../functions/src/domain/entities/WorkflowContext';
import type { WorkflowDefinition } from '../functions/src/domain/entities/Workflow';
import type { SchemaScreen } from '../functions/src/domain/schema/pathResolver';
import type { MarketplacePlugin } from '../src/domain/entities/MarketplacePlugin';

/**
 * O workflow "Criar Prazo" da extensão de Prazos rodando no MOTOR de verdade.
 *
 * O teste mora em `scripts/` porque é o único lugar que enxerga as duas pontas: o pacote da extensão
 * vive em `src/` e o motor em `functions/`, e os dois projetos não compartilham código. É de
 * propósito que ele não use dublê nenhum do motor — o que ele guarda é justamente que a declaração
 * escrita à mão no pacote (ids de passo, caminhos de expressão, formato do `QuerySpec` e do
 * `UpsertSpec`, ramos da condição) EXECUTA. Um erro de digitação em `output.buscarProcesso.first.id`
 * só apareceria no escritório do cliente.
 */

const screenOf = (plugin: MarketplacePlugin): SchemaScreen => {
  const screen = plugin.screens![0];
  return {
    id: screen.key,
    collection: screen.dataCollection,
    titleSingular: screen.titleSingular,
    titlePlural: screen.titlePlural,
    titleFieldKey: screen.titleFieldKey,
    fields: screen.fields.map((field) => ({ ...field, origin: 'plugin' as const })),
  };
};

const screenProvider = fakeScreenProvider([
  screenOf(prazoPlugin),
  screenOf(processoPlugin),
  screenOf(pessoaPlugin),
]);

const services: WorkflowServices = {
  logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
  now: () => new Date('2026-08-02T09:00:00Z'),
};

interface Gravado {
  collection: string;
  data: Record<string, unknown>;
}

const cenario = (rows: Record<string, { id: string; data: Record<string, unknown> }[]>) => {
  const gravados: Gravado[] = [];

  const queryRepository = {
    queryByEquality: async (_t: string, collection: string, filters: { path: string; value: unknown }[]) =>
      (rows[collection] ?? []).filter((row) =>
        filters.every((filter) => row.data[filter.path] === filter.value),
      ),
  };

  const fetcher = {
    fetchByIds: async () => new Map<string, Record<string, unknown> | null>(),
  };

  const mutationRepository = {
    getById: async () => null,
    create: async (_t: string, collection: string, data: Record<string, unknown>) => {
      gravados.push({ collection, data });
      return 'novo-prazo';
    },
    update: async () => undefined,
    delete: async () => undefined,
  };

  const definitions = [
    makeMapStepDefinition(),
    makeExitStepDefinition(),
    makeQueryStepDefinition(queryRepository, fetcher, screenProvider),
    makeUpsertStepDefinition({ mutationRepository, screenProvider }),
  ];

  const registry: StepRegistry = {
    register: () => undefined,
    resolve: (id) => definitions.find((definition) => definition.id === id),
    list: () => definitions,
  };

  return { registry, gravados };
};

const template = prazoPlugin.workflows.find((workflow) => workflow.templateId === 'wf-prazo-criar')!;

const definition = (): WorkflowDefinition => ({
  ...template,
  id: 'wf1',
  tenantId: 't1',
  enabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as WorkflowDefinition);

const chamar = async (
  registry: StepRegistry,
  payload: Record<string, unknown>,
) => runWorkflow({
  definition: definition(),
  event: {
    id: 'evt1',
    tenantId: 't1',
    name: 'workflow.called',
    payload,
    createdAt: new Date(),
  },
  registry,
  services,
});

const PROCESSOS = [{ id: 'case-1', data: { caseNumber: '0801234-55.2026.8.05.0001', title: 'Ação de Cobrança' } }];
const PESSOAS = [{ id: 'person-1', data: { name: 'Ana Ribeiro', type: 'Pessoa Física' } }];

const BASE = {
  caseNumber: '0801234-55.2026.8.05.0001',
  type: 'Petição',
  dueDate: '2026-08-20',
  priority: 'Alta',
  description: 'Contrarrazões',
};

describe('workflow "Criar Prazo" da extensão de Prazos', () => {
  it('resolve o processo pelo NÚMERO e grava o prazo apontando para o id dele', async () => {
    const { registry, gravados } = cenario({ cases: PROCESSOS, persons: PESSOAS });

    const execution = await chamar(registry, BASE);

    expect(execution.status).toBe('SUCCESS');
    expect(gravados).toHaveLength(1);
    expect(gravados[0].collection).toBe('deadlines');
    expect(gravados[0].data).toMatchObject({
      caseId: 'case-1',
      type: 'Petição',
      priority: 'Alta',
      description: 'Contrarrazões',
      status: 'Pendente',
      responsibleLawyerId: null,
    });
    // A data chega como texto de quem chamou e é gravada como data, pela declaração do campo.
    expect(gravados[0].data.dueDate).toBeInstanceOf(Date);
  });

  it('resolve o advogado pelo NOME quando ele é informado', async () => {
    const { registry, gravados } = cenario({ cases: PROCESSOS, persons: PESSOAS });

    await chamar(registry, { ...BASE, responsibleLawyerName: 'Ana Ribeiro' });

    expect(gravados[0].data.responsibleLawyerId).toBe('person-1');
  });

  /**
   * O ponto do workflow: parar antes de gravar. Um prazo pendurado num processo que não existe é
   * pior do que um erro na cara de quem chamou.
   */
  it('processo inexistente encerra com erro, sem gravar nada', async () => {
    const { registry, gravados } = cenario({ cases: [], persons: PESSOAS });

    const execution = await chamar(registry, BASE);

    expect(gravados).toEqual([]);
    // A execução em si termina bem: "processo não encontrado" é resultado de negócio, não falha do
    // motor — quem chamou recebe `ok: false` e a mensagem, e decide o que fazer.
    expect(execution.status).toBe('SUCCESS');
    expect(execution.outputs).toMatchObject({ ok: false });
    expect(String((execution.outputs as { error?: unknown }).error)).toContain('não encontrado');
  });

  it('advogado informado e não encontrado encerra com erro, sem gravar nada', async () => {
    const { registry, gravados } = cenario({ cases: PROCESSOS, persons: [] });

    const execution = await chamar(registry, { ...BASE, responsibleLawyerName: 'Quem Não Existe' });

    expect(gravados).toEqual([]);
    expect(execution.outputs).toMatchObject({ ok: false });
    expect(String((execution.outputs as { error?: unknown }).error)).toContain('Quem Não Existe');
  });

  it('devolve o id do prazo criado a quem chamou', async () => {
    const { registry } = cenario({ cases: PROCESSOS, persons: PESSOAS });

    const execution = await chamar(registry, BASE);

    expect(execution.outputs).toMatchObject({ ok: true, deadlineId: 'novo-prazo' });
  });
});
