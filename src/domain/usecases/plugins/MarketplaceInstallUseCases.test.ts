import { describe, it, expect, beforeEach } from 'vitest';
import type { PluginInstallation } from '../../entities/PluginInstallation';
import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import type { WorkflowDefinition } from '../../entities/Workflow';
import type { IPluginInstallationRepository } from '../../repositories/IPluginInstallationRepository';
import type { IWorkflowDefinitionRepository } from '../../repositories/IWorkflowDefinitionRepository';
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

const deps = () => ({
  installationRepository: installations,
  workflowRepository: workflows as unknown as IWorkflowDefinitionRepository,
});

beforeEach(() => {
  installations = new FakeInstallations();
  workflows = new FakeWorkflows();
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

    expect(result).toEqual({ ok: true, removedWorkflows: 1 });
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
