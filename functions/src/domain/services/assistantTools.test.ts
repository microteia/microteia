import { describe, expect, it } from 'vitest';
import { AGENT_TOOLS, agentToolByName } from '../schema/agent/agentOps';
import { assistantTools, toolNeedsApproval } from './assistantTools';

const names = (tools: ReturnType<typeof assistantTools>) => tools.map((tool) => tool.name);
const fixed = AGENT_TOOLS.filter((tool) => tool.permission.kind === 'fixed');

describe('assistantTools', () => {
  it('com o curinga e escrita ligada, oferece todas', () => {
    expect(names(assistantTools(['*'], 'confirm'))).toEqual(AGENT_TOOLS.map((tool) => tool.name));
    expect(names(assistantTools(['*'], 'auto'))).toEqual(AGENT_TOOLS.map((tool) => tool.name));
  });

  it('com a escrita desligada, nenhuma ferramenta que grava chega ao modelo', () => {
    const offered = assistantTools(['*'], 'off');
    expect(offered.length).toBeGreaterThan(0);
    expect(offered.every((tool) => !tool.writes)).toBe(true);
    expect(names(offered)).toContain('search_records');
    expect(names(offered)).not.toContain('create_record');
  });

  it('tira a de permissão fixa que a pessoa não tem, e mantém as de coleção', () => {
    const offered = names(assistantTools([], 'confirm'));
    for (const tool of fixed) expect(offered).not.toContain(tool.name);
    expect(offered).toContain('search_records');
    expect(offered).toContain('create_record');
  });

  it('a permissão fixa concedida traz a ferramenta de volta', () => {
    const one = fixed[0];
    if (one.permission.kind !== 'fixed') throw new Error('fixture');
    expect(names(assistantTools([one.permission.id], 'confirm'))).toContain(one.name);
  });
});

describe('toolNeedsApproval', () => {
  it('só confirm, e só para o que grava', () => {
    expect(toolNeedsApproval(agentToolByName('create_record'), 'confirm')).toBe(true);
    expect(toolNeedsApproval(agentToolByName('search_records'), 'confirm')).toBe(false);
    expect(toolNeedsApproval(agentToolByName('create_record'), 'auto')).toBe(false);
    expect(toolNeedsApproval(null, 'confirm')).toBe(false);
  });
});
