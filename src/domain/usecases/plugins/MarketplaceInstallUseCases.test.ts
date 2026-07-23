import { describe, it, expect, beforeEach } from 'vitest';
import type { PluginInstallation } from '../../entities/PluginInstallation';
import type { MarketplacePlugin, ScreenModuleTemplate } from '../../entities/MarketplacePlugin';
import type { WorkflowDefinition, WorkflowStep } from '../../entities/Workflow';
import type { ScreenDefinition, ActionDefinition } from '../../entities';
import type { Script } from '../../entities/Script';
import type { IPluginInstallationRepository } from '../../repositories/IPluginInstallationRepository';
import type { IWorkflowDefinitionRepository } from '../../repositories/IWorkflowDefinitionRepository';
import type { IScreenDefinitionRepository, ScreenDefinitionInput } from '../../repositories/IScreenDefinitionRepository';
import type { IActionRepository, ActionDefinitionInput } from '../../repositories/IActionRepository';
import type { IScriptRepository } from '../../repositories/IScriptRepository';
import type { LifecycleActor } from '../../services/pluginLifecycle';
import {
  makeInstallMarketplacePluginUseCase,
  makeUninstallMarketplacePluginUseCase,
  makeUpgradeMarketplacePluginUseCase,
} from './MarketplaceInstallUseCases';

class FakeInstallations implements IPluginInstallationRepository {
  store = new Map<string, PluginInstallation>();
  async getAll(tenantId: string) {
    return [...this.store.values()].filter((i) => i.tenantId === tenantId);
  }
  async getById(tenantId: string, pluginId: string) {
    return this.store.get(`${tenantId}:${pluginId}`) ?? null;
  }
  subscribe() {
    return () => {};
  }
  async save(installation: PluginInstallation) {
    this.store.set(`${installation.tenantId}:${installation.pluginId}`, installation);
  }
  async delete(tenantId: string, pluginId: string) {
    this.store.delete(`${tenantId}:${pluginId}`);
  }
}

class FakeWorkflows {
  seq = 0;
  store = new Map<string, WorkflowDefinition>();
  async getWorkflowDefinitions(tenantId: string) {
    return [...this.store.values()].filter((w) => w.tenantId === tenantId);
  }
  async createWorkflowDefinition(tenantId: string, data: Omit<WorkflowDefinition, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>) {
    const workflow = { ...data, id: `wf-${(this.seq += 1)}`, tenantId, createdAt: new Date(), updatedAt: new Date() } as WorkflowDefinition;
    this.store.set(workflow.id, workflow);
    return workflow;
  }
  async updateWorkflowSteps(_tenantId: string, id: string, steps: WorkflowStep[]) {
    const wf = this.store.get(id);
    if (wf) this.store.set(id, { ...wf, steps });
  }
  async deleteWorkflowDefinition(_tenantId: string, id: string) {
    this.store.delete(id);
  }
}

class FakeScreens {
  store = new Map<string, ScreenDefinition>();
  async getAll(tenantId: string) {
    return [...this.store.values()].filter((s) => s.tenantId === tenantId);
  }
  async upsert(tenantId: string, screenKey: string, data: ScreenDefinitionInput) {
    const screen = { ...data, id: screenKey, tenantId, createdAt: new Date(), updatedAt: new Date() } as ScreenDefinition;
    this.store.set(screenKey, screen);
    return screen;
  }
  async delete(_tenantId: string, screenKey: string) {
    this.store.delete(screenKey);
  }
}

class FakeActions {
  seq = 0;
  store = new Map<string, ActionDefinition>();
  async getAll(tenantId: string) {
    return [...this.store.values()].filter((a) => a.tenantId === tenantId);
  }
  async create(tenantId: string, data: ActionDefinitionInput) {
    const action = { ...data, id: `act-${(this.seq += 1)}`, tenantId, createdAt: new Date(), updatedAt: new Date() } as ActionDefinition;
    this.store.set(action.id, action);
    return action;
  }
  async delete(_tenantId: string, id: string) {
    this.store.delete(id);
  }
}

class FakeScripts {
  seq = 0;
  store = new Map<string, Script>();
  async getScripts(tenantId: string) {
    return [...this.store.values()].filter((s) => s.tenantId === tenantId);
  }
  async createScript(tenantId: string, data: Omit<Script, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>) {
    const script = { ...data, id: `scr-${(this.seq += 1)}`, tenantId, createdAt: new Date(), updatedAt: new Date() } as Script;
    this.store.set(script.id, script);
    return script;
  }
  async deleteScript(_tenantId: string, id: string) {
    this.store.delete(id);
  }
}

const actor: LifecycleActor = { tenantId: 't1', userId: 'u1', now: new Date('2026-07-23T12:00:00Z') };

let installations: FakeInstallations;
let workflows: FakeWorkflows;
let screens: FakeScreens;
let actions: FakeActions;
let scripts: FakeScripts;

const deps = () => ({
  installationRepository: installations,
  workflowRepository: workflows as unknown as IWorkflowDefinitionRepository,
  screenRepository: screens as unknown as IScreenDefinitionRepository,
  actionRepository: actions as unknown as IActionRepository,
  scriptRepository: scripts as unknown as IScriptRepository,
});

beforeEach(() => {
  installations = new FakeInstallations();
  workflows = new FakeWorkflows();
  screens = new FakeScreens();
  actions = new FakeActions();
  scripts = new FakeScripts();
});

const literalStep = (id: string, stepDefinitionId: string, inputId: string, value: string): WorkflowStep => ({
  id,
  stepDefinitionId,
  type: 'Action',
  order: 0,
  enabled: true,
  configuration: { [inputId]: { kind: 'Literal', value } },
});

const workflowPlugin: MarketplacePlugin = {
  summary: 'Automação',
  manifest: { id: 'com.acme.aut', version: '1.0.0', kernel: '^1.0.0', name: 'Aut', permissions: ['workflow:run'] },
  workflows: [
    { templateId: 'wf-1', name: 'W1', eventName: 'person.saved', version: 1, condition: { kind: 'AlwaysTrue' }, steps: [] },
  ],
};

describe('Install — workflows (compatibilidade)', () => {
  it('materializa o workflow marcado e grava a instalação', async () => {
    const result = await makeInstallMarketplacePluginUseCase(deps()).execute(workflowPlugin, actor);
    expect(result.ok).toBe(true);
    const created = await workflows.getWorkflowDefinitions('t1');
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ name: 'W1', ownerPluginId: 'com.acme.aut', enabled: true });
    // templateId não vaza para a WorkflowDefinition gravada.
    expect('templateId' in created[0]).toBe(false);
  });

  it('recusa reinstalar', async () => {
    await makeInstallMarketplacePluginUseCase(deps()).execute(workflowPlugin, actor);
    const result = await makeInstallMarketplacePluginUseCase(deps()).execute(workflowPlugin, actor);
    expect(result).toMatchObject({ ok: false, error: { code: 'already-installed' } });
  });
});

describe('Install — remapeamento de ids (scripts → workflows → actions → telas)', () => {
  const fullPlugin: MarketplacePlugin = {
    summary: 'Completo',
    manifest: { id: 'com.acme.full', version: '1.0.0', kernel: '^1.0.0', name: 'Full' },
    scripts: [
      { templateId: 'scr-a', name: 'Script A', sourceTs: 'x', compiledJs: 'y', inputParams: [], outputParams: [] },
    ],
    workflows: [
      {
        templateId: 'wf-inner',
        name: 'Inner',
        eventName: 'workflow.called',
        version: 1,
        condition: { kind: 'AlwaysTrue' },
        steps: [literalStep('s1', 'script', 'scriptId', 'scr-a')],
      },
      {
        templateId: 'wf-outer',
        name: 'Outer',
        eventName: 'workflow.called',
        version: 1,
        condition: { kind: 'AlwaysTrue' },
        steps: [literalStep('s1', 'call-workflow', 'targetWorkflowId', 'wf-inner')],
      },
    ],
    actions: [
      { templateId: 'act-x', key: 'x', title: 'X', icon: 'apps', workflowId: 'wf-outer', danger: false, enabled: true, order: 0 },
    ],
    screens: [
      {
        key: 'tela',
        titleSingular: 'Tela',
        titlePlural: 'Telas',
        icon: 'apps',
        titleFieldKey: 'nome',
        viewActionIds: ['act-x'],
        fields: [{ key: 'nome', label: 'Nome', type: 'text', required: true, order: 0 }],
      },
    ],
  };

  it('reescreve scriptId do step pelo id real do script', async () => {
    await makeInstallMarketplacePluginUseCase(deps()).execute(fullPlugin, actor);
    const inner = (await workflows.getWorkflowDefinitions('t1')).find((w) => w.name === 'Inner')!;
    const scriptId = (inner.steps[0].configuration.scriptId as { value: string }).value;
    const realScript = (await scripts.getScripts('t1'))[0];
    expect(scriptId).toBe(realScript.id);
    expect(realScript.ownerPluginId).toBe('com.acme.full');
  });

  it('reescreve targetWorkflowId (workflow que chama workflow) na segunda passada', async () => {
    await makeInstallMarketplacePluginUseCase(deps()).execute(fullPlugin, actor);
    const all = await workflows.getWorkflowDefinitions('t1');
    const outer = all.find((w) => w.name === 'Outer')!;
    const inner = all.find((w) => w.name === 'Inner')!;
    const target = (outer.steps[0].configuration.targetWorkflowId as { value: string }).value;
    expect(target).toBe(inner.id);
  });

  it('reescreve o workflowId da action pelo id real do workflow', async () => {
    await makeInstallMarketplacePluginUseCase(deps()).execute(fullPlugin, actor);
    const action = (await actions.getAll('t1'))[0];
    const outer = (await workflows.getWorkflowDefinitions('t1')).find((w) => w.name === 'Outer')!;
    expect(action.workflowId).toBe(outer.id);
    expect(action.ownerPluginId).toBe('com.acme.full');
  });

  it('reescreve os viewActionIds da tela pelo id real da action', async () => {
    await makeInstallMarketplacePluginUseCase(deps()).execute(fullPlugin, actor);
    const screen = (await screens.getAll('t1'))[0];
    const action = (await actions.getAll('t1'))[0];
    expect(screen.viewActionIds).toEqual([action.id]);
  });
});

describe('Uninstall — cascata dos quatro tipos', () => {
  const fullPlugin: MarketplacePlugin = {
    summary: 'Completo',
    manifest: { id: 'com.acme.full', version: '1.0.0', kernel: '^1.0.0', name: 'Full' },
    scripts: [{ templateId: 'scr-a', name: 'A', sourceTs: 'x', compiledJs: 'y', inputParams: [], outputParams: [] }],
    workflows: [{ templateId: 'wf-a', name: 'A', eventName: 'workflow.called', version: 1, condition: { kind: 'AlwaysTrue' }, steps: [] }],
    actions: [{ templateId: 'act-a', key: 'a', title: 'A', icon: 'apps', workflowId: 'wf-a', danger: false, enabled: true, order: 0 }],
    screens: [{ key: 't', titleSingular: 'T', titlePlural: 'T', icon: 'apps', titleFieldKey: 'n', fields: [{ key: 'n', label: 'N', type: 'text', required: true, order: 0 }] }],
  };

  it('remove telas, actions, workflows e scripts do plugin e conta', async () => {
    await makeInstallMarketplacePluginUseCase(deps()).execute(fullPlugin, actor);
    const result = await makeUninstallMarketplacePluginUseCase(deps()).execute('com.acme.full', actor);

    expect(result).toEqual({ ok: true, removedScreens: 1, removedActions: 1, removedWorkflows: 1, removedScripts: 1 });
    expect(await screens.getAll('t1')).toEqual([]);
    expect(await actions.getAll('t1')).toEqual([]);
    expect(await workflows.getWorkflowDefinitions('t1')).toEqual([]);
    expect(await scripts.getScripts('t1')).toEqual([]);
  });

  it('não toca em artefatos de outro dono nem do usuário', async () => {
    await scripts.createScript('t1', { name: 'meu', sourceTs: '', compiledJs: '', inputParams: [], outputParams: [] } as never);
    await makeInstallMarketplacePluginUseCase(deps()).execute(fullPlugin, actor);
    await makeUninstallMarketplacePluginUseCase(deps()).execute('com.acme.full', actor);
    expect((await scripts.getScripts('t1')).map((s) => s.name)).toEqual(['meu']);
  });

  it('recusa desinstalar o que não está instalado', async () => {
    const result = await makeUninstallMarketplacePluginUseCase(deps()).execute('com.acme.full', actor);
    expect(result).toMatchObject({ ok: false, error: { code: 'not-installed' } });
  });
});

describe('Upgrade — atualização de versão', () => {
  const screenT = (key: string): ScreenModuleTemplate => ({
    key, titleSingular: key, titlePlural: key, icon: 'apps', titleFieldKey: 'n',
    viewActionIds: ['act-1'],
    fields: [{ key: 'n', label: 'N', type: 'text', required: true, order: 0 }],
  });

  const version = (v: string, screenTemplates: ScreenModuleTemplate[]): MarketplacePlugin => ({
    summary: 'S',
    manifest: { id: 'com.acme.up', version: v, kernel: '^1.0.0', name: 'Up' },
    workflows: [{ templateId: 'wf-1', name: 'W', eventName: 'person.saved', version: 1, condition: { kind: 'AlwaysTrue' }, steps: [] }],
    actions: [{ templateId: 'act-1', key: 'a', title: 'A', icon: 'apps', workflowId: 'wf-1', danger: false, enabled: true, order: 0 }],
    screens: screenTemplates,
  });

  const KEY_A = 'com-acme-up__a';
  const KEY_B = 'com-acme-up__b';

  it('sobe a versão da instalação e atualiza o cache de exibição', async () => {
    await makeInstallMarketplacePluginUseCase(deps()).execute(version('1.0.0', [screenT('a')]), actor);
    const result = await makeUpgradeMarketplacePluginUseCase(deps()).execute(version('1.1.0', [screenT('a')]), actor);

    expect(result.ok).toBe(true);
    const installation = await installations.getById('t1', 'com.acme.up');
    expect(installation?.version).toBe('1.1.0');
    expect(installation?.config).toMatchObject({ name: 'Up', workflowCount: 1 });
  });

  it('cria tela nova e remove tela que sumiu na nova versão; dados por chave preservados', async () => {
    await makeInstallMarketplacePluginUseCase(deps()).execute(version('1.0.0', [screenT('a'), screenT('b')]), actor);
    await makeUpgradeMarketplacePluginUseCase(deps()).execute(version('1.1.0', [screenT('a')]), actor);

    const keys = (await screens.getAll('t1')).map((s) => s.id);
    expect(keys).toContain(KEY_A);
    expect(keys).not.toContain(KEY_B);
  });

  it('preserva os campos que o usuário adicionou por cima da tela gerenciada', async () => {
    await makeInstallMarketplacePluginUseCase(deps()).execute(version('1.0.0', [screenT('a')]), actor);
    const current = screens.store.get(KEY_A)!;
    screens.store.set(KEY_A, {
      ...current,
      fields: [...current.fields, { key: 'meu', label: 'Meu', type: 'text', required: false, order: 5, ownerPluginId: null }],
    });

    await makeUpgradeMarketplacePluginUseCase(deps()).execute(version('1.1.0', [screenT('a')]), actor);

    const after = screens.store.get(KEY_A)!;
    const keys = after.fields.map((f) => f.key);
    expect(keys).toContain('meu');
    expect(keys).toContain('n');
  });

  it('regenera actions/workflows/scripts sem duplicar (velhos removidos, novos criados)', async () => {
    await makeInstallMarketplacePluginUseCase(deps()).execute(version('1.0.0', [screenT('a')]), actor);
    const actionIdBefore = (await actions.getAll('t1'))[0].id;

    await makeUpgradeMarketplacePluginUseCase(deps()).execute(version('1.1.0', [screenT('a')]), actor);

    const allActions = await actions.getAll('t1');
    expect(allActions).toHaveLength(1);
    expect(allActions[0].id).not.toBe(actionIdBefore);
    expect(await workflows.getWorkflowDefinitions('t1')).toHaveLength(1);
    // A tela aponta para a action recriada.
    expect((await screens.getAll('t1'))[0].viewActionIds ?? []).not.toContain(actionIdBefore);
  });

  it('recusa versão que não é mais recente', async () => {
    await makeInstallMarketplacePluginUseCase(deps()).execute(version('1.0.0', [screenT('a')]), actor);
    const result = await makeUpgradeMarketplacePluginUseCase(deps()).execute(version('1.0.0', [screenT('a')]), actor);
    expect(result).toMatchObject({ ok: false, error: { code: 'not-newer-version' } });
  });

  it('recusa atualizar o que não está instalado', async () => {
    const result = await makeUpgradeMarketplacePluginUseCase(deps()).execute(version('1.1.0', [screenT('a')]), actor);
    expect(result).toMatchObject({ ok: false, error: { code: 'not-installed' } });
  });
});

describe('pacote Vendas do catálogo (com action + workflow)', () => {
  it('materializa telas + action + workflow, com a action da venda ligada ao workflow real', async () => {
    const { MARKETPLACE_CATALOG } = await import('../../../plugins/marketplace/catalog');
    const vendas = MARKETPLACE_CATALOG.find((p) => p.manifest.id === 'com.curatino.vendas')!;

    await makeInstallMarketplacePluginUseCase(deps()).execute(vendas, actor);

    const venda = (await screens.getAll('t1')).find((s) => s.id === 'com-curatino-vendas__venda')!;
    const action = (await actions.getAll('t1'))[0];
    const wf = (await workflows.getWorkflowDefinitions('t1'))[0];
    expect(venda.viewActionIds).toEqual([action.id]);
    expect(action.workflowId).toBe(wf.id);
    expect(wf.ownerPluginId).toBe('com.curatino.vendas');
  });
});
