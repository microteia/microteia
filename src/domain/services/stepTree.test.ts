import { describe, expect, it } from 'vitest';
import type { WorkflowStep } from '../entities/Workflow';
import { flattenSteps, mapSteps } from './stepTree';

const step = (id: string, over: Partial<WorkflowStep> = {}): WorkflowStep => ({
  id, stepDefinitionId: 'notify', type: 'Action', order: 0, enabled: true, configuration: {}, ...over,
});

const loop = (id: string, body: WorkflowStep[]): WorkflowStep => step(id, {
  stepDefinitionId: '', type: 'Loop',
  loop: { source: { kind: 'Literal', value: '[]' }, itemName: 'i', outputName: 'o', body },
});

const condition = (id: string, whenTrue: WorkflowStep[], whenFalse: WorkflowStep[]): WorkflowStep =>
  step(id, {
    stepDefinitionId: '', type: 'Condition',
    condition: { kind: 'AlwaysTrue' }, branches: { whenTrue, whenFalse },
  });

const arvore = (): WorkflowStep[] => [
  step('topo'),
  loop('L', [step('corpo'), condition('C', [step('v')], [step('f')])]),
  condition('C2', [loop('L2', [step('fundo')])], []),
];

describe('travessia da árvore de passos', () => {
  it('achata topo, corpo de laço, os dois ramos e o laço dentro do ramo', () => {
    expect(flattenSteps(arvore()).map((s) => s.id))
      .toEqual(['topo', 'L', 'corpo', 'C', 'v', 'f', 'C2', 'L2', 'fundo']);
  });

  it('achata a lista ausente como vazia', () => {
    expect(flattenSteps(undefined)).toEqual([]);
  });

  it('aplica a transformação em toda profundidade preservando a forma', () => {
    const marcado = mapSteps(arvore(), (s) => ({ ...s, signature: `x-${s.id}` }));
    expect(flattenSteps(marcado).map((s) => s.signature))
      .toEqual(['x-topo', 'x-L', 'x-corpo', 'x-C', 'x-v', 'x-f', 'x-C2', 'x-L2', 'x-fundo']);
    expect(marcado[1].loop?.body[1].branches?.whenTrue[0].id).toBe('v');
  });

  /** A entrada é do chamador: uma travessia que mutasse a árvore original trocaria um defeito por outro. */
  it('não muta a árvore recebida', () => {
    const original = arvore();
    mapSteps(original, (s) => ({ ...s, signature: 'outro' }));
    expect(original[1].loop?.body[0].signature).toBeUndefined();
  });
});

describe('travessia — Switch', () => {
  const caminhos = (): WorkflowStep[] => [
    step('S', {
      stepDefinitionId: '', type: 'Switch',
      switch: {
        cases: [
          { id: 'c1', condition: { kind: 'AlwaysTrue' }, steps: [step('a')] },
          { id: 'c2', condition: { kind: 'AlwaysTrue' }, steps: [loop('L', [step('b')])] },
        ],
        otherwise: [step('senao')],
      },
    }),
  ];

  it('desce em cada caminho, na ordem, e no "senão"', () => {
    expect(flattenSteps(caminhos()).map((s) => s.id)).toEqual(['S', 'a', 'L', 'b', 'senao']);
  });

  it('mapSteps reescreve os passos dentro dos caminhos, preservando a forma', () => {
    const mapped = mapSteps(caminhos(), (s) => ({ ...s, enabled: false }));
    expect(flattenSteps(mapped).every((s) => s.enabled === false)).toBe(true);
    expect(mapped[0].switch?.cases.map((one) => one.id)).toEqual(['c1', 'c2']);
  });
});
