import { describe, it, expect } from 'vitest';
import { makeExtensionStepResolver } from './extensionSteps';
import type { StepDefinition } from '../engine/StepDefinition';
import type { WorkflowContext } from '../entities/WorkflowContext';
import type { ExtensionStep } from '../schema/workflowStepContribution';

const calls: { id: string; inputs: Record<string, unknown> }[] = [];
const coreStep = (id: string): StepDefinition => ({
  id, version: 1, name: id, description: '', icon: '', category: 'Integration', type: 'Action',
  configurable: true, inputs: [], outputDefinitions: [],
  createExecutor: () => ({ execute: async (inputs) => { calls.push({ id, inputs }); return { success: true, outputs: { ok: id } }; } }),
});
const core = { resolve: (id: string) => (id === 'call-workflow' || id === 'script' ? coreStep(id) : undefined) };

const crm: ExtensionStep = {
  id: 'com.acme.crm/criar-contato', pluginId: 'com.acme.crm', key: 'criar-contato', name: 'Criar contato',
  description: '', icon: '', category: 'Integration', body: { kind: 'workflow', ref: 'com.acme.crm/wf-criar' },
};
const limpar: ExtensionStep = { ...crm, id: 'com.acme.crm/limpar', key: 'limpar', body: { kind: 'script', ref: 'com.acme.crm/sc-limpar' } };

const resolver = (deactivated: string[] = []) => makeExtensionStepResolver({
  stepsOf: async () => ({
    steps: deactivated.includes('com.acme.crm') ? [] : [crm, limpar],
    installed: new Set(['com.acme.crm']),
    deactivated: new Set(deactivated),
  }),
  core,
});

const context = { stepConfiguration: { connectorTarget: { kind: 'Literal', value: 'outro/alvo' } } } as unknown as WorkflowContext;

describe('passo declarado por extensão', () => {
  it('id do núcleo (sem barra) não é dele: responde null, e o núcleo decide', async () => {
    expect(await resolver()('notify', 't1')).toBeNull();
  });

  it('o corpo automação roda por "Chamar automação" ESPERANDO, com o alvo do PACOTE — não o da configuração', async () => {
    const resolved = await resolver()('com.acme.crm/criar-contato', 't1');
    expect(resolved?.ok).toBe(true);
    if (!resolved?.ok) return;
    expect(resolved.definition).toMatchObject({ type: 'SubWorkflow', fixedTarget: 'com.acme.crm/wf-criar' });
    const result = await resolved.definition.createExecutor().execute({}, context);
    expect(result.outputs).toEqual({ ok: 'call-workflow' });
    expect(calls.at(-1)).toEqual({ id: 'call-workflow', inputs: { targetWorkflowId: 'com.acme.crm/wf-criar', waitForResult: true } });
  });

  it('o corpo script roda pelo sandbox de sempre', async () => {
    const resolved = await resolver()('com.acme.crm/limpar', 't1');
    if (!resolved?.ok) throw new Error('não resolveu');
    await resolved.definition.createExecutor().execute({}, context);
    expect(calls.at(-1)).toEqual({ id: 'script', inputs: { scriptId: 'com.acme.crm/sc-limpar' } });
  });

  it('extensão desligada, ausente, ou sem esse passo: motivos DIFERENTES, nomeando a extensão', async () => {
    expect(await resolver(['com.acme.crm'])('com.acme.crm/criar-contato', 't1'))
      .toMatchObject({ ok: false, error: '@core.automation/step.extension.inactive', errorParams: { extension: 'com.acme.crm' } });
    expect(await resolver()('com.outra/passo', 't1'))
      .toMatchObject({ ok: false, error: '@core.automation/step.extension.missing', errorParams: { extension: 'com.outra' } });
    expect(await resolver()('com.acme.crm/nao-existe', 't1'))
      .toMatchObject({ ok: false, error: '@core.automation/step.extension.unknown-step' });
  });
});
