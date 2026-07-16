import { describe, it, expect } from 'vitest';
import type { WorkflowStep } from '../../domain/entities/Workflow';
import {
  collectPriorSteps,
  collectPriorStepsForInsert,
  flattenSteps,
  insertStepInto,
  insertStepAtIndex,
  moveStepWithinSiblings,
  moveStepToLocation,
  parseParentKey,
  removeStepFromTree,
  reorderSiblings,
} from './workflowHelpers';

const action = (id: string, order: number): WorkflowStep => ({
  id,
  stepDefinitionId: 'record',
  type: 'Action',
  order,
  configuration: {},
  enabled: true,
});

const cond = (id: string, order: number, whenTrue: WorkflowStep[], whenFalse: WorkflowStep[]): WorkflowStep => ({
  id,
  stepDefinitionId: '',
  type: 'Condition',
  order,
  configuration: {},
  enabled: true,
  condition: { kind: 'AlwaysTrue' },
  branches: { whenTrue, whenFalse },
});

const loop = (id: string, order: number, body: WorkflowStep[]): WorkflowStep => ({
  id,
  stepDefinitionId: '',
  type: 'Loop',
  order,
  configuration: {},
  enabled: true,
  loop: { source: { kind: 'Expression', expression: '' }, itemName: 'item', outputName: 'itens', body },
});

//  A
//  C ─┬─ T ─ (nested C2 ─┬─ D1)
//     │                  └─ D2
//     └─ F
//  Z
const tree: WorkflowStep[] = [
  action('A', 0),
  cond(
    'C',
    1,
    [action('T', 0), cond('C2', 1, [action('D1', 0)], [action('D2', 0)])],
    [action('F', 0)],
  ),
  action('Z', 2),
];

describe('workflowHelpers — árvore de steps', () => {
  it('flattenSteps percorre todos os nós', () => {
    expect(flattenSteps(tree).map((s) => s.id)).toEqual(['A', 'C', 'T', 'C2', 'D1', 'D2', 'F', 'Z']);
  });

  it('collectPriorSteps exclui outro ramo e nós de condição', () => {
    expect(collectPriorSteps(tree, 'D1').map((s) => s.id)).toEqual(['A', 'T']);
    expect(collectPriorSteps(tree, 'F').map((s) => s.id)).toEqual(['A']);
    expect(collectPriorSteps(tree, 'Z').map((s) => s.id)).toEqual(['A']);
    expect(collectPriorSteps(tree, 'T').map((s) => s.id)).toEqual(['A']);
  });

  it('collectPriorStepsForInsert para um ramo inclui prefixo do ancestral + irmãos do ramo', () => {
    const ids = collectPriorStepsForInsert(tree, { kind: 'branch', conditionId: 'C2', branch: 'whenTrue' }).map((s) => s.id);
    expect(ids).toEqual(['A', 'T', 'D1']);
  });

  it('insertStepInto adiciona no ramo e reindexa', () => {
    const next = insertStepInto(tree, { kind: 'branch', conditionId: 'C', branch: 'whenFalse' }, action('F2', 99));
    const cNode = next.find((s) => s.id === 'C');
    expect(cNode?.branches?.whenFalse.map((s) => [s.id, s.order])).toEqual([['F', 0], ['F2', 1]]);
  });

  it('removeStepFromTree remove em profundidade e reindexa irmãos', () => {
    const next = removeStepFromTree(tree, 'T');
    const cNode = next.find((s) => s.id === 'C');
    expect(cNode?.branches?.whenTrue.map((s) => [s.id, s.order])).toEqual([['C2', 0]]);
  });

  it('reorderSiblings move dentro do mesmo nível', () => {
    const roots = [action('A', 0), action('B', 1), action('Z', 2)];
    const next = reorderSiblings(roots, 'Z', 0);
    expect(next.sort((a, b) => a.order - b.order).map((s) => s.id)).toEqual(['Z', 'A', 'B']);
  });

  it('moveStepWithinSiblings troca vizinhos', () => {
    const roots = [action('A', 0), action('B', 1)];
    expect(moveStepWithinSiblings(roots, 'B', 'up').sort((a, b) => a.order - b.order).map((s) => s.id)).toEqual(['B', 'A']);
  });
});

//  A
//  L ─ [ B1, B2 ]   (Loop com corpo)
//  Z
const loopTree: WorkflowStep[] = [
  action('A', 0),
  loop('L', 1, [action('B1', 0), action('B2', 1)]),
  action('Z', 2),
];

describe('workflowHelpers — nó de Loop', () => {
  it('flattenSteps percorre o corpo do loop', () => {
    expect(flattenSteps(loopTree).map((s) => s.id)).toEqual(['A', 'L', 'B1', 'B2', 'Z']);
  });

  it('insertStepInto adiciona no corpo do loop e reindexa', () => {
    const next = insertStepInto(loopTree, { kind: 'loop', loopId: 'L' }, action('B3', 99));
    const lNode = next.find((s) => s.id === 'L');
    expect(lNode?.loop?.body.map((s) => [s.id, s.order])).toEqual([['B1', 0], ['B2', 1], ['B3', 2]]);
  });

  it('removeStepFromTree remove dentro do corpo do loop', () => {
    const next = removeStepFromTree(loopTree, 'B1');
    const lNode = next.find((s) => s.id === 'L');
    expect(lNode?.loop?.body.map((s) => [s.id, s.order])).toEqual([['B2', 0]]);
  });

  it('collectPriorSteps: o Loop é produtor de output; para um step no corpo vê os anteriores do corpo', () => {
    // Depois do loop, o próprio nó Loop está disponível como origem de output.
    expect(collectPriorSteps(loopTree, 'Z').map((s) => s.id)).toEqual(['A', 'L']);
    // Dentro do corpo, um step vê os irmãos anteriores do corpo e os steps antes do loop.
    expect(collectPriorSteps(loopTree, 'B2').map((s) => s.id)).toEqual(['A', 'B1']);
  });

  it('collectPriorStepsForInsert para o corpo do loop inclui prefixo + irmãos do corpo', () => {
    const ids = collectPriorStepsForInsert(loopTree, { kind: 'loop', loopId: 'L' }).map((s) => s.id);
    expect(ids).toEqual(['A', 'B1', 'B2']);
  });
});

describe('workflowHelpers — mover step entre níveis', () => {
  it('parseParentKey decodifica raiz, corpo de loop e ramos de condição', () => {
    expect(parseParentKey('root')).toEqual({ kind: 'root' });
    expect(parseParentKey('L:body')).toEqual({ kind: 'loop', loopId: 'L' });
    expect(parseParentKey('C:whenTrue')).toEqual({ kind: 'branch', conditionId: 'C', branch: 'whenTrue' });
    expect(parseParentKey('C:whenFalse')).toEqual({ kind: 'branch', conditionId: 'C', branch: 'whenFalse' });
  });

  it('insertStepAtIndex insere na posição pedida e reindexa', () => {
    const roots = [action('A', 0), action('B', 1)];
    const next = insertStepAtIndex(roots, { kind: 'root' }, action('X', 99), 1);
    expect(next.map((s) => [s.id, s.order])).toEqual([['A', 0], ['X', 1], ['B', 2]]);
  });

  it('insertStepAtIndex insere no início de um ramo de condição', () => {
    const next = insertStepAtIndex(tree, { kind: 'branch', conditionId: 'C', branch: 'whenTrue' }, action('T0', 99), 0);
    const cNode = next.find((s) => s.id === 'C');
    expect(cNode?.branches?.whenTrue.map((s) => [s.id, s.order])).toEqual([['T0', 0], ['T', 1], ['C2', 2]]);
  });

  it('insertStepAtIndex insere no meio do corpo de um loop', () => {
    const next = insertStepAtIndex(loopTree, { kind: 'loop', loopId: 'L' }, action('B15', 99), 1);
    const lNode = next.find((s) => s.id === 'L');
    expect(lNode?.loop?.body.map((s) => [s.id, s.order])).toEqual([['B1', 0], ['B15', 1], ['B2', 2]]);
  });

  it('insertStepAtIndex satura índice acima do tamanho (insere no fim)', () => {
    const roots = [action('A', 0), action('B', 1)];
    const next = insertStepAtIndex(roots, { kind: 'root' }, action('X', 99), 99);
    expect(next.map((s) => s.id)).toEqual(['A', 'B', 'X']);
  });

  it('move um step da raiz para o corpo de um loop', () => {
    const next = moveStepToLocation(loopTree, 'A', { kind: 'loop', loopId: 'L' }, 1);
    expect(next.map((s) => s.id)).toEqual(['L', 'Z']);
    const lNode = next.find((s) => s.id === 'L');
    expect(lNode?.loop?.body.map((s) => [s.id, s.order])).toEqual([['B1', 0], ['A', 1], ['B2', 2]]);
  });

  it('move um step do corpo de um loop de volta para a raiz', () => {
    const next = moveStepToLocation(loopTree, 'B1', { kind: 'root' }, 0);
    expect(next.map((s) => [s.id, s.order])).toEqual([['B1', 0], ['A', 1], ['L', 2], ['Z', 3]]);
    const lNode = next.find((s) => s.id === 'L');
    expect(lNode?.loop?.body.map((s) => s.id)).toEqual(['B2']);
  });

  it('move um step para dentro de um ramo de condição', () => {
    const next = moveStepToLocation(tree, 'A', { kind: 'branch', conditionId: 'C', branch: 'whenFalse' }, 0);
    expect(next.map((s) => s.id)).toEqual(['C', 'Z']);
    const cNode = next.find((s) => s.id === 'C');
    expect(cNode?.branches?.whenFalse.map((s) => [s.id, s.order])).toEqual([['A', 0], ['F', 1]]);
  });

  it('move um nó de controle (Loop) com sua subárvore para dentro de uma condição', () => {
    const next = moveStepToLocation(loopTree, 'L', { kind: 'root' }, 0);
    expect(next.map((s) => s.id)).toEqual(['L', 'A', 'Z']);
  });

  it('barra mover um Loop para dentro do próprio corpo (árvore intacta)', () => {
    expect(moveStepToLocation(loopTree, 'L', { kind: 'loop', loopId: 'L' }, 0)).toBe(loopTree);
  });

  it('barra mover uma Condição para dentro de um descendente', () => {
    expect(moveStepToLocation(tree, 'C', { kind: 'branch', conditionId: 'C2', branch: 'whenTrue' }, 0)).toBe(tree);
  });

  it('id inexistente retorna a árvore intacta', () => {
    expect(moveStepToLocation(loopTree, 'ZZZ', { kind: 'root' }, 0)).toBe(loopTree);
  });
});
