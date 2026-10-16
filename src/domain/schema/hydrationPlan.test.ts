import { describe, it, expect } from 'vitest';
import { createSchemaContext, type PathRoot } from './pathResolver';
import { buildHydrationPlan } from './hydrationPlan';
import type { FieldDefinition } from '../entities/entitySchemas';

const field = (partial: Partial<FieldDefinition> & Pick<FieldDefinition, 'key' | 'label' | 'type'>): FieldDefinition => ({
  origin: 'design',
  required: false,
  order: 0,
  ...partial,
});

const ctx = createSchemaContext([
  {
    id: 'processos',
    collection: 'cases',
    eventPrefix: 'case',
    titleSingular: 'Processo',
    titleFieldKey: 'title',
    fields: [
      field({ key: 'caseNumber', label: 'Número', type: 'text' }),
      field({ key: 'status', label: 'Status', type: 'text' }),
      field({ key: 'contractId', label: 'Contrato', type: 'reference', refEntity: 'contracts', refDenormKey: 'contract' }),
      field({ key: 'responsibleLawyerId', label: 'Advogado', type: 'reference', refEntity: 'persons', refDenormKey: 'responsibleLawyer' }),
      field({ key: 'activePoleIds', label: 'Polo ativo', type: 'reference', refEntity: 'persons', refDenormKey: 'activePole', multi: true }),
      field({ key: 'tarefa', label: 'Tarefa', type: 'reference', refEntity: 'tarefas' }),
      field({ key: 'subtarefas', label: 'Subtarefas', type: 'reference', refEntity: 'tarefas', multi: true }),
    ],
  },
  {
    id: 'tarefas',
    titleSingular: 'Tarefa',
    titleFieldKey: 'nome',
    fields: [field({ key: 'nome', label: 'Nome', type: 'text' })],
  },
  {
    id: 'contratos',
    collection: 'contracts',
    eventPrefix: 'contract',
    titleSingular: 'Contrato',
    titleFieldKey: 'title',
    fields: [
      field({ key: 'number', label: 'Número', type: 'text' }),
      field({ key: 'title', label: 'Título', type: 'text' }),
      field({ key: 'clientId', label: 'Cliente', type: 'reference', refEntity: 'persons', refDenormKey: 'client' }),
    ],
  },
]);

const casesRoot: PathRoot = { kind: 'entity', entityKey: 'cases', hasOld: true };

describe('buildHydrationPlan', () => {
  it('deduplica hops por destino e agrupa por nível BFS', () => {
    const plan = buildHydrationPlan(ctx, casesRoot, [
      'contract.number',
      'contract.title',
      'contract.client.name',
      'activePole.0.name',
      'tarefa.nome',
    ]);

    expect(plan.issues).toHaveLength(0);
    expect(plan.levels).toHaveLength(2);

    const level1Targets = plan.levels[0].map((hop) => hop.materializeAt).sort();
    expect(level1Targets).toStrictEqual(['activePole', 'contract', 'tarefa']);

    const level2Targets = plan.levels[1].map((hop) => hop.materializeAt);
    expect(level2Targets).toStrictEqual(['contract.client']);
  });

  /**
   * A relação declarada por tela traz o registro INTEIRO — não há subconjunto denormalizado a
   * declarar, e uma leitura já custa o mesmo. O salto seguinte encontra a chave que precisa.
   */
  it('o salto de uma relação declarada busca o registro completo', () => {
    const plan = buildHydrationPlan(ctx, casesRoot, ['contract.client.name']);
    const contractHop = plan.levels[0].find((hop) => hop.materializeAt === 'contract');
    expect(contractHop?.fields).toBe('all');
  });

  it('reporta caminhos inválidos sem abortar o plano', () => {
    const plan = buildHydrationPlan(ctx, casesRoot, ['caseNumber.x', 'contract.number']);
    expect(plan.issues).toHaveLength(1);
    expect(plan.issues[0].path).toBe('caseNumber.x');
    expect(plan.levels[0]).toHaveLength(1);
  });

  it('não gera níveis quando nenhum caminho atravessa FK', () => {
    const plan = buildHydrationPlan(ctx, casesRoot, ['caseNumber', 'status']);
    expect(plan.levels).toHaveLength(0);
  });

  it('respeita maxFkDepth configurável', () => {
    const plan = buildHydrationPlan(ctx, casesRoot, ['contract.client.name'], { maxFkDepth: 1 });
    expect(plan.issues).toHaveLength(1);
    expect(plan.issues[0].error).toBe('@core.automation/path.max-depth');
  });

  describe('referência sem campo depois dela', () => {
    const targets = (paths: string[]): string[] =>
      buildHydrationPlan(ctx, casesRoot, paths).levels.flat().map((hop) => hop.materializeAt);

    it('lida sozinha não gera salto: é o id, e nada é buscado', () => {
      expect(targets(['tarefa'])).toStrictEqual([]);
      expect(targets(['subtarefas'])).toStrictEqual([]);
      expect(targets(['subtarefas.0'])).toStrictEqual([]);
    });

    it('com um campo depois, o salto entra, inclusive para o id explícito', () => {
      expect(targets(['tarefa.nome'])).toStrictEqual(['tarefa']);
      expect(targets(['tarefa.id'])).toStrictEqual(['tarefa']);
      expect(targets(['subtarefas.nome'])).toStrictEqual(['subtarefas']);
    });

    it('a navegação de outro caminho não muda o plano da leitura sozinha', () => {
      expect(targets(['tarefa', 'tarefa.nome'])).toStrictEqual(['tarefa']);
    });

    it('o registro denormalizado lido sozinho continua sendo buscado: ele não é o id', () => {
      expect(targets(['contract'])).toStrictEqual(['contract']);
    });
  });
});
