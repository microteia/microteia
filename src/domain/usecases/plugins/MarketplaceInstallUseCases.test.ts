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
import type { ILookupDefinitionRepository, LookupDefinitionInput } from '../../repositories/ILookupDefinitionRepository';
import type { LookupDefinition, TagDefinition } from '../../entities';
import type { ITagDefinitionRepository, TagDefinitionInput } from '../../repositories/ITagDefinitionRepository';
import {
  makeInstallMarketplacePluginUseCase,
  makeUninstallMarketplacePluginUseCase,
  makeUpgradeMarketplacePluginUseCase,
  applyPackageArtifacts,
  releasePackageArtifacts,
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
  async updateWorkflowDefinition(_tenantId: string, id: string, data: Partial<WorkflowDefinition>) {
    const wf = this.store.get(id);
    if (wf) this.store.set(id, { ...wf, ...data });
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

const upd = <T>(store: Map<string, T>, id: string, data: Partial<T>) => {
  const cur = store.get(id);
  if (cur) store.set(id, { ...cur, ...data });
};

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
  async update(_tenantId: string, id: string, data: Partial<ActionDefinitionInput>) {
    upd(this.store, id, data as Partial<ActionDefinition>);
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
  async updateScript(_tenantId: string, id: string, data: Partial<Script>) {
    upd(this.store, id, data);
  }
  async deleteScript(_tenantId: string, id: string) {
    this.store.delete(id);
  }
}

/**
 * As OPÇÕES ficam numa coleção à parte, que este fake não representa de propósito: o ponto dos
 * testes de lista é que a desinstalação mexe só na declaração, e nunca no dado do escritório.
 */
class FakeLookupDefinitions implements ILookupDefinitionRepository {
  items: LookupDefinition[] = [];
  /** Coleções cuja DECLARAÇÃO foi removida. Nunca há remoção de opção: o repositório não a expõe. */
  deletedCollections: string[] = [];
  subscribe(): () => void { return () => {}; }
  async getAll(): Promise<LookupDefinition[]> { return this.items; }
  async upsert(_tenantId: string, definition: LookupDefinitionInput): Promise<LookupDefinition> {
    const next = { ...definition, createdAt: new Date() };
    const index = this.items.findIndex((item) => item.collection === definition.collection);
    if (index >= 0) this.items[index] = next; else this.items.push(next);
    return next;
  }
  async delete(_tenantId: string, collection: string): Promise<void> {
    this.deletedCollections.push(collection);
    this.items = this.items.filter((item) => item.collection !== collection);
  }
}

/** Mesmo racional do fake de listas: as ETIQUETAS não são representadas aqui de propósito. */
class FakeTagDefinitions implements ITagDefinitionRepository {
  items: TagDefinition[] = [];
  deletedCollections: string[] = [];
  subscribe(): () => void { return () => {}; }
  async getAll(): Promise<TagDefinition[]> { return this.items; }
  async upsert(_tenantId: string, definition: TagDefinitionInput): Promise<TagDefinition> {
    const next = { ...definition, createdAt: new Date() };
    const index = this.items.findIndex((item) => item.collection === definition.collection);
    if (index >= 0) this.items[index] = next; else this.items.push(next);
    return next;
  }
  async delete(_tenantId: string, collection: string): Promise<void> {
    this.deletedCollections.push(collection);
    this.items = this.items.filter((item) => item.collection !== collection);
  }
}

const actor: LifecycleActor = { tenantId: 't1', userId: 'u1', now: new Date('2026-07-23T12:00:00Z') };

let installations: FakeInstallations;
let workflows: FakeWorkflows;
let screens: FakeScreens;
let actions: FakeActions;
let scripts: FakeScripts;
let lookupDefinitions: FakeLookupDefinitions;
let tagDefinitions: FakeTagDefinitions;

const deps = () => ({
  installationRepository: installations,
  workflowRepository: workflows as unknown as IWorkflowDefinitionRepository,
  screenRepository: screens as unknown as IScreenDefinitionRepository,
  actionRepository: actions as unknown as IActionRepository,
  scriptRepository: scripts as unknown as IScriptRepository,
  lookupDefinitionRepository: lookupDefinitions,
  tagDefinitionRepository: tagDefinitions,
});

beforeEach(() => {
  installations = new FakeInstallations();
  workflows = new FakeWorkflows();
  screens = new FakeScreens();
  actions = new FakeActions();
  scripts = new FakeScripts();
  lookupDefinitions = new FakeLookupDefinitions();
  tagDefinitions = new FakeTagDefinitions();
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

    expect(result).toEqual({ ok: true, removedScreens: 1, removedActions: 1, removedWorkflows: 1, removedScripts: 1, removedPatchFields: 0 });
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

describe('Uninstall — listas de opções sobrevivem', () => {
  const lookupPlugin = (id: string): MarketplacePlugin => ({
    summary: 'Com lista',
    manifest: { id, version: '1.0.0', kernel: '^1.0.0', name: 'L' },
    workflows: [],
    lookups: [{ collection: 'medico_especialidade', label: 'Especialidade' }],
    screens: [{
      key: 'medico', titleSingular: 'Médico', titlePlural: 'Médicos', icon: 'apps', titleFieldKey: 'nome',
      fields: [
        { key: 'nome', label: 'Nome', type: 'text', required: true, order: 0 },
        { key: 'especialidade', label: 'Especialidade', type: 'select', required: false, order: 1,
          optionsAllowUserAdd: true, lookupCollection: 'medico_especialidade' },
      ],
    }],
  });

  it('declara a lista na instalação, com o plugin como dono', async () => {
    await makeInstallMarketplacePluginUseCase(deps()).execute(lookupPlugin('com.acme.med'), actor);
    expect(lookupDefinitions.items).toEqual([
      expect.objectContaining({
        collection: 'medico_especialidade',
        label: 'Especialidade',
        ownerPluginIds: ['com.acme.med'],
      }),
    ]);
  });

  /**
   * O bug que originou a mudança: as opções cadastradas pelo escritório sumiam junto com a tela.
   * Agora a desinstalação mexe só na DECLARAÇÃO — a coleção de dados nunca é tocada, e recriar a
   * lista com o mesmo nome reaproveita tudo.
   */
  it('a desinstalação remove a declaração, nunca a coleção de opções', async () => {
    const d = deps();
    await makeInstallMarketplacePluginUseCase(d).execute(lookupPlugin('com.acme.med'), actor);
    await makeUninstallMarketplacePluginUseCase(d).execute('com.acme.med', actor);

    expect(lookupDefinitions.items).toEqual([]);
    // Nenhuma exclusão de dado foi pedida: a coleção `medico_especialidade` continua intacta.
    expect(lookupDefinitions.deletedCollections).toEqual(['medico_especialidade']);
  });

  it('duas extensões na mesma lista: desinstalar uma mantém a declaração', async () => {
    await makeInstallMarketplacePluginUseCase(deps()).execute(lookupPlugin('com.a'), actor);
    await makeInstallMarketplacePluginUseCase(deps()).execute(lookupPlugin('com.b'), actor);
    expect(lookupDefinitions.items[0].ownerPluginIds).toEqual(['com.a', 'com.b']);

    await makeUninstallMarketplacePluginUseCase(deps()).execute('com.a', actor);
    expect(lookupDefinitions.items).toEqual([
      expect.objectContaining({ collection: 'medico_especialidade', ownerPluginIds: ['com.b'] }),
    ]);
  });

  it('lista do kernel não vira documento — ela já é declarada em código', async () => {
    const plugin = lookupPlugin('com.acme.kernel');
    plugin.lookups = [{ collection: 'caseCourts', label: 'Vara/Tribunal' }];
    await makeInstallMarketplacePluginUseCase(deps()).execute(plugin, actor);
    expect(lookupDefinitions.items).toEqual([]);
  });
});

describe('Uninstall — etiquetas sobrevivem', () => {
  const taggedPlugin = (id: string): MarketplacePlugin => ({
    summary: 'Com etiquetas',
    manifest: { id, version: '1.0.0', kernel: '^1.0.0', name: 'T' },
    workflows: [],
    tagLists: [{ collection: 'medico_tags', label: 'Etiquetas: Médicos' }],
    screens: [{
      key: 'medico', titleSingular: 'Médico', titlePlural: 'Médicos', icon: 'apps', titleFieldKey: 'nome',
      hasTags: true, tagCollection: 'medico_tags',
      fields: [{ key: 'nome', label: 'Nome', type: 'text', required: true, order: 0 }],
    }],
  });

  it('declara o conjunto na instalação, com o plugin como dono', async () => {
    await makeInstallMarketplacePluginUseCase(deps()).execute(taggedPlugin('com.acme.med'), actor);
    expect(tagDefinitions.items).toEqual([
      expect.objectContaining({ collection: 'medico_tags', ownerPluginIds: ['com.acme.med'] }),
    ]);
  });

  /**
   * O bug que originou a mudança: as etiquetas viviam numa subcoleção de `screenDefinitions` e eram
   * apagadas junto com a tela. Agora a desinstalação mexe só na DECLARAÇÃO.
   */
  it('a desinstalação remove a declaração, nunca a coleção de etiquetas', async () => {
    const d = deps();
    await makeInstallMarketplacePluginUseCase(d).execute(taggedPlugin('com.acme.med'), actor);
    await makeUninstallMarketplacePluginUseCase(d).execute('com.acme.med', actor);

    expect(tagDefinitions.items).toEqual([]);
    expect(tagDefinitions.deletedCollections).toEqual(['medico_tags']);
  });

  it('duas extensões no mesmo conjunto: desinstalar uma mantém a declaração', async () => {
    await makeInstallMarketplacePluginUseCase(deps()).execute(taggedPlugin('com.a'), actor);
    await makeInstallMarketplacePluginUseCase(deps()).execute(taggedPlugin('com.b'), actor);
    expect(tagDefinitions.items[0].ownerPluginIds).toEqual(['com.a', 'com.b']);

    await makeUninstallMarketplacePluginUseCase(deps()).execute('com.a', actor);
    expect(tagDefinitions.items).toEqual([
      expect.objectContaining({ collection: 'medico_tags', ownerPluginIds: ['com.b'] }),
    ]);
  });

  it('conjunto do kernel não vira documento — já é declarado no registro', async () => {
    const plugin = taggedPlugin('com.acme.kernel');
    plugin.tagLists = [{ collection: 'caseTags', label: 'Etiquetas: Processos' }];
    await makeInstallMarketplacePluginUseCase(deps()).execute(plugin, actor);
    expect(tagDefinitions.items).toEqual([]);
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

  const KEY_A = 'a';
  const KEY_B = 'b';

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
      fields: [...current.fields, { key: 'meu', label: 'Meu', type: 'text', required: false, order: 5, origin: 'design', ownerPluginId: null }],
    });

    await makeUpgradeMarketplacePluginUseCase(deps()).execute(version('1.1.0', [screenT('a')]), actor);

    const after = screens.store.get(KEY_A)!;
    const keys = after.fields.map((f) => f.key);
    expect(keys).toContain('meu');
    expect(keys).toContain('n');
  });

  it('atualiza in-place PRESERVANDO os ids (sem regenerar) quando a revisão não muda', async () => {
    await makeInstallMarketplacePluginUseCase(deps()).execute(version('1.0.0', [screenT('a')]), actor);
    const actionIdBefore = (await actions.getAll('t1'))[0].id;
    const wfIdBefore = (await workflows.getWorkflowDefinitions('t1'))[0].id;

    await makeUpgradeMarketplacePluginUseCase(deps()).execute(version('1.1.0', [screenT('a')]), actor);

    const allActions = await actions.getAll('t1');
    expect(allActions).toHaveLength(1);
    expect(allActions[0].id).toBe(actionIdBefore);
    const allWf = await workflows.getWorkflowDefinitions('t1');
    expect(allWf).toHaveLength(1);
    expect(allWf[0].id).toBe(wfIdBefore);
    // A tela continua apontando para a MESMA action (id estável).
    expect((await screens.getAll('t1'))[0].viewActionIds ?? []).toEqual([actionIdBefore]);
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

describe('Dedup + refcount — extensões que compartilham artefatos', () => {
  const shared = (id: string): MarketplacePlugin => ({
    summary: 'S',
    manifest: { id, version: '1.0.0', kernel: '^1.0.0', name: id },
    scripts: [{ templateId: 'scr-shared', name: 'Sc', sourceTs: 'x', compiledJs: 'y', inputParams: [], outputParams: [] }],
    workflows: [{
      templateId: 'wf-shared', name: 'Wf', eventName: 'workflow.called', version: 1, condition: { kind: 'AlwaysTrue' },
      steps: [literalStep('s1', 'script', 'scriptId', 'scr-shared')],
    }],
    actions: [{ templateId: 'act-shared', key: 'a', title: 'A', icon: 'apps', workflowId: 'wf-shared', danger: false, enabled: true, order: 0 }],
    screens: [{
      key: 'medico', sourceId: 'src-medico', titleSingular: 'Médico', titlePlural: 'Médicos', icon: 'apps',
      titleFieldKey: 'n', viewActionIds: ['act-shared'], fields: [{ key: 'n', label: 'N', type: 'text', required: true, order: 0 }],
    }],
  });

  const installTwo = async () => {
    await makeInstallMarketplacePluginUseCase(deps()).execute(shared('com.a'), actor);
    await makeInstallMarketplacePluginUseCase(deps()).execute(shared('com.b'), actor);
  };

  it('instalar duas extensões com o mesmo artefato NÃO duplica; ambas viram donas', async () => {
    await installTwo();

    const s = await scripts.getScripts('t1');
    const w = await workflows.getWorkflowDefinitions('t1');
    const a = await actions.getAll('t1');
    const sc = await screens.getAll('t1');
    expect([s.length, w.length, a.length, sc.length]).toEqual([1, 1, 1, 1]);
    expect(s[0].ownerPluginIds).toEqual(['com.a', 'com.b']);
    expect(w[0].ownerPluginIds).toEqual(['com.a', 'com.b']);
    expect(a[0].ownerPluginIds).toEqual(['com.a', 'com.b']);
    expect(sc[0].ownerPluginIds).toEqual(['com.a', 'com.b']);
    // A tela fica na chave DECLARADA (uma só, deduplicada) e aponta para a action deduplicada.
    expect(sc[0].id).toBe('medico');
    expect(sc[0].viewActionIds).toEqual([a[0].id]);
  });

  it('remover uma mantém o artefato (a outra usa); remover a outra apaga', async () => {
    await installTwo();

    const first = await makeUninstallMarketplacePluginUseCase(deps()).execute('com.a', actor);
    expect(first).toMatchObject({ ok: true, removedScreens: 0, removedActions: 0, removedWorkflows: 0, removedScripts: 0 });
    expect((await screens.getAll('t1'))[0].ownerPluginIds).toEqual(['com.b']);
    expect((await screens.getAll('t1'))[0].ownerPluginId).toBe('com.b');
    expect((await actions.getAll('t1'))[0].ownerPluginId).toBe('com.b');
    expect(await scripts.getScripts('t1')).toHaveLength(1);

    const second = await makeUninstallMarketplacePluginUseCase(deps()).execute('com.b', actor);
    expect(second).toMatchObject({ ok: true, removedScreens: 1, removedActions: 1, removedWorkflows: 1, removedScripts: 1 });
    expect(await screens.getAll('t1')).toEqual([]);
    expect(await actions.getAll('t1')).toEqual([]);
    expect(await workflows.getWorkflowDefinitions('t1')).toEqual([]);
    expect(await scripts.getScripts('t1')).toEqual([]);
  });

  it('segundo install preserva campos que o usuário adicionou à tela compartilhada', async () => {
    await makeInstallMarketplacePluginUseCase(deps()).execute(shared('com.a'), actor);
    const key = 'medico';
    const cur = screens.store.get(key)!;
    screens.store.set(key, { ...cur, fields: [...cur.fields, { key: 'meu', label: 'Meu', type: 'text', required: false, order: 9, origin: 'design', ownerPluginId: null }] });

    await makeInstallMarketplacePluginUseCase(deps()).execute(shared('com.b'), actor);

    const after = screens.store.get(key)!;
    expect(after.fields.map((f) => f.key)).toEqual(expect.arrayContaining(['n', 'meu']));
    expect(after.ownerPluginIds).toEqual(['com.a', 'com.b']);
  });
});

describe('pacote Vendas do catálogo (com action + workflow)', () => {
  it('materializa telas + action + workflow, com a action da venda ligada ao workflow real', async () => {
    const { vendasPlugin: vendas } = await import('../../../plugins/marketplace/catalog');

    await makeInstallMarketplacePluginUseCase(deps()).execute(vendas, actor);

    const venda = (await screens.getAll('t1')).find((s) => s.id === 'venda')!;
    const action = (await actions.getAll('t1'))[0];
    const wf = (await workflows.getWorkflowDefinitions('t1'))[0];
    expect(venda.viewActionIds).toEqual([action.id]);
    expect(action.workflowId).toBe(wf.id);
    expect(wf.ownerPluginId).toBe('com.microteia.vendas');
  });
});

describe('applyPackageArtifacts / releasePackageArtifacts — fluxo de extensões instaladas', () => {
  const dataPlugin: MarketplacePlugin = {
    summary: 'Extensão com dados',
    manifest: { id: 'com.acme.data', version: '1.0.0', kernel: '^1.0.0', name: 'Data' },
    scripts: [{ templateId: 'scr-a', name: 'A', sourceTs: 'x', compiledJs: 'y', inputParams: [], outputParams: [] }],
    workflows: [{ templateId: 'wf-a', name: 'A', eventName: 'workflow.called', version: 1, condition: { kind: 'AlwaysTrue' }, steps: [] }],
    actions: [{ templateId: 'act-a', key: 'a', title: 'A', icon: 'apps', workflowId: 'wf-a', danger: false, enabled: true, order: 0 }],
    screens: [{ key: 't', titleSingular: 'T', titlePlural: 'T', icon: 'apps', titleFieldKey: 'n', fields: [{ key: 'n', label: 'N', type: 'text', required: true, order: 0 }] }],
  };

  it('materializa telas + action + workflow + script sem depender do registro de instalação', async () => {
    await applyPackageArtifacts(deps(), dataPlugin, actor);
    expect(await screens.getAll('t1')).toHaveLength(1);
    expect(await actions.getAll('t1')).toHaveLength(1);
    expect(await workflows.getWorkflowDefinitions('t1')).toHaveLength(1);
    expect(await scripts.getScripts('t1')).toHaveLength(1);
  });

  it('reaplicar a mesma versão é idempotente (reusa por sourceId, não duplica)', async () => {
    const d = deps();
    await applyPackageArtifacts(d, dataPlugin, actor);
    await applyPackageArtifacts(d, dataPlugin, actor);
    expect(await screens.getAll('t1')).toHaveLength(1);
    expect(await workflows.getWorkflowDefinitions('t1')).toHaveLength(1);
    expect(await actions.getAll('t1')).toHaveLength(1);
    expect(await scripts.getScripts('t1')).toHaveLength(1);
  });

  it('release libera os quatro tipos e conta o que apagou', async () => {
    const d = deps();
    await applyPackageArtifacts(d, dataPlugin, actor);
    const counts = await releasePackageArtifacts(d, 'com.acme.data', actor);
    expect(counts).toEqual({ removedScreens: 1, removedActions: 1, removedWorkflows: 1, removedScripts: 1, removedPatchFields: 0 });
    expect(await screens.getAll('t1')).toEqual([]);
    expect(await actions.getAll('t1')).toEqual([]);
    expect(await workflows.getWorkflowDefinitions('t1')).toEqual([]);
    expect(await scripts.getScripts('t1')).toEqual([]);
  });
});

describe('Atualização por sourceRev — reescrita in-place, sem duplicar nem regredir', () => {
  const rev = (id: string, sourceRev: number | undefined, name: string): MarketplacePlugin => ({
    summary: 'S',
    manifest: { id, version: '1.0.0', kernel: '^1.0.0', name: id },
    scripts: [{ templateId: 'scr-shared', sourceRev, name: `${name}-s`, sourceTs: 'x', compiledJs: 'y', inputParams: [], outputParams: [] }],
    workflows: [{
      templateId: 'wf-shared', sourceRev, name, eventName: 'workflow.called', version: 1, condition: { kind: 'AlwaysTrue' },
      steps: [literalStep('s1', 'script', 'scriptId', 'scr-shared')],
    }],
    actions: [{ templateId: 'act-shared', sourceRev, key: 'a', title: name, icon: 'apps', workflowId: 'wf-shared', danger: false, enabled: true, order: 0 }],
  });

  it('revisão MAIOR reescreve o conteúdo mantendo o mesmo id', async () => {
    const d = deps();
    await applyPackageArtifacts(d, rev('com.a', 100, 'V1'), actor);
    const wfBefore = (await workflows.getWorkflowDefinitions('t1'))[0];
    const actBefore = (await actions.getAll('t1'))[0];

    await applyPackageArtifacts(d, rev('com.a', 200, 'V2'), actor);

    const wf = await workflows.getWorkflowDefinitions('t1');
    const act = await actions.getAll('t1');
    expect(wf).toHaveLength(1);
    expect(wf[0].id).toBe(wfBefore.id);
    expect(wf[0].name).toBe('V2');
    expect(wf[0].sourceRev).toBe(200);
    expect(act[0].id).toBe(actBefore.id);
    expect(act[0].title).toBe('V2');
    expect((await scripts.getScripts('t1'))[0].name).toBe('V2-s');
  });

  it('revisão IGUAL ou MENOR mantém o conteúdo (não regride)', async () => {
    const d = deps();
    await applyPackageArtifacts(d, rev('com.a', 200, 'V2'), actor);
    await applyPackageArtifacts(d, rev('com.a', 100, 'ANTIGO'), actor);

    expect((await workflows.getWorkflowDefinitions('t1'))[0].name).toBe('V2');
    expect((await actions.getAll('t1'))[0].title).toBe('V2');
    expect((await scripts.getScripts('t1'))).toHaveLength(1);
  });

  it('artefato compartilhado por duas extensões atualiza para AMBAS quando a revisão sobe', async () => {
    const d = deps();
    await applyPackageArtifacts(d, rev('com.a', 100, 'V1'), actor);
    await applyPackageArtifacts(d, rev('com.b', 100, 'V1'), actor);
    expect((await workflows.getWorkflowDefinitions('t1'))[0].ownerPluginIds).toEqual(['com.a', 'com.b']);

    await applyPackageArtifacts(d, rev('com.a', 200, 'V2'), actor);

    const wf = await workflows.getWorkflowDefinitions('t1');
    expect(wf).toHaveLength(1);
    expect(wf[0].name).toBe('V2');
    expect(wf[0].ownerPluginIds).toEqual(['com.a', 'com.b']);
  });

  it('legado sem sourceRev (=0) é atualizado uma vez quando chega template com revisão', async () => {
    const d = deps();
    await applyPackageArtifacts(d, rev('com.a', undefined, 'V1'), actor);
    expect((await workflows.getWorkflowDefinitions('t1'))[0].name).toBe('V1');

    await applyPackageArtifacts(d, rev('com.a', 50, 'V2'), actor);
    expect((await workflows.getWorkflowDefinitions('t1'))[0].name).toBe('V2');
  });

  it('artefato que sumiu da versão nova é liberado por refcount (dono único → apaga)', async () => {
    const d = deps();
    const twoWf: MarketplacePlugin = {
      summary: 'S', manifest: { id: 'com.a', version: '1.0.0', kernel: '^1.0.0', name: 'A' },
      workflows: [
        { templateId: 'wf-a', name: 'A', eventName: 'workflow.called', version: 1, condition: { kind: 'AlwaysTrue' }, steps: [] },
        { templateId: 'wf-b', name: 'B', eventName: 'workflow.called', version: 1, condition: { kind: 'AlwaysTrue' }, steps: [] },
      ],
    };
    const oneWf: MarketplacePlugin = { ...twoWf, workflows: [twoWf.workflows[0]] };

    await applyPackageArtifacts(d, twoWf, actor);
    expect(await workflows.getWorkflowDefinitions('t1')).toHaveLength(2);

    await applyPackageArtifacts(d, oneWf, actor);
    const wf = await workflows.getWorkflowDefinitions('t1');
    expect(wf).toHaveLength(1);
    expect(wf[0].name).toBe('A');
  });
});

describe('Adoção de tela do tenant (Form Design → extensão → desinstalar → reinstalar)', () => {
  const SOURCE_ID = '5370049f-34a5-41ca-b73c-470dda93c3c5';

  const userScreen = (): ScreenDefinition => ({
    id: 'produtos',
    tenantId: 't1',
    origin: 'design',
    titleSingular: 'Produto',
    titlePlural: 'Produtos',
    icon: 'apps',
    fields: [{ key: 'nome', label: 'Nome', type: 'text', required: true, order: 0, origin: 'design', ownerPluginId: null }],
    titleFieldKey: 'nome',
    hasNotes: false,
    hasDocuments: false,
    hasTags: false,
    listActions: [],
    viewActionIds: [],
    cardActionIds: [],
    sourceId: SOURCE_ID,
    sidebarOrder: 0,
    enabled: true,
    createdAt: new Date(),
    createdBy: 'u1',
    updatedAt: new Date(),
  });

  const exported = (): MarketplacePlugin => ({
    summary: 'Produtos',
    manifest: { id: 'com.microteia.produto', version: '1.0.0', kernel: '^1.0.0', name: 'Produtos' },
    workflows: [],
    screens: [{
      key: 'produtos', sourceId: SOURCE_ID, titleSingular: 'Produto', titlePlural: 'Produtos', icon: 'apps',
      titleFieldKey: 'nome',
      fields: [{ key: 'nome', label: 'Nome', type: 'text', required: true, order: 0 }],
    }],
  });

  it('instalar REUSA a chave da tela do tenant e a mantém como dela (não vira tela de extensão)', async () => {
    screens.store.set('produtos', userScreen());

    await makeInstallMarketplacePluginUseCase(deps()).execute(exported(), actor);

    const all = await screens.getAll('t1');
    expect(all.map((s) => s.id)).toEqual(['produtos']);
    expect(all[0].origin).toBe('design');
    expect(all[0].ownerPluginIds).toEqual(['com.microteia.produto']);
  });

  it('desinstalar DEVOLVE a tela adotada em vez de apagá-la — a chave da coleção sobrevive', async () => {
    screens.store.set('produtos', userScreen());
    await makeInstallMarketplacePluginUseCase(deps()).execute(exported(), actor);

    const result = await makeUninstallMarketplacePluginUseCase(deps()).execute('com.microteia.produto', actor);

    expect(result).toMatchObject({ ok: true, removedScreens: 0 });
    const screen = screens.store.get('produtos')!;
    expect(screen.origin).toBe('design');
    expect(screen.ownerPluginIds).toEqual([]);
    expect(screen.ownerPluginId).toBeNull();
    expect(screen.managed).toBe(false);
    expect(screen.fields.every((f) => f.origin === 'design' && !f.ownerPluginId)).toBe(true);
  });

  it('reinstalar depois de desinstalar volta para a MESMA chave — nunca uma coleção nova', async () => {
    screens.store.set('produtos', userScreen());
    await makeInstallMarketplacePluginUseCase(deps()).execute(exported(), actor);
    await makeUninstallMarketplacePluginUseCase(deps()).execute('com.microteia.produto', actor);

    await makeInstallMarketplacePluginUseCase(deps()).execute(exported(), actor);

    expect((await screens.getAll('t1')).map((s) => s.id)).toEqual(['produtos']);
  });

  it('tela nascida da extensão continua sendo apagada na desinstalação (chave determinística)', async () => {
    await makeInstallMarketplacePluginUseCase(deps()).execute(exported(), actor);
    expect((await screens.getAll('t1')).map((s) => s.id)).toEqual(['produtos']);

    const result = await makeUninstallMarketplacePluginUseCase(deps()).execute('com.microteia.produto', actor);

    expect(result).toMatchObject({ ok: true, removedScreens: 1 });
    expect(await screens.getAll('t1')).toEqual([]);
  });
});

describe('Complementos — campos acrescentados a telas que já existem', () => {
  const patchPlugin = (id: string, fieldKeys: string[], target = 'persons'): MarketplacePlugin => ({
    summary: 'S',
    manifest: { id, version: '1.0.0', kernel: '^1.0.0', name: id },
    workflows: [],
    screenPatches: [{
      target,
      fields: fieldKeys.map((key, order) => ({ key, label: key, type: 'text' as const, required: false, order })),
    }],
  });

  const personsScreen = (fields: ScreenDefinition['fields']): ScreenDefinition => ({
    id: 'persons', tenantId: 't1', origin: 'builtin',
    titleSingular: 'Pessoa', titlePlural: 'Pessoas', icon: 'apps', fields,
    titleFieldKey: '', hasNotes: false, hasDocuments: false, hasTags: false,
    listActions: [], viewActionIds: [], cardActionIds: [],
    sidebarOrder: 0, enabled: true, createdAt: new Date(), createdBy: 'u1', updatedAt: new Date(),
  });

  it('cria o documento da tela do kernel que ainda não tinha, com o campo da extensão', async () => {
    await makeInstallMarketplacePluginUseCase(deps()).execute(patchPlugin('com.acme.crm', ['crm']), actor);

    const persons = screens.store.get('persons')!;
    expect(persons.fields.map((f) => f.key)).toEqual(['crm']);
    expect(persons.fields[0].ownerPluginId).toBe('com.acme.crm');
    expect(persons.fields[0].origin).toBe('plugin');
    // A tela continua do kernel: a extensão não vira dona dela.
    expect(persons.origin).toBe('builtin');
    expect(persons.ownerPluginId ?? null).toBeNull();
    expect(persons.sidebarOrder).toBe(0);
  });

  it('preserva os campos do escritório e os de outra extensão na mesma tela', async () => {
    screens.store.set('persons', personsScreen([
      { key: 'meu', label: 'Meu', type: 'text', required: false, order: 0, origin: 'design', ownerPluginId: null },
      { key: 'outro', label: 'Outro', type: 'text', required: false, order: 1, origin: 'plugin', ownerPluginId: 'com.b' },
    ]));

    await makeInstallMarketplacePluginUseCase(deps()).execute(patchPlugin('com.acme.crm', ['crm']), actor);

    expect(screens.store.get('persons')!.fields.map((f) => f.key)).toEqual(['meu', 'outro', 'crm']);
  });

  it('desinstalar leva só os campos da extensão — a tela e os demais campos ficam', async () => {
    screens.store.set('persons', personsScreen([
      { key: 'meu', label: 'Meu', type: 'text', required: false, order: 0, origin: 'design', ownerPluginId: null },
    ]));
    await makeInstallMarketplacePluginUseCase(deps()).execute(patchPlugin('com.acme.crm', ['crm', 'oab']), actor);

    const result = await makeUninstallMarketplacePluginUseCase(deps()).execute('com.acme.crm', actor);

    expect(result).toMatchObject({ ok: true, removedScreens: 0, removedPatchFields: 2 });
    const persons = screens.store.get('persons')!;
    expect(persons.fields.map((f) => f.key)).toEqual(['meu']);
    expect(persons.origin).toBe('builtin');
  });

  it('reaplicar é idempotente e remove o campo que sumiu da versão nova', async () => {
    const d = deps();
    await applyPackageArtifacts(d, patchPlugin('com.acme.crm', ['crm', 'oab']), actor);
    expect(screens.store.get('persons')!.fields.map((f) => f.key)).toEqual(['crm', 'oab']);

    await applyPackageArtifacts(d, patchPlugin('com.acme.crm', ['crm']), actor);
    expect(screens.store.get('persons')!.fields.map((f) => f.key)).toEqual(['crm']);
  });

  it('complemento cujo alvo NÃO existe no escritório é ignorado, sem criar tela', async () => {
    await makeInstallMarketplacePluginUseCase(deps()).execute(
      { ...patchPlugin('com.acme.crm', ['crm']), screenPatches: [{ target: 'nao-existe', fields: [] }] },
      actor,
    );
    expect(await screens.getAll('t1')).toEqual([]);
  });

  it('alvo por sourceId acha a tela de outra extensão pela chave que ela recebeu no destino', async () => {
    screens.store.set('produtos_2', {
      ...personsScreen([]), id: 'produtos_2', origin: 'plugin', sourceId: 'src-produtos',
      ownerPluginId: 'com.b', ownerPluginIds: ['com.b'],
    });

    await makeInstallMarketplacePluginUseCase(deps()).execute({
      ...patchPlugin('com.acme.crm', []),
      screenPatches: [{
        target: 'src-produtos', targetKind: 'sourceId',
        fields: [{ key: 'ncm', label: 'NCM', type: 'text', required: false, order: 0 }],
      }],
    }, actor);

    const alvo = screens.store.get('produtos_2')!;
    expect(alvo.fields.map((f) => f.key)).toEqual(['ncm']);
    expect(alvo.ownerPluginIds).toEqual(['com.b']);
  });
});

describe('Complemento apontando para a tela do PRÓPRIO pacote (pacote legado)', () => {
  const pkg = (): MarketplacePlugin => ({
    summary: 'S',
    manifest: { id: 'com.microteia.produto', version: '1.0.0', kernel: '^1.0.0', name: 'Produtos' },
    workflows: [],
    screens: [{
      key: 'produtos', sourceId: 'src-produtos', titleSingular: 'Produto', titlePlural: 'Produtos',
      icon: 'apps', titleFieldKey: 'nome',
      fields: [
        { key: 'nome', label: 'Nome', type: 'text', required: true, order: 0 },
        { key: 'preco', label: 'Preço', type: 'currency', required: false, order: 1 },
      ],
    }],
    screenPatches: [{
      target: 'src-produtos', targetKind: 'sourceId',
      fields: [{ key: 'novo', label: 'Novo', type: 'text', required: false, order: 2 }],
    }],
  });

  it('não apaga os campos da tela: o complemento sobre a própria tela é ignorado', async () => {
    const d = deps();
    await applyPackageArtifacts(d, pkg(), actor);
    await applyPackageArtifacts(d, pkg(), actor);

    expect(screens.store.get('produtos')!.fields.map((f) => f.key)).toEqual(['nome', 'preco']);
  });
});
