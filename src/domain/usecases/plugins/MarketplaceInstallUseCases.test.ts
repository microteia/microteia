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
import type { LookupDefinition, LookupOption, TagDefinition } from '../../entities';
import type { ILookupRepository } from '../../repositories/ILookupRepository';
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
  // Honra o id ESCOLHIDO e recusa duplicata, como o repositório real — sem isso o dublê provaria
  // que a instalação chama o método, e não que o identificador chega ao documento.
  async createWorkflowDefinition(tenantId: string, data: Omit<WorkflowDefinition, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>, id?: string) {
    if (id && this.store.has(id)) throw new Error(`Já existe uma automação com o identificador "${id}".`);
    const workflow = { ...data, id: id ?? `gen-${(this.seq += 1)}`, tenantId, createdAt: new Date(), updatedAt: new Date() } as WorkflowDefinition;
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
  async create(tenantId: string, data: ActionDefinitionInput, id?: string) {
    if (id && this.store.has(id)) throw new Error(`Já existe uma ação com o identificador "${id}".`);
    const action = { ...data, id: id ?? `gen-${(this.seq += 1)}`, tenantId, createdAt: new Date(), updatedAt: new Date() } as ActionDefinition;
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
  async createScript(tenantId: string, data: Omit<Script, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>, id?: string) {
    if (id && this.store.has(id)) throw new Error(`Já existe um script com o identificador "${id}".`);
    const script = { ...data, id: id ?? `gen-${(this.seq += 1)}`, tenantId, createdAt: new Date(), updatedAt: new Date() } as Script;
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

/** As OPÇÕES de uma lista, para provar a semeadura: só entra opção em coleção vazia. */
class FakeLookupOptions implements ILookupRepository {
  options: Record<string, LookupOption[]> = {};
  subscribe(): () => void { return () => {}; }
  async getAll(_tenantId: string, collection: string): Promise<LookupOption[]> {
    return this.options[collection] ?? [];
  }
  async create(_tenantId: string, collection: string, option: LookupOption): Promise<LookupOption> {
    this.options[collection] = [...(this.options[collection] ?? []), option];
    return option;
  }
  async recolor(): Promise<void> {}
  async delete(): Promise<void> {}
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
let lookupOptions: FakeLookupOptions;
let tagDefinitions: FakeTagDefinitions;

const deps = () => ({
  installationRepository: installations,
  workflowRepository: workflows as unknown as IWorkflowDefinitionRepository,
  screenRepository: screens as unknown as IScreenDefinitionRepository,
  actionRepository: actions as unknown as IActionRepository,
  scriptRepository: scripts as unknown as IScriptRepository,
  lookupDefinitionRepository: lookupDefinitions,
  lookupRepository: lookupOptions,
  tagDefinitionRepository: tagDefinitions,
});

beforeEach(() => {
  installations = new FakeInstallations();
  workflows = new FakeWorkflows();
  screens = new FakeScreens();
  actions = new FakeActions();
  scripts = new FakeScripts();
  lookupDefinitions = new FakeLookupDefinitions();
  lookupOptions = new FakeLookupOptions();
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
  manifest: { id: 'com.acme.aut', version: '1.0.0', kernel: '^2.0.0', name: 'Aut', permissions: ['workflow:run'] },
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
    manifest: { id: 'com.acme.full', version: '1.0.0', kernel: '^2.0.0', name: 'Full' },
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
    manifest: { id: 'com.acme.full', version: '1.0.0', kernel: '^2.0.0', name: 'Full' },
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
    manifest: { id, version: '1.0.0', kernel: '^2.0.0', name: 'L' },
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
   * Opções SEMENTE: uma extensão entrega a entidade pronta para uso (as Áreas e Fases de um
   * Processo) sem que o kernel conheça nenhuma delas. Só valem para lista vazia — o que já existe
   * é dado do escritório.
   */
  it('semeia as opções de partida quando a lista está vazia', async () => {
    const seeded: MarketplacePlugin = {
      ...lookupPlugin('com.acme.med'),
      lookups: [{
        collection: 'medico_especialidade',
        label: 'Especialidade',
        options: [{ key: 'Clínico', label: 'Clínico' }, { key: 'Pediatra', label: 'Pediatra', color: 'blue' }],
      }],
    };
    await makeInstallMarketplacePluginUseCase(deps()).execute(seeded, actor);
    expect(lookupOptions.options.medico_especialidade).toEqual([
      { key: 'Clínico', label: 'Clínico' },
      { key: 'Pediatra', label: 'Pediatra', color: 'blue' },
    ]);
  });

  it('lista com opções não é semeada — nem reinstalar ressuscita o que o escritório removeu', async () => {
    const d = deps();
    lookupOptions.options.medico_especialidade = [{ key: 'Cirurgião', label: 'Cirurgião' }];
    const seeded: MarketplacePlugin = {
      ...lookupPlugin('com.acme.med'),
      lookups: [{
        collection: 'medico_especialidade',
        label: 'Especialidade',
        options: [{ key: 'Clínico', label: 'Clínico' }],
      }],
    };
    await makeInstallMarketplacePluginUseCase(d).execute(seeded, actor);
    expect(lookupOptions.options.medico_especialidade).toEqual([{ key: 'Cirurgião', label: 'Cirurgião' }]);
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
    plugin.lookups = [{ collection: 'documentTypes', label: 'Tipo de documento' }];
    await makeInstallMarketplacePluginUseCase(deps()).execute(plugin, actor);
    expect(lookupDefinitions.items).toEqual([]);
  });
});

describe('Uninstall — etiquetas sobrevivem', () => {
  const taggedPlugin = (id: string): MarketplacePlugin => ({
    summary: 'Com etiquetas',
    manifest: { id, version: '1.0.0', kernel: '^2.0.0', name: 'T' },
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

  /** Nenhum conjunto de etiquetas resta em código: todos vêm das extensões que trazem as entidades,
   *  e por isso todo conjunto declarado por um pacote ganha o seu documento. */
  it('conjunto de etiquetas do pacote vira documento no escritório', async () => {
    const plugin = taggedPlugin('com.acme.kernel');
    plugin.tagLists = [{ collection: 'caseTags', label: 'Etiquetas: Processos' }];
    await makeInstallMarketplacePluginUseCase(deps()).execute(plugin, actor);
    expect(tagDefinitions.items.map((item) => item.collection)).toContain('caseTags');
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
    manifest: { id: 'com.acme.up', version: v, kernel: '^2.0.0', name: 'Up' },
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
    manifest: { id, version: '1.0.0', kernel: '^2.0.0', name: id },
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

describe('applyPackageArtifacts / releasePackageArtifacts — fluxo de extensões instaladas', () => {
  const dataPlugin: MarketplacePlugin = {
    summary: 'Extensão com dados',
    manifest: { id: 'com.acme.data', version: '1.0.0', kernel: '^2.0.0', name: 'Data' },
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

/**
 * O identificador do pacote É o id do documento no escritório. Antes o banco gerava o id, e a mesma
 * tela mostrava `avisar-cliente` para a automação criada à mão e `NehhFXIJ40ZcaCV2SLjT` para a
 * instalada por pacote — o que também deixava sem resposta a pergunta "por qual nome uma extensão
 * de terceiro apontaria para esta automação?".
 */
describe('Identificador legível — o templateId do pacote vira o id do artefato', () => {
  const identificado = (id: string): MarketplacePlugin => ({
    summary: 'S',
    manifest: { id, version: '1.0.0', kernel: '^2.0.0', name: id },
    scripts: [{ templateId: 'scr-notificar', name: 'Notificar', sourceTs: 'x', compiledJs: 'y', inputParams: [], outputParams: [] }],
    workflows: [{
      templateId: 'wf-pessoa-status', name: 'Ativar/Inativar Pessoa', eventName: 'workflow.called',
      version: 1, condition: { kind: 'AlwaysTrue' }, steps: [],
    }],
    actions: [{ templateId: 'act-pessoa-status', key: 'status_pessoa', title: 'Ativar/Inativar', icon: 'apps', workflowId: 'wf-pessoa-status', danger: false, enabled: true, order: 0 }],
  });

  it('os três artefatos nascem com o identificador do pacote, e não com um id gerado', async () => {
    await applyPackageArtifacts(deps(), identificado('com.a'), actor);

    expect((await workflows.getWorkflowDefinitions('t1'))[0].id).toBe('wf-pessoa-status');
    expect((await actions.getAll('t1'))[0].id).toBe('act-pessoa-status');
    expect((await scripts.getScripts('t1'))[0].id).toBe('scr-notificar');
  });

  it('o id e o sourceId passam a ser a mesma coisa — um conceito, não dois', async () => {
    await applyPackageArtifacts(deps(), identificado('com.a'), actor);

    const wf = (await workflows.getWorkflowDefinitions('t1'))[0];
    expect(wf.sourceId).toBe(wf.id);
  });

  it('a ação aponta para a automação pelo identificador dela', async () => {
    await applyPackageArtifacts(deps(), identificado('com.a'), actor);
    expect((await actions.getAll('t1'))[0].workflowId).toBe('wf-pessoa-status');
  });

  /**
   * O escritório é dono do espaço de nomes: se ele já tem uma automação com aquele identificador, a
   * que chega recebe um derivado do NOME. O `sourceId` continua o universal — é ele que liga um
   * pacote ao outro, e é por isso que o id local pode divergir sem quebrar nada.
   */
  it('identificador já ocupado no escritório: a que chega deriva do nome, e o sourceId não muda', async () => {
    await workflows.createWorkflowDefinition('t1', { name: 'Minha', eventName: 'workflow.called' } as never, 'wf-pessoa-status');

    await applyPackageArtifacts(deps(), identificado('com.a'), actor);

    const instalada = (await workflows.getWorkflowDefinitions('t1')).find((w) => w.sourceId === 'wf-pessoa-status')!;
    expect(instalada.id).toBe('ativar-inativar-pessoa');
    expect(instalada.sourceId).toBe('wf-pessoa-status');
    expect((await actions.getAll('t1'))[0].workflowId).toBe('ativar-inativar-pessoa');
  });

  /** Pacote exportado antes do identificador: o templateId é o id do banco de origem, e não serve. */
  it('templateId que é um id de banco vira um identificador derivado do nome', async () => {
    const legado = identificado('com.a');
    legado.workflows[0].templateId = 'NehhFXIJ40ZcaCV2SLjT';

    await applyPackageArtifacts(deps(), legado, actor);

    const wf = (await workflows.getWorkflowDefinitions('t1'))[0];
    expect(wf.id).toBe('ativar-inativar-pessoa');
    expect(wf.sourceId).toBe('NehhFXIJ40ZcaCV2SLjT');
  });
});

describe('Atualização por sourceRev — reescrita in-place, sem duplicar nem regredir', () => {
  const rev = (id: string, sourceRev: number | undefined, name: string): MarketplacePlugin => ({
    summary: 'S',
    manifest: { id, version: '1.0.0', kernel: '^2.0.0', name: id },
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

  /**
   * O caso do catálogo EMBUTIDO, escrito à mão: nenhum workflow, action ou script carimba revisão.
   * Enquanto a regra era `0 > 0`, o artefato congelava na primeira instalação — "Atualizar" dizia
   * que atualizou e não mudava nada, e só desinstalar e instalar de novo resolvia.
   */
  it('sem revisão dos DOIS lados, o conteúdo é reescrito — é o que "Atualizar" precisa fazer', async () => {
    const d = deps();
    await applyPackageArtifacts(d, rev('com.a', undefined, 'V1'), actor);
    const antes = (await workflows.getWorkflowDefinitions('t1'))[0];

    await applyPackageArtifacts(d, rev('com.a', undefined, 'V2'), actor);

    const depois = await workflows.getWorkflowDefinitions('t1');
    expect(depois).toHaveLength(1);
    // Mesmo id: quem chama este workflow por id continua chamando o mesmo.
    expect(depois[0].id).toBe(antes.id);
    expect(depois[0].name).toBe('V2');
    expect((await actions.getAll('t1'))[0].title).toBe('V2');
    expect((await scripts.getScripts('t1'))[0].name).toBe('V2-s');
  });

  it('pacote SEM revisão não sobrescreve uma cópia versionada — não há como saber qual é a mais nova', async () => {
    const d = deps();
    await applyPackageArtifacts(d, rev('com.a', 200, 'VERSIONADO'), actor);
    await applyPackageArtifacts(d, rev('com.b', undefined, 'SEM REVISÃO'), actor);

    expect((await workflows.getWorkflowDefinitions('t1'))[0].name).toBe('VERSIONADO');
  });

  /**
   * O estado LOCAL do escritório sobrevive à atualização. É o que separa "atualizar" de "desinstalar
   * e instalar de novo": a automação que o escritório desligou continua desligada, e o id não muda.
   */
  it('a atualização preserva o que é do escritório: a automação desligada continua desligada', async () => {
    const d = deps();
    await applyPackageArtifacts(d, rev('com.a', undefined, 'V1'), actor);
    const wf = (await workflows.getWorkflowDefinitions('t1'))[0];
    await workflows.updateWorkflowDefinition('t1', wf.id, { enabled: false });

    await applyPackageArtifacts(d, rev('com.a', undefined, 'V2'), actor);

    const depois = (await workflows.getWorkflowDefinitions('t1'))[0];
    expect(depois.name).toBe('V2');
    expect(depois.enabled).toBe(false);
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
      summary: 'S', manifest: { id: 'com.a', version: '1.0.0', kernel: '^2.0.0', name: 'A' },
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
    manifest: { id: 'com.microteia.produto', version: '1.0.0', kernel: '^2.0.0', name: 'Produtos' },
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
  const patchPlugin = (id: string, fieldKeys: string[], target = 'pushes'): MarketplacePlugin => ({
    summary: 'S',
    manifest: { id, version: '1.0.0', kernel: '^2.0.0', name: id },
    workflows: [],
    screenPatches: [{
      target,
      fields: fieldKeys.map((key, order) => ({ key, label: key, type: 'text' as const, required: false, order })),
    }],
  });

  const pushesScreen = (fields: ScreenDefinition['fields']): ScreenDefinition => ({
    id: 'pushes', tenantId: 't1', origin: 'builtin',
    titleSingular: 'Push', titlePlural: 'Pushes', icon: 'apps', fields,
    titleFieldKey: '', hasNotes: false, hasDocuments: false, hasTags: false,
    listActions: [], viewActionIds: [], cardActionIds: [],
    sidebarOrder: 0, enabled: true, createdAt: new Date(), createdBy: 'u1', updatedAt: new Date(),
  });

  it('acrescenta o campo à tela que já existe, sem virar dona dela', async () => {
    screens.store.set('pushes', pushesScreen([]));

    await makeInstallMarketplacePluginUseCase(deps()).execute(patchPlugin('com.acme.crm', ['crm']), actor);

    const alvo = screens.store.get('pushes')!;
    expect(alvo.fields.map((f) => f.key)).toEqual(['crm']);
    expect(alvo.fields[0].ownerPluginId).toBe('com.acme.crm');
    expect(alvo.fields[0].origin).toBe('plugin');
    // A tela continua de quem era: a extensão não vira dona dela.
    expect(alvo.origin).toBe('builtin');
    expect(alvo.ownerPluginId ?? null).toBeNull();
  });

  it('preserva os campos do escritório e os de outra extensão na mesma tela', async () => {
    screens.store.set('pushes', pushesScreen([
      { key: 'meu', label: 'Meu', type: 'text', required: false, order: 0, origin: 'design', ownerPluginId: null },
      { key: 'outro', label: 'Outro', type: 'text', required: false, order: 1, origin: 'plugin', ownerPluginId: 'com.b' },
    ]));

    await makeInstallMarketplacePluginUseCase(deps()).execute(patchPlugin('com.acme.crm', ['crm']), actor);

    expect(screens.store.get('pushes')!.fields.map((f) => f.key)).toEqual(['meu', 'outro', 'crm']);
  });

  it('desinstalar leva só os campos da extensão — a tela e os demais campos ficam', async () => {
    screens.store.set('pushes', pushesScreen([
      { key: 'meu', label: 'Meu', type: 'text', required: false, order: 0, origin: 'design', ownerPluginId: null },
    ]));
    await makeInstallMarketplacePluginUseCase(deps()).execute(patchPlugin('com.acme.crm', ['crm', 'oab']), actor);

    const result = await makeUninstallMarketplacePluginUseCase(deps()).execute('com.acme.crm', actor);

    expect(result).toMatchObject({ ok: true, removedScreens: 0, removedPatchFields: 2 });
    const prazos = screens.store.get('pushes')!;
    expect(prazos.fields.map((f) => f.key)).toEqual(['meu']);
    expect(prazos.origin).toBe('builtin');
  });

  it('reaplicar é idempotente e remove o campo que sumiu da versão nova', async () => {
    screens.store.set('pushes', pushesScreen([]));
    const d = deps();
    await applyPackageArtifacts(d, patchPlugin('com.acme.crm', ['crm', 'oab']), actor);
    expect(screens.store.get('pushes')!.fields.map((f) => f.key)).toEqual(['crm', 'oab']);

    await applyPackageArtifacts(d, patchPlugin('com.acme.crm', ['crm']), actor);
    expect(screens.store.get('pushes')!.fields.map((f) => f.key)).toEqual(['crm']);
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
      ...pushesScreen([]), id: 'produtos_2', origin: 'plugin', sourceId: 'src-produtos',
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

  /**
   * Uma extensão que oferece um GESTO sobre a tela de outra chega pela mesma lista que o Form Design
   * edita — a aba "Ações". Não há mecanismo paralelo: fosse por um caminho próprio, metade do que
   * aparece no cartão ficaria fora do alcance de quem configura a tela.
   */
  const comAcao = (id: string): MarketplacePlugin => ({
    summary: 'S',
    manifest: { id, version: '1.0.0', kernel: '^2.0.0', name: id },
    workflows: [{
      templateId: 'wf-x', name: 'W', eventName: 'workflow.called', version: 1,
      condition: { kind: 'AlwaysTrue' }, steps: [],
    }],
    actions: [{
      templateId: 'act-x', key: 'x', title: 'Fazer X', icon: 'check',
      workflowId: 'wf-x', enabled: true, order: 0, danger: false,
    }],
    screenPatches: [{ target: 'pushes', fields: [], cardActionIds: ['act-x'], viewActionIds: ['act-x'] }],
  });

  it('a ação do complemento entra na lista da tela alvo, com o id gerado na instalação', async () => {
    screens.store.set('pushes', pushesScreen([]));

    await makeInstallMarketplacePluginUseCase(deps()).execute(comAcao('com.acme.gesto'), actor);

    const [acao] = await actions.getAll('t1');
    const alvo = screens.store.get('pushes')!;
    // O `templateId` do pacote não vai para a tela: quem vai é o id REAL, gerado agora.
    expect(alvo.cardActionIds).toEqual([acao.id]);
    expect(alvo.viewActionIds).toEqual([acao.id]);
    expect(acao.sourceId).toBe('act-x');
    // A tela continua de quem era — a posse fica no artefato, não na lista.
    expect(alvo.ownerPluginId ?? null).toBeNull();
  });

  it('não duplica ao reinstalar, e preserva o que o escritório pôs na lista', async () => {
    screens.store.set('pushes', { ...pushesScreen([]), cardActionIds: ['acao-do-escritorio'] });

    await makeInstallMarketplacePluginUseCase(deps()).execute(comAcao('com.acme.gesto'), actor);
    await makeInstallMarketplacePluginUseCase(deps()).execute(comAcao('com.acme.gesto'), actor);

    const [acao] = await actions.getAll('t1');
    expect(screens.store.get('pushes')!.cardActionIds).toEqual(['acao-do-escritorio', acao.id]);
  });

  it('desinstalar tira só a ação da extensão da lista — a do escritório fica', async () => {
    screens.store.set('pushes', { ...pushesScreen([]), cardActionIds: ['acao-do-escritorio'] });
    await makeInstallMarketplacePluginUseCase(deps()).execute(comAcao('com.acme.gesto'), actor);

    await makeUninstallMarketplacePluginUseCase(deps()).execute('com.acme.gesto', actor);

    expect(screens.store.get('pushes')!.cardActionIds).toEqual(['acao-do-escritorio']);
    expect(screens.store.get('pushes')!.viewActionIds).toEqual([]);
  });
});

describe('Complemento apontando para a tela do PRÓPRIO pacote (pacote legado)', () => {
  const pkg = (): MarketplacePlugin => ({
    summary: 'S',
    manifest: { id: 'com.microteia.produto', version: '1.0.0', kernel: '^2.0.0', name: 'Produtos' },
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

/**
 * Uma tela que descreve OUTRA coleção precisa que a coleção alvo tenha documento próprio em
 * `screenDefinitions`: é o que as Security Rules consultam para autorizar a escrita e para ler quem
 * pode gravar. As rules não têm como procurar "a tela que aponta para esta coleção".
 */
describe('Tela sobre uma coleção existente', () => {
  const boundPlugin: MarketplacePlugin = {
    summary: 'Sobre uma coleção que já existe',
    manifest: { id: 'com.acme.proc', version: '1.0.0', kernel: '^2.0.0', name: 'P' },
    workflows: [],
    screens: [{
      key: 'processos',
      titleSingular: 'Processo',
      titlePlural: 'Processos',
      icon: 'folder',
      titleFieldKey: 'title',
      dataCollection: 'cases',
      eventPrefix: 'case',
      fields: [{ key: 'title', label: 'Título', type: 'text', required: true, order: 0 }],
    }],
  };

  /**
   * O documento da COLEÇÃO ALVO precisa existir mesmo quando a tela tem outro nome: é ele que o
   * curinga das rules procura (`isDeclaredScreen`) antes de autorizar qualquer gravação.
   */
  it('grava a tela e o documento da coleção alvo', async () => {
    await makeInstallMarketplacePluginUseCase(deps()).execute(boundPlugin, actor);

    const screen = screens.store.get('processos');
    expect(screen).toMatchObject({ dataCollection: 'cases', eventPrefix: 'case' });

    const target = screens.store.get('cases');
    expect(target, 'as rules procuram o documento da COLEÇÃO').toBeTruthy();
  });

  it('a coleção alvo que já tem documento é preservada', async () => {
    const d = deps();
    await screens.upsert('t1', 'cases', {
      origin: 'builtin',
      titleSingular: 'Processo',
      titlePlural: 'Processos',
      icon: 'folder',
      titleFieldKey: '',
      fields: [{ key: 'meu', label: 'Meu', type: 'text', required: false, order: 0, origin: 'design' }],
      hasNotes: false,
      hasDocuments: false,
      hasTags: false,
      listActions: [],
      viewActionIds: [],
      cardActionIds: [],
      sidebarOrder: 0,
      enabled: true,
      createdBy: 'u1',
    });
    await makeInstallMarketplacePluginUseCase(d).execute(boundPlugin, actor);

    const target = screens.store.get('cases');
    expect(target?.fields.map((f) => f.key)).toEqual(['meu']);
  });
});

/**
 * A tela cuja CHAVE é a própria coleção que ela descreve — a caixa de intimações foi a primeira. Ela
 * já é o documento que as rules leem, então não há baseline a garantir: gravá-la rebaixava a tela
 * recém-instalada a `builtin` sem campos, e uma tela `builtin` some das listagens e do Form Design.
 */
describe('Tela cuja chave é a própria coleção', () => {
  const selfBound: MarketplacePlugin = {
    summary: 'A chave é a coleção',
    manifest: { id: 'com.acme.push', version: '1.0.0', kernel: '^2.0.0', name: 'Push' },
    workflows: [],
    screens: [{
      key: 'pushes',
      sourceId: 'acme:push',
      titleSingular: 'Push',
      titlePlural: 'Pushes',
      icon: 'inbox',
      titleFieldKey: 'subject',
      dataCollection: 'pushes',
      eventPrefix: 'push',
      fields: [{ key: 'subject', label: 'Assunto', type: 'text', required: false, order: 0 }],
    }],
  };

  it('a instalação não grava a baseline por cima da própria tela', async () => {
    await makeInstallMarketplacePluginUseCase(deps()).execute(selfBound, actor);

    const screen = screens.store.get('pushes');
    expect(screen?.origin, 'a tela continua sendo do pacote').toBe('plugin');
    expect(screen?.fields.map((f) => f.key)).toEqual(['subject']);
    expect(screen?.titlePlural).toBe('Pushes');
  });

  it('a tela rebaixada a builtin por uma instalação antiga é retomada na reinstalação', async () => {
    const d = deps();
    await screens.upsert('t1', 'pushes', {
      origin: 'builtin',
      titleSingular: 'pushes',
      titlePlural: 'pushes',
      icon: 'apps',
      titleFieldKey: 'subject',
      fields: [],
      hasNotes: false,
      hasDocuments: false,
      hasTags: false,
      listActions: [],
      viewActionIds: [],
      cardActionIds: [],
      sidebarOrder: 0,
      enabled: true,
      sourceId: 'acme:push',
      ownerPluginId: 'com.acme.push',
      ownerPluginIds: ['com.acme.push'],
      createdBy: 'u1',
    });

    await applyPackageArtifacts(d, selfBound, actor);

    const screen = screens.store.get('pushes');
    expect(screen?.origin).toBe('plugin');
    expect(screen?.fields.map((f) => f.key)).toEqual(['subject']);
    expect(screen?.titlePlural).toBe('Pushes');
  });

  it('a tela que o escritório já tinha continua sendo dele', async () => {
    const d = deps();
    await screens.upsert('t1', 'pushes', {
      origin: 'design',
      titleSingular: 'Push',
      titlePlural: 'Pushes',
      icon: 'inbox',
      titleFieldKey: 'subject',
      fields: [],
      hasNotes: false,
      hasDocuments: false,
      hasTags: false,
      listActions: [],
      viewActionIds: [],
      cardActionIds: [],
      sidebarOrder: 0,
      enabled: true,
      sourceId: 'acme:push',
      createdBy: 'u1',
    });

    await applyPackageArtifacts(d, selfBound, actor);

    expect(screens.store.get('pushes')?.origin, 'adotada: a desinstalação a devolve').toBe('design');
  });
});

/**
 * Uma propriedade nova da tela (o `recordTabPrefix`, a permissão, o campo de vínculo) chega ao
 * escritório pela ATUALIZAÇÃO da extensão. Se o upsert só valesse para instalações novas, quem já
 * tinha a tela ficaria eternamente na declaração antiga — foi o que se viu quando o registro abria
 * no detalhe genérico apesar de a extensão declarar editor próprio.
 */
describe('atualização de extensão reescreve as propriedades da tela existente', () => {
  const comPrefixo = (recordTabPrefix: string | undefined, sourceRev: number): MarketplacePlugin => ({
    summary: 'S',
    manifest: { id: 'com.acme.ficha', version: '1.0.0', kernel: '^2.0.0', name: 'Ficha' },
    workflows: [],
    screens: [{
      key: 'fichas',
      sourceId: 'acme:ficha',
      sourceRev,
      titleSingular: 'Ficha',
      titlePlural: 'Fichas',
      icon: 'apps',
      fields: [],
      titleFieldKey: 'nome',
      recordTabPrefix,
    }],
  });

  it('a tela instalada sem editor próprio ganha o prefixo na atualização', async () => {
    const d = deps();
    await applyPackageArtifacts(d, comPrefixo(undefined, 1), actor);
    const instalada = (await screens.getAll('t1')).find((s) => s.id === 'fichas')!;
    expect(instalada.recordTabPrefix ?? null).toBeNull();

    await applyPackageArtifacts(d, comPrefixo('ficha-edit:', 2), actor);

    const atualizada = (await screens.getAll('t1')).find((s) => s.id === 'fichas')!;
    expect(atualizada.recordTabPrefix).toBe('ficha-edit:');
    expect(atualizada.id).toBe(instalada.id);
  });

  /** E o caminho de volta: a extensão que ABRE MÃO do editor próprio devolve o registro ao genérico. */
  it('a tela que deixa de declarar o editor volta ao detalhe genérico', async () => {
    const d = deps();
    await applyPackageArtifacts(d, comPrefixo('ficha-edit:', 1), actor);
    await applyPackageArtifacts(d, comPrefixo(undefined, 2), actor);

    const atualizada = (await screens.getAll('t1')).find((s) => s.id === 'fichas')!;
    expect(atualizada.recordTabPrefix ?? null).toBeNull();
  });
});
