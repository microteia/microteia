import { describe, expect, it } from 'vitest';
import type { WorkflowStep } from '../../domain/entities/Workflow';
import {
  collectPriorSteps,
  collectPriorStepsForInsert,
  findStepInTree,
  flattenSteps,
  insertStepAtIndex,
  insertStepInto,
  moveStepToLocation,
  parallelLaneKeyOf,
  parseParentKey,
  removeStepFromTree,
} from './workflowHelpers';
import { flattenSteps as domainFlatten, mapSteps } from '../../domain/services/stepTree';
import { diffArtifactVersions } from '../../domain/services/artifactVersionDiff';
import { workflowStepIssues } from '../../domain/usecases/plugins/workflowIntegrity';
import type { MarketplacePlugin, WorkflowModuleTemplate } from '../../domain/entities/MarketplacePlugin';

const action = (id: string, order = 0): WorkflowStep => ({
  id, stepDefinitionId: 'set-variable', type: 'Action', order, configuration: {}, enabled: true,
});
const parallel = (id: string, branches: { id: string; steps: WorkflowStep[] }[], order = 0): WorkflowStep => ({
  id, stepDefinitionId: '', type: 'Parallel', order, configuration: {}, enabled: true, parallel: { branches },
});

const tree = (): WorkflowStep[] => [
  action('antes', 0),
  parallel('par', [{ id: 'r1', steps: [action('a1', 0), action('a2', 1)] }, { id: 'r2', steps: [action('b1', 0)] }], 1),
  action('depois', 2),
];

describe('construtor — ramos paralelos', () => {
  it('a chave de arrastar de um ramo vai e volta', () => {
    expect(parseParentKey(parallelLaneKeyOf('par', 'r2'))).toEqual({ kind: 'lane', parallelId: 'par', laneKey: 'r2' });
  });

  it('insere no fim e numa posição de um ramo, sem tocar o vizinho', () => {
    const atEnd = insertStepInto(tree(), { kind: 'lane', parallelId: 'par', laneKey: 'r2' }, action('b2'));
    expect(findStepInTree(atEnd, 'par')?.parallel?.branches[1].steps.map((one) => one.id)).toEqual(['b1', 'b2']);
    expect(findStepInTree(atEnd, 'par')?.parallel?.branches[0].steps.map((one) => one.id)).toEqual(['a1', 'a2']);
    const atStart = insertStepAtIndex(tree(), { kind: 'lane', parallelId: 'par', laneKey: 'r1' }, action('a0'), 0);
    expect(findStepInTree(atStart, 'par')?.parallel?.branches[0].steps.map((one) => [one.id, one.order])).toEqual([['a0', 0], ['a1', 1], ['a2', 2]]);
  });

  it('move um passo de um ramo para o outro, e acha/remove em qualquer profundidade', () => {
    const moved = moveStepToLocation(tree(), 'a2', { kind: 'lane', parallelId: 'par', laneKey: 'r2' }, 0);
    expect(findStepInTree(moved, 'par')?.parallel?.branches.map((one) => one.steps.map((step) => step.id))).toEqual([['a1'], ['a2', 'b1']]);
    expect(flattenSteps(tree()).map((one) => one.id)).toEqual(['antes', 'par', 'a1', 'a2', 'b1', 'depois']);
    expect(findStepInTree(removeStepFromTree(tree(), 'b1'), 'b1')).toBeNull();
  });

  it('não move o nó para dentro de si mesmo', () => {
    const steps = tree();
    expect(moveStepToLocation(steps, 'par', { kind: 'lane', parallelId: 'par', laneKey: 'r1' }, 0)).toBe(steps);
  });

  it('dentro de um ramo, o que veio antes do nó e antes NESTE ramo — nunca o ramo vizinho', () => {
    expect(collectPriorSteps(tree(), 'a2').map((one) => one.id)).toEqual(['antes', 'a1']);
    expect(collectPriorSteps(tree(), 'b1').map((one) => one.id)).toEqual(['antes']);
    expect(collectPriorStepsForInsert(tree(), { kind: 'lane', parallelId: 'par', laneKey: 'r2' }).map((one) => one.id)).toEqual(['antes', 'b1']);
  });

  it('depois do nó, as saídas de TODOS os ramos estão disponíveis', () => {
    expect(collectPriorSteps(tree(), 'depois').map((one) => one.id)).toEqual(['antes', 'par', 'a1', 'a2', 'b1']);
  });
});

describe('domínio — o nó paralelo nos percursos da árvore', () => {
  it('stepTree desce nos ramos, e o mapa preserva a forma', () => {
    expect(domainFlatten(tree()).map((one) => one.id)).toEqual(['antes', 'par', 'a1', 'a2', 'b1', 'depois']);
    const renamed = mapSteps(tree(), (step) => ({ ...step, signature: `#${step.id}` }));
    expect(renamed[1].parallel?.branches[1].steps[0].signature).toBe('#b1');
  });

  it('a comparação de versões vê o passo que mudou de ramo', () => {
    const after = tree();
    after[1] = parallel('par', [{ id: 'r1', steps: [action('a1', 0)] }, { id: 'r2', steps: [action('a2', 0), action('b1', 1)] }], 1);
    const changes = diffArtifactVersions(['steps'], { steps: tree() }, { steps: after });
    expect(changes).toContainEqual(expect.objectContaining({ kind: 'step-moved', stepId: 'a2' }));
  });
});

describe('pacote — a validação do nó paralelo', () => {
  const pkg = (steps: WorkflowStep[], kernel = '^2.127.0'): MarketplacePlugin => ({
    manifest: { id: 'com.acme.x', version: '1.0.0', kernel, name: 'X', contributes: [] },
    workflows: [{ templateId: 'wf', name: 'WF', eventName: 'workflow.called', enabled: true, version: 1, condition: { kind: 'AlwaysTrue' }, steps } as unknown as WorkflowModuleTemplate],
  } as unknown as MarketplacePlugin);
  const messages = (p: MarketplacePlugin) => workflowStepIssues(p).map((issue) => issue.message);

  it('nó com um ramo só, ou com ramos demais, é recusado', () => {
    expect(messages(pkg([parallel('par', [{ id: 'r1', steps: [] }])]))).toContain('@core.marketplace/issue.step.control-incomplete');
    const many = Array.from({ length: 9 }, (_, index) => ({ id: `r${index}`, steps: [] }));
    expect(messages(pkg([parallel('par', many)]))).toContain('@core.marketplace/issue.step.parallel-branches');
  });

  it('o que pausa dentro de um ramo é recusado, como em qualquer nível que não é o principal', () => {
    const pause: WorkflowStep = { ...action('esp'), stepDefinitionId: 'delay' };
    expect(messages(pkg([parallel('par', [{ id: 'r1', steps: [pause] }, { id: 'r2', steps: [] }])], '^2.127.0')))
      .toContain('@core.marketplace/issue.step.delay-nested');
  });

  it('kernel anterior ao paralelo: o nó e a concorrência pedem o kernel novo', () => {
    const loop: WorkflowStep = {
      id: 'laco', stepDefinitionId: '', type: 'Loop', order: 1, configuration: {}, enabled: true,
      loop: { source: { kind: 'Literal', value: [] }, itemName: 'item', outputName: 'itens', body: [], concurrency: 3 },
    };
    const issues = workflowStepIssues(pkg([parallel('par', [{ id: 'r1', steps: [] }, { id: 'r2', steps: [] }]), loop], '^2.126.0'));
    expect(issues.filter((issue) => issue.message === '@core.marketplace/issue.workflow.feature-kernel').map((issue) => issue.messageParams?.feature))
      .toEqual(['Parallel', 'loop.concurrency']);
  });
});
