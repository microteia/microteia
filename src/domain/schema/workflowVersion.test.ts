import { describe, it, expect } from 'vitest';
import { sameWorkflowContent, workflowVersionContent } from './workflowVersion';

describe('conteúdo de uma versão', () => {
  it('a ordem das chaves não conta; ligar, desligar e a origem não são conteúdo', () => {
    expect(sameWorkflowContent(
      { name: 'A', steps: [{ id: 's', order: 0 }], enabled: true, version: 1 },
      { steps: [{ order: 0, id: 's' }], name: 'A', enabled: false, version: 7, ownerPluginIds: ['x'] },
    )).toBe(true);
  });

  it('um passo a mais é outra versão', () => {
    expect(sameWorkflowContent({ steps: [] }, { steps: [{ id: 's' }] })).toBe(false);
  });

  it('só as chaves de conteúdo entram, e as ausentes não viram null', () => {
    expect(workflowVersionContent({ name: 'A', enabled: true, schedule: null, steps: [] })).toEqual({ name: 'A', steps: [] });
  });
});
