import { describe, it, expect } from 'vitest';
import { extensionStepIssues } from './extensionStepIntegrity';
import { workflowStepIssues } from './workflowIntegrity';
import { extensionStepCatalogEntry, extensionStepContribution, extensionStepsOf } from '../../schema/workflowStepContribution';
import type { MarketplacePlugin, WorkflowModuleTemplate } from '../../entities/MarketplacePlugin';
import type { WorkflowStep } from '../../entities/Workflow';

const called = (templateId: string, steps: WorkflowStep[] = []): WorkflowModuleTemplate => ({
  templateId, name: templateId, eventName: 'workflow.called', enabled: true, version: 1,
  condition: { kind: 'AlwaysTrue' }, steps,
} as unknown as WorkflowModuleTemplate);

const pkg = (extra: Partial<MarketplacePlugin> = {}, contributes = [extensionStepContribution(
  { key: 'criar-contato', name: '@com.acme.crm/step.create', icon: 'flowChart', category: 'Integration' },
  { workflowId: 'wf-criar' },
)]): MarketplacePlugin => ({
  manifest: { id: 'com.acme.crm', version: '1.0.0', kernel: '^2.122.0', name: 'CRM', contributes },
  workflows: [called('wf-criar')],
  ...extra,
} as unknown as MarketplacePlugin);

describe('passo declarado pela extensão — a contribuição', () => {
  it('o passo instalado vira entrada do catálogo com o corpo FIXADO e as entradas/saídas do corpo', () => {
    const [step] = extensionStepsOf('com.acme.crm', pkg().manifest.contributes);
    expect(step).toMatchObject({ id: 'com.acme.crm/criar-contato', body: { kind: 'workflow', ref: 'com.acme.crm/wf-criar' } });
    expect(extensionStepCatalogEntry(step)).toMatchObject({
      type: 'SubWorkflow',
      fixedTarget: 'com.acme.crm/wf-criar',
      dynamicInputs: { kind: 'from-target-workflow-parameters', sourceInputId: 'connectorTarget' },
      dynamicOutputs: { kind: 'from-target-workflow-outputs', sourceInputId: 'connectorTarget' },
    });
  });

  it('um pacote correto não tem pendência', () => {
    expect(extensionStepIssues(pkg())).toEqual([]);
  });

  it('recusa o kernel antigo, o corpo ausente, o corpo que não é chamado e o que pausa', () => {
    const messages = (p: MarketplacePlugin) => extensionStepIssues(p).map((issue) => issue.message);
    expect(messages(pkg({ manifest: { ...pkg().manifest, kernel: '^2.100.0' } } as Partial<MarketplacePlugin>)))
      .toContain('@core.marketplace/issue.extension-step.kernel');
    expect(messages(pkg({ workflows: [] }))).toContain('@core.marketplace/issue.extension-step.body-missing');
    expect(messages(pkg({ workflows: [{ ...called('wf-criar'), eventName: 'x.saved' }] })))
      .toContain('@core.marketplace/issue.extension-step.body-not-called');
    const espera = { id: 'esp', stepDefinitionId: 'delay', type: 'Action', order: 0, enabled: true, configuration: {} } as WorkflowStep;
    expect(messages(pkg({ workflows: [called('wf-criar', [espera])] })))
      .toContain('@core.marketplace/issue.extension-step.body-pauses');
  });

  it('recusa chave inválida, ícone fora do catálogo e corpo que não é automação nem script', () => {
    const contribution = (metadata: Record<string, unknown>, impl: unknown) =>
      ({ point: 'workflow.step', id: 'step-x', apiVersion: '1.0.0', metadata, impl });
    const messages = extensionStepIssues(pkg({}, [
      contribution({ key: 'Maiúscula', name: 'x' }, { kind: 'workflow', workflowId: 'wf-criar' }),
      contribution({ key: 'ok', name: 'x', icon: 'nao-existe' }, { kind: 'workflow', workflowId: 'wf-criar' }),
      contribution({ key: 'codigo', name: 'x' }, { kind: 'code', key: 'x' }),
    ] as never)).map((issue) => issue.message);
    expect(messages).toEqual(expect.arrayContaining([
      '@core.marketplace/issue.extension-step.key',
      '@core.marketplace/issue.extension-step.icon',
      '@core.marketplace/issue.extension-step.impl',
    ]));
  });
});

describe('passo de extensão usado numa automação de pacote', () => {
  const usa = (definition: string, dependencies?: Record<string, string>) => workflowStepIssues(pkg({
    manifest: { ...pkg().manifest, ...(dependencies ? { dependencies } : {}) },
    workflows: [called('wf-criar'), called('wf-usa', [
      { id: 'p', stepDefinitionId: definition, type: 'Action', order: 0, enabled: true, configuration: {} } as WorkflowStep,
    ])],
  } as Partial<MarketplacePlugin>)).map((issue) => issue.message);

  it('o passo do próprio pacote vale; o que ele não declara, não', () => {
    expect(usa('com.acme.crm/criar-contato')).toEqual([]);
    expect(usa('com.acme.crm/nao-declarado')).toContain('@core.marketplace/issue.step.unknown-definition');
  });

  it('o passo de OUTRA extensão exige a dependência declarada', () => {
    expect(usa('com.outra.erp/emitir')).toContain('@core.marketplace/issue.step.extension-dependency');
    expect(usa('com.outra.erp/emitir', { 'com.outra.erp': '^1.0.0' })).toEqual([]);
  });
});
