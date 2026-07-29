import { describe, it, expect } from 'vitest';
import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import { isCoreCollection, validatePackage, workflowOutRefs } from './pluginReferences';

const base = (overrides: Partial<MarketplacePlugin>): MarketplacePlugin => ({
  summary: '',
  manifest: { id: 'com.acme.x', version: '1.0.0', kernel: '^1.0.0', name: 'X' },
  workflows: [],
  ...overrides,
});

describe('isCoreCollection', () => {
  it('reconhece entidades fixas e lookups', () => {
    expect(isCoreCollection('persons')).toBe(true);
    expect(isCoreCollection('cases')).toBe(true);
    expect(isCoreCollection('caseAreas')).toBe(true);
  });
  it('não reconhece chave de tela namespaced', () => {
    expect(isCoreCollection('com-acme-vendas__produto')).toBe(false);
  });
});

describe('workflowOutRefs', () => {
  it('extrai scriptId, targetWorkflowId e a tela do gatilho', () => {
    const refs = workflowOutRefs({
      templateId: 'wf',
      name: 'W',
      eventName: 'venda.saved',
      version: 1,
      condition: { kind: 'AlwaysTrue' },
      steps: [
        { id: 's1', stepDefinitionId: 'script', type: 'Action', order: 0, enabled: true, configuration: { scriptId: { kind: 'Literal', value: 'scr-1' } } },
        { id: 's2', stepDefinitionId: 'call-workflow', type: 'Action', order: 1, enabled: true, configuration: { targetWorkflowId: { kind: 'Literal', value: 'wf-2' } } },
      ],
    });
    expect(refs).toEqual([
      { kind: 'script', id: 'scr-1', from: 'automação "W"' },
      { kind: 'workflow', id: 'wf-2', from: 'automação "W"' },
      { kind: 'screen', id: 'venda', from: 'automação "W"' },
    ]);
  });
});

describe('validatePackage', () => {
  it('pacote autocontido é válido', () => {
    const pkg = base({
      scripts: [{ templateId: 'scr-1', name: 'S', sourceTs: '', compiledJs: '', inputParams: [], outputParams: [] }],
      workflows: [{ templateId: 'wf-1', name: 'W', eventName: 'workflow.called', version: 1, condition: { kind: 'AlwaysTrue' }, steps: [{ id: 's', stepDefinitionId: 'script', type: 'Action', order: 0, enabled: true, configuration: { scriptId: { kind: 'Literal', value: 'scr-1' } } }] }],
      actions: [{ templateId: 'act-1', key: 'a', title: 'A', icon: 'apps', workflowId: 'wf-1', danger: false, enabled: true, order: 0 }],
      screens: [{ key: 'tela', titleSingular: 'T', titlePlural: 'T', icon: 'apps', titleFieldKey: 'n', viewActionIds: ['act-1'], fields: [{ key: 'n', label: 'N', type: 'text', required: true, order: 0 }] }],
    });
    expect(validatePackage(pkg)).toEqual([]);
  });

  it('referência ao core (persons) é sempre satisfeita', () => {
    const pkg = base({
      screens: [{ key: 'venda', titleSingular: 'V', titlePlural: 'V', icon: 'apps', titleFieldKey: 'n', fields: [
        { key: 'n', label: 'N', type: 'text', required: true, order: 0 },
        { key: 'cliente', label: 'Cliente', type: 'reference', refEntity: 'persons', required: false, order: 1 },
      ] }],
    });
    expect(validatePackage(pkg)).toEqual([]);
  });

  it('aponta action não incluída', () => {
    const pkg = base({
      screens: [{ key: 'tela', titleSingular: 'T', titlePlural: 'T', icon: 'apps', titleFieldKey: 'n', viewActionIds: ['act-sumida'], fields: [{ key: 'n', label: 'N', type: 'text', required: true, order: 0 }] }],
    });
    const issues = validatePackage(pkg);
    expect(issues).toHaveLength(1);
    expect(issues[0].ref).toMatchObject({ kind: 'action', id: 'act-sumida' });
  });

  it('aponta script não incluído referenciado por workflow', () => {
    const pkg = base({
      workflows: [{ templateId: 'wf-1', name: 'W', eventName: 'workflow.called', version: 1, condition: { kind: 'AlwaysTrue' }, steps: [{ id: 's', stepDefinitionId: 'script', type: 'Action', order: 0, enabled: true, configuration: { scriptId: { kind: 'Literal', value: 'scr-ausente' } } }] }],
    });
    expect(validatePackage(pkg).map((i) => i.ref.id)).toEqual(['scr-ausente']);
  });

  it('referência a tela de outro plugin é satisfeita por dependência declarada', () => {
    const pkg = base({
      manifest: { id: 'com.acme.pedidos', version: '1.0.0', kernel: '^1.0.0', name: 'Pedidos', dependencies: { 'com.microteia.vendas': '^1.0.0' } },
      screens: [{ key: 'pedido', titleSingular: 'P', titlePlural: 'P', icon: 'apps', titleFieldKey: 'n', fields: [
        { key: 'n', label: 'N', type: 'text', required: true, order: 0 },
        { key: 'produto', label: 'Produto', type: 'reference', refEntity: 'com-microteia-vendas__produto', required: false, order: 1 },
      ] }],
    });
    expect(validatePackage(pkg)).toEqual([]);
  });

  it('referência a outro plugin SEM dependência declarada é pendente', () => {
    const pkg = base({
      screens: [{ key: 'pedido', titleSingular: 'P', titlePlural: 'P', icon: 'apps', titleFieldKey: 'n', fields: [
        { key: 'produto', label: 'Produto', type: 'reference', refEntity: 'com-microteia-vendas__produto', required: false, order: 0 },
        { key: 'n', label: 'N', type: 'text', required: true, order: 1 },
      ] }],
    });
    expect(validatePackage(pkg).map((i) => i.ref.id)).toEqual(['com-microteia-vendas__produto']);
  });
});
