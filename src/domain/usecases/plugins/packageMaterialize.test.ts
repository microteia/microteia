import { describe, it, expect } from 'vitest';
import type { WorkflowStep } from '../../entities/Workflow';
import {
  actionInputFromTemplate,
  rewriteStepLiteral,
  scriptInputFromTemplate,
  workflowInputFromTemplate,
} from './packageMaterialize';

const step = (inputId: string, value: string, extra: Partial<WorkflowStep> = {}): WorkflowStep => ({
  id: 's',
  stepDefinitionId: 'x',
  type: 'Action',
  order: 0,
  enabled: true,
  configuration: { [inputId]: { kind: 'Literal', value } },
  ...extra,
});

describe('rewriteStepLiteral', () => {
  const map = new Map([['tpl', 'real']]);

  it('reescreve o Literal do input pelo id mapeado', () => {
    const [out] = rewriteStepLiteral([step('scriptId', 'tpl')], 'scriptId', map);
    expect((out.configuration.scriptId as { value: string }).value).toBe('real');
  });

  it('deixa intacto o que não está no mapa', () => {
    const [out] = rewriteStepLiteral([step('scriptId', 'desconhecido')], 'scriptId', map);
    expect((out.configuration.scriptId as { value: string }).value).toBe('desconhecido');
  });

  it('reescreve recursivamente em ramos e corpos de laço', () => {
    const nested: WorkflowStep = {
      id: 'ctrl', stepDefinitionId: '', type: 'Condition', order: 0, enabled: true, configuration: {},
      branches: { whenTrue: [step('scriptId', 'tpl')], whenFalse: [] },
    };
    const [out] = rewriteStepLiteral([nested], 'scriptId', map);
    expect((out.branches!.whenTrue[0].configuration.scriptId as { value: string }).value).toBe('real');
  });
});

describe('scriptInputFromTemplate', () => {
  it('remove templateId e marca o dono; sem undefined', () => {
    const input = scriptInputFromTemplate(
      { templateId: 't', name: 'S', sourceTs: 'a', compiledJs: 'b', inputParams: [], outputParams: [], description: undefined },
      'com.acme.x',
    );
    expect('templateId' in input).toBe(false);
    expect(input.ownerPluginId).toBe('com.acme.x');
    expect('description' in input).toBe(false);
  });
});

describe('workflowInputFromTemplate', () => {
  it('remove templateId, marca dono, nasce habilitado, reescreve scriptId e a tela do gatilho', () => {
    const input = workflowInputFromTemplate(
      {
        templateId: 't',
        name: 'W',
        eventName: 'venda.saved',
        version: 1,
        condition: { kind: 'AlwaysTrue' },
        steps: [step('scriptId', 'scr-tpl')],
      },
      'com.acme.x',
      new Map([['scr-tpl', 'scr-real']]),
      new Map([['venda', 'com-acme-x__venda']]),
    );
    expect('templateId' in input).toBe(false);
    expect(input.ownerPluginId).toBe('com.acme.x');
    expect(input.enabled).toBe(true);
    expect(input.eventName).toBe('com-acme-x__venda.saved');
    expect((input.steps[0].configuration.scriptId as { value: string }).value).toBe('scr-real');
  });
});

describe('actionInputFromTemplate', () => {
  it('remove templateId, marca dono/createdBy e reescreve workflowId', () => {
    const input = actionInputFromTemplate(
      { templateId: 't', key: 'a', title: 'A', icon: 'apps', workflowId: 'wf-tpl', danger: false, enabled: true, order: 0 },
      'com.acme.x',
      new Map([['wf-tpl', 'wf-real']]),
      'u1',
    );
    expect('templateId' in input).toBe(false);
    expect(input.workflowId).toBe('wf-real');
    expect(input.ownerPluginId).toBe('com.acme.x');
    expect(input.createdBy).toBe('u1');
  });
});
