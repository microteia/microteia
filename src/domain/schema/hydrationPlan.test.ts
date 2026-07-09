import { describe, it, expect } from 'vitest';
import { createSchemaContext, type PathRoot } from './pathResolver';
import { buildHydrationPlan } from './hydrationPlan';
import type { FieldDefinition } from '../entities/entitySchemas';

const field = (partial: Partial<FieldDefinition> & Pick<FieldDefinition, 'key' | 'label' | 'type'>): FieldDefinition => ({
  required: false,
  order: 0,
  ...partial,
});

const ctx = createSchemaContext([
  {
    id: 'cases',
    titleSingular: 'Processo',
    titleFieldKey: 'title',
    fields: [field({ key: 'tarefa', label: 'Tarefa', type: 'reference', refEntity: 'tarefas' })],
  },
  {
    id: 'tarefas',
    titleSingular: 'Tarefa',
    titleFieldKey: 'nome',
    fields: [field({ key: 'nome', label: 'Nome', type: 'text' })],
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
      'customValues.tarefa.nome',
    ]);

    expect(plan.issues).toHaveLength(0);
    expect(plan.levels).toHaveLength(2);

    const level1Targets = plan.levels[0].map((hop) => hop.materializeAt).sort();
    expect(level1Targets).toStrictEqual(['activePole', 'contract', 'customValues.tarefa']);

    const level2Targets = plan.levels[1].map((hop) => hop.materializeAt);
    expect(level2Targets).toStrictEqual(['contract.client']);
  });

  it('propaga a chave FK do salto seguinte para os fields do hop pai', () => {
    const plan = buildHydrationPlan(ctx, casesRoot, ['contract.client.name']);
    const contractHop = plan.levels[0].find((hop) => hop.materializeAt === 'contract');
    expect(contractHop?.fields).toContain('clientId');
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
    expect(plan.issues[0].error).toContain('Profundidade máxima');
  });
});
