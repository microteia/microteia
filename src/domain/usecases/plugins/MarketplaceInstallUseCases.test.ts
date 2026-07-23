import { describe, it, expect, beforeEach } from 'vitest';
import type { PluginInstallation } from '../../entities/PluginInstallation';
import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import type { WorkflowDefinition } from '../../entities/Workflow';
import type { ScreenDefinition } from '../../entities';
import type { IPluginInstallationRepository } from '../../repositories/IPluginInstallationRepository';
import type { IWorkflowDefinitionRepository } from '../../repositories/IWorkflowDefinitionRepository';
import type { IScreenDefinitionRepository, ScreenDefinitionInput } from '../../repositories/IScreenDefinitionRepository';
import type { LifecycleActor } from '../../services/pluginLifecycle';
import {
  makeInstallMarketplacePluginUseCase,
  makeUninstallMarketplacePluginUseCase,
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
  async createWorkflowDefinition(
    tenantId: string,
    data: Omit<WorkflowDefinition, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>,
  ) {
    const workflow: WorkflowDefinition = {
      ...data,
      id: `wf-${(this.seq += 1)}`,
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.store.set(workflow.id, workflow);
    return workflow;
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

const actor: LifecycleActor = { tenantId: 't1', userId: 'u1', now: new Date('2026-07-22T12:00:00Z') };

const plugin: MarketplacePlugin = {
  summary: 'Exemplo',
  manifest: {
    id: 'com.curatino.boas-vindas',
    version: '1.0.0',
    kernel: '^1.0.0',
    name: 'Boas-vindas',
    permissions: ['workflow:run'],
  },
  workflows: [
    {
      name: 'Boas-vindas ao Cliente',
      eventName: 'person.saved',
      version: 1,
      condition: { kind: 'AlwaysTrue' },
      steps: [],
    },
  ],
};

let installations: FakeInstallations;
let workflows: FakeWorkflows;
let screens: FakeScreens;

const deps = () => ({
  installationRepository: installations,
  workflowRepository: workflows as unknown as IWorkflowDefinitionRepository,
  screenRepository: screens as unknown as IScreenDefinitionRepository,
});

beforeEach(() => {
  installations = new FakeInstallations();
  workflows = new FakeWorkflows();
  screens = new FakeScreens();
});

describe('InstallMarketplacePluginUseCase', () => {
  it('materializa os workflows do plugin e grava a instalação', async () => {
    const result = await makeInstallMarketplacePluginUseCase(deps()).execute(plugin, actor);

    expect(result.ok).toBe(true);
    const created = await workflows.getWorkflowDefinitions('t1');
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      name: 'Boas-vindas ao Cliente',
      ownerPluginId: 'com.curatino.boas-vindas',
      enabled: true,
    });
    expect(await installations.getById('t1', 'com.curatino.boas-vindas')).toMatchObject({
      version: '1.0.0',
      grantedPermissions: ['workflow:run'],
    });
  });

  it('não materializa nem grava se o plugin já está instalado', async () => {
    await makeInstallMarketplacePluginUseCase(deps()).execute(plugin, actor);
    const result = await makeInstallMarketplacePluginUseCase(deps()).execute(plugin, actor);

    expect(result).toMatchObject({ ok: false, error: { code: 'already-installed' } });
    // Continua com só 1 workflow (não duplicou).
    expect(await workflows.getWorkflowDefinitions('t1')).toHaveLength(1);
  });
});

describe('UninstallMarketplacePluginUseCase', () => {
  it('remove os workflows do plugin e o registro de instalação', async () => {
    await makeInstallMarketplacePluginUseCase(deps()).execute(plugin, actor);

    const result = await makeUninstallMarketplacePluginUseCase(deps()).execute(plugin.manifest.id, actor);

    expect(result).toEqual({ ok: true, removedWorkflows: 1, removedScreens: 0 });
    expect(await workflows.getWorkflowDefinitions('t1')).toEqual([]);
    expect(await installations.getById('t1', 'com.curatino.boas-vindas')).toBeNull();
  });

  it('não toca em workflows de outros donos nem nos do próprio usuário', async () => {
    // workflow do usuário, sem ownerPluginId
    await workflows.createWorkflowDefinition('t1', {
      name: 'Meu workflow',
      eventName: 'person.saved',
      version: 1,
      enabled: true,
      condition: { kind: 'AlwaysTrue' },
      steps: [],
    });
    await makeInstallMarketplacePluginUseCase(deps()).execute(plugin, actor);

    await makeUninstallMarketplacePluginUseCase(deps()).execute(plugin.manifest.id, actor);

    const remaining = await workflows.getWorkflowDefinitions('t1');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].name).toBe('Meu workflow');
  });

  it('recusa desinstalar o que não está instalado', async () => {
    const result = await makeUninstallMarketplacePluginUseCase(deps()).execute('com.curatino.boas-vindas', actor);
    expect(result).toMatchObject({ ok: false, error: { code: 'not-installed' } });
  });
});

describe('ciclo completo com o catálogo real', () => {
  it('instala e desinstala o plugin de exemplo do catálogo', async () => {
    const { MARKETPLACE_CATALOG } = await import('../../../plugins/marketplace/catalog');
    const sample = MARKETPLACE_CATALOG[0];

    await makeInstallMarketplacePluginUseCase(deps()).execute(sample, actor);
    const afterInstall = await workflows.getWorkflowDefinitions('t1');
    expect(afterInstall).toHaveLength(1);
    expect(afterInstall[0].ownerPluginId).toBe(sample.manifest.id);

    await makeUninstallMarketplacePluginUseCase(deps()).execute(sample.manifest.id, actor);
    expect(await workflows.getWorkflowDefinitions('t1')).toEqual([]);
  });
});

const screenPlugin: MarketplacePlugin = {
  summary: 'Módulo',
  manifest: { id: 'com.acme.vendas', version: '1.0.0', kernel: '^1.0.0', name: 'Vendas' },
  workflows: [],
  screens: [
    {
      key: 'venda',
      titleSingular: 'Venda',
      titlePlural: 'Vendas',
      icon: 'shoppingBag',
      titleFieldKey: 'numero',
      fields: [
        { key: 'numero', label: 'Número', type: 'text', required: true, order: 0 },
        { key: 'cliente', label: 'Cliente', type: 'reference', refEntity: 'persons', required: true, order: 1 },
        {
          key: 'total', label: 'Total', type: 'currency', required: false, order: 2,
          aggregation: { from: 'item', via: 'venda', op: 'sum', field: 'total' },
        },
      ],
    },
    {
      key: 'item',
      titleSingular: 'Item',
      titlePlural: 'Itens',
      icon: 'shoppingBag',
      titleFieldKey: 'produto',
      parentEntity: 'venda',
      parentFieldKey: 'venda',
      fields: [
        { key: 'venda', label: 'Venda', type: 'reference', refEntity: 'venda', required: true, order: 0 },
        { key: 'total', label: 'Total', type: 'currency', required: false, order: 1, logic: { compute: 'qtd * preco' } },
      ],
    },
  ],
};

describe('materialização de telas (módulo de plugin)', () => {
  it('cria as telas namespaced, gerenciadas e com ownerPluginId', async () => {
    await makeInstallMarketplacePluginUseCase(deps()).execute(screenPlugin, actor);
    const created = await screens.getAll('t1');

    expect(created.map((s) => s.id).sort()).toEqual([
      'com-acme-vendas__item',
      'com-acme-vendas__venda',
    ]);
    for (const screen of created) {
      expect(screen.managed).toBe(true);
      expect(screen.ownerPluginId).toBe('com.acme.vendas');
      expect(screen.fields.every((f) => f.ownerPluginId === 'com.acme.vendas')).toBe(true);
    }
  });

  it('reescreve refs entre telas do pacote e preserva ref ao core', async () => {
    await makeInstallMarketplacePluginUseCase(deps()).execute(screenPlugin, actor);
    const venda = (await screens.getAll('t1')).find((s) => s.id === 'com-acme-vendas__venda')!;
    const item = (await screens.getAll('t1')).find((s) => s.id === 'com-acme-vendas__item')!;

    // ref ao core intacto
    expect(venda.fields.find((f) => f.key === 'cliente')?.refEntity).toBe('persons');
    // agregado aponta para a tela item namespaced
    expect(venda.fields.find((f) => f.key === 'total')?.aggregation?.from).toBe('com-acme-vendas__item');
    // ref e parent do item apontam para a venda namespaced
    expect(item.fields.find((f) => f.key === 'venda')?.refEntity).toBe('com-acme-vendas__venda');
    expect(item.parentEntity).toBe('com-acme-vendas__venda');
    expect(item.parentFieldKey).toBe('venda');
    // compute preservado
    expect(item.fields.find((f) => f.key === 'total')?.logic?.compute).toBe('qtd * preco');
  });

  it('desinstalar remove as telas do plugin e conta certo', async () => {
    await makeInstallMarketplacePluginUseCase(deps()).execute(screenPlugin, actor);
    const result = await makeUninstallMarketplacePluginUseCase(deps()).execute('com.acme.vendas', actor);

    expect(result).toMatchObject({ ok: true, removedScreens: 2, removedWorkflows: 0 });
    expect(await screens.getAll('t1')).toEqual([]);
  });

  it('não remove telas de outro dono nem as do usuário', async () => {
    await screens.upsert('t1', 'minha-tela', { ownerPluginId: null } as never);
    await makeInstallMarketplacePluginUseCase(deps()).execute(screenPlugin, actor);

    await makeUninstallMarketplacePluginUseCase(deps()).execute('com.acme.vendas', actor);
    const remaining = await screens.getAll('t1');
    expect(remaining.map((s) => s.id)).toEqual(['minha-tela']);
  });
});

describe('pacote Vendas do catálogo', () => {
  it('materializa produto, venda e item com as três chaves namespaced', async () => {
    const { MARKETPLACE_CATALOG } = await import('../../../plugins/marketplace/catalog');
    const vendas = MARKETPLACE_CATALOG.find((p) => p.manifest.id === 'com.curatino.vendas')!;
    expect(vendas.screens).toHaveLength(3);

    await makeInstallMarketplacePluginUseCase(deps()).execute(vendas, actor);
    const created = await screens.getAll('t1');
    expect(created.map((s) => s.id).sort()).toEqual([
      'com-curatino-vendas__item',
      'com-curatino-vendas__produto',
      'com-curatino-vendas__venda',
    ]);
  });
});
