import { describe, it, expect } from 'vitest';
import { buildPackage } from './packageBuilder';
import { validatePackage } from './pluginReferences';
import { serializePackage, parsePackage } from './packageSerialization';
import type { ScreenDefinition, ActionDefinition } from '../../entities';
import type { Script } from '../../entities/Script';
import type { WorkflowDefinition } from '../../entities/Workflow';
import type { PluginManifest } from '../../schema/plugin/pluginManifest';

const manifest: PluginManifest = {
  id: 'com.acme.vendas',
  version: '1.0.0',
  kernel: '^1.0.0',
  name: 'Vendas',
};

const now = new Date('2026-07-23T00:00:00Z');

const screen = (over: Partial<ScreenDefinition>): ScreenDefinition => ({
  id: 'produto', tenantId: 't1', builtin: false,
  titleSingular: 'Produto', titlePlural: 'Produtos', icon: 'priceTag',
  fields: [], titleFieldKey: 'nome', hasNotes: false, hasDocuments: false, hasTags: false,
  listActions: [], viewActionIds: [], cardActionIds: [],
  ownerPluginId: null, managed: null, sidebarOrder: 0, enabled: true,
  createdAt: now, createdBy: 'u1', updatedAt: now,
  ...over,
});

const action = (over: Partial<ActionDefinition>): ActionDefinition => ({
  id: 'act-1', tenantId: 't1', key: 'venda_resumo', title: 'Resumo', icon: 'shoppingBag',
  workflowId: 'wf-1', danger: false, enabled: true, order: 0,
  ownerPluginId: null, createdAt: now, createdBy: 'u1', updatedAt: now,
  ...over,
});

const workflow = (over: Partial<WorkflowDefinition>): WorkflowDefinition => ({
  id: 'wf-1', tenantId: 't1', name: 'Resumo', eventName: 'workflow.called', version: 1,
  condition: { kind: 'AlwaysTrue' }, steps: [], enabled: true, createdAt: now, updatedAt: now,
  ...over,
});

const script = (over: Partial<Script>): Script => ({
  id: 'scr-1', tenantId: 't1', name: 'Calc', sourceTs: 'a', compiledJs: 'b',
  inputParams: [], outputParams: [], createdAt: now, updatedAt: now,
  ...over,
});

const empty = { screens: [], actions: [], workflows: [], scripts: [] };

describe('buildPackage', () => {
  it('usa o id real como templateId e a key real da tela como key de template', () => {
    const pkg = buildPackage({
      ...empty, manifest, summary: 's',
      screens: [screen({ id: 'produto', viewActionIds: ['act-1'] })],
      actions: [action({ id: 'act-1', workflowId: 'wf-1' })],
      workflows: [workflow({ id: 'wf-1' })],
    });
    expect(pkg.screens?.[0].key).toBe('produto');
    expect(pkg.screens?.[0].viewActionIds).toEqual(['act-1']);
    expect(pkg.actions?.[0].templateId).toBe('act-1');
    expect(pkg.actions?.[0].workflowId).toBe('wf-1');
    expect(pkg.workflows[0].templateId).toBe('wf-1');
  });

  it('inclui views de código e sobrevive ao round-trip serialize→parse', () => {
    const pkg = buildPackage({
      ...empty, manifest, summary: 's',
      views: [{ key: 'kanban', title: 'Kanban', icon: 'layoutGrid', source: 'export default () => null;' }],
    });
    expect(pkg.views).toHaveLength(1);
    expect(pkg.views?.[0]).toMatchObject({ key: 'kanban', source: 'export default () => null;' });

    const parsed = parsePackage(serializePackage(pkg));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.package.views?.[0].source).toBe('export default () => null;');
  });

  it('sem views, a chave "views" é omitida do pacote', () => {
    expect(buildPackage({ ...empty, manifest, summary: 's' }).views).toBeUndefined();
  });

  it('remove campos de sistema e ownerPluginId (inclusive dos campos da tela)', () => {
    const pkg = buildPackage({
      ...empty, manifest, summary: 's',
      screens: [screen({
        ownerPluginId: 'com.acme.vendas',
        fields: [{ key: 'nome', label: 'Nome', type: 'text', required: false, order: 0, ownerPluginId: 'com.acme.vendas' } as ScreenDefinition['fields'][number]],
      })],
      actions: [action({ ownerPluginId: 'com.acme.vendas', createdBy: 'u1' })],
      scripts: [script({ ownerPluginId: 'com.acme.vendas' })],
    });
    const screenT = pkg.screens![0] as unknown as Record<string, unknown>;
    expect('id' in screenT).toBe(false);
    expect('tenantId' in screenT).toBe(false);
    expect('ownerPluginId' in screenT).toBe(false);
    expect('managed' in screenT).toBe(false);
    expect('ownerPluginId' in (pkg.screens![0].fields[0] as unknown as Record<string, unknown>)).toBe(false);
    const actionT = pkg.actions![0] as unknown as Record<string, unknown>;
    expect('id' in actionT).toBe(false);
    expect('ownerPluginId' in actionT).toBe(false);
    expect('createdBy' in actionT).toBe(false);
    expect('ownerPluginId' in (pkg.scripts![0] as unknown as Record<string, unknown>)).toBe(false);
  });

  it('omite arrays opcionais vazias', () => {
    const pkg = buildPackage({ ...empty, manifest, summary: 's', workflows: [workflow({})] });
    expect(pkg.screens).toBeUndefined();
    expect(pkg.actions).toBeUndefined();
    expect(pkg.scripts).toBeUndefined();
    expect(pkg.workflows).toHaveLength(1);
  });

  it('round-trip: pacote com todas as referências incluídas passa em validatePackage', () => {
    const pkg = buildPackage({
      ...empty, manifest, summary: 's',
      screens: [screen({ id: 'produto', viewActionIds: ['act-1'], cardActionIds: ['act-1'] })],
      actions: [action({ id: 'act-1', workflowId: 'wf-1' })],
      workflows: [workflow({ id: 'wf-1' })],
    });
    expect(validatePackage(pkg)).toEqual([]);
  });

  it('referência a artefato não selecionado vira pendência em validatePackage', () => {
    const pkg = buildPackage({
      ...empty, manifest, summary: 's',
      screens: [screen({ id: 'produto', viewActionIds: ['act-ausente'] })],
    });
    const issues = validatePackage(pkg);
    expect(issues).toHaveLength(1);
    expect(issues[0].ref.kind).toBe('action');
    expect(issues[0].ref.id).toBe('act-ausente');
  });

  it('referência a outro plugin é coberta ao declarar a dependência', () => {
    const withDep = buildPackage({
      ...empty,
      manifest: { ...manifest, dependencies: { 'com.curatino.vendas': '^1.0.0' } },
      summary: 's',
      screens: [screen({ id: 'meu_item', fields: [
        { key: 'produto', label: 'Produto', type: 'reference', refEntity: 'com-curatino-vendas__produto', required: false, order: 0 } as ScreenDefinition['fields'][number],
      ] })],
    });
    expect(validatePackage(withDep)).toEqual([]);

    const withoutDep = buildPackage({
      ...empty, manifest, summary: 's',
      screens: [screen({ id: 'meu_item', fields: [
        { key: 'produto', label: 'Produto', type: 'reference', refEntity: 'com-curatino-vendas__produto', required: false, order: 0 } as ScreenDefinition['fields'][number],
      ] })],
    });
    expect(validatePackage(withoutDep)).toHaveLength(1);
  });
});
