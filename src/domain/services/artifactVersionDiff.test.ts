import { describe, it, expect } from 'vitest';
import { diffArtifactVersions } from './artifactVersionDiff';
import { SCRIPT_VERSION_CONTENT_KEYS, WORKFLOW_VERSION_CONTENT_KEYS } from '../schema/workflowVersion';
import type { WorkflowStep } from '../entities/Workflow';

const step = (id: string, order: number, configuration: Record<string, unknown> = {}, extra: Partial<WorkflowStep> = {}): WorkflowStep => ({
  id, stepDefinitionId: 'notify', type: 'Action', order, enabled: true,
  configuration: configuration as WorkflowStep['configuration'], ...extra,
});
const lit = (value: unknown) => ({ kind: 'Literal', value });

describe('comparar versões de uma automação', () => {
  it('versões iguais não têm diferença; o que não é conteúdo (enabled) não conta', () => {
    const v = { name: 'A', eventName: 'x.saved', steps: [step('a', 0)], enabled: true };
    expect(diffArtifactVersions(WORKFLOW_VERSION_CONTENT_KEYS, v, { ...v, enabled: false })).toEqual([]);
  });

  it('campos do topo, passo acrescentado, retirado e com a configuração mudada — dizendo quais entradas', () => {
    const before = { name: 'A', eventName: 'x.saved', steps: [step('a', 0, { title: lit('Oi') }), step('b', 1)] };
    const after = { name: 'B', eventName: 'x.saved', steps: [step('a', 0, { title: lit('Olá') }), step('c', 1)] };
    expect(diffArtifactVersions(WORKFLOW_VERSION_CONTENT_KEYS, before, after)).toEqual([
      { kind: 'field', key: 'name' },
      { kind: 'step-changed', stepId: 'a', type: 'Action', stepDefinitionId: 'notify', keys: ['configuration.title'] },
      { kind: 'step-added', stepId: 'c', type: 'Action', stepDefinitionId: 'notify' },
      { kind: 'step-removed', stepId: 'b', type: 'Action', stepDefinitionId: 'notify' },
    ]);
  });

  it('o passo que trocou de lugar — de ordem ou para dentro de um ramo — é "movido", não "mudado"', () => {
    const cond = (children: WorkflowStep[]): WorkflowStep => ({
      ...step('if', 2), stepDefinitionId: '', type: 'Condition', condition: { kind: 'AlwaysTrue' },
      branches: { whenTrue: children, whenFalse: [] },
    });
    const before = { steps: [step('a', 0), step('b', 1), cond([])] };
    const after = { steps: [step('b', 0), cond([step('a', 0)])] };
    const changes = diffArtifactVersions(WORKFLOW_VERSION_CONTENT_KEYS, before, after);
    expect(changes.filter((one) => one.kind === 'step-moved').map((one) => 'stepId' in one && one.stepId)).toEqual(['a']);
    expect(changes.some((one) => one.kind === 'step-changed')).toBe(false);
  });

  it('o script compara o código por linhas e não lista o compilado', () => {
    const before = { name: 'S', sourceTs: 'a\nb\nc', compiledJs: 'x' };
    const after = { name: 'S', sourceTs: 'a\nB\nc\nd', compiledJs: 'y' };
    expect(diffArtifactVersions(SCRIPT_VERSION_CONTENT_KEYS, before, after)).toEqual([
      { kind: 'code', key: 'sourceTs', added: 2, removed: 1 },
    ]);
  });
});
