import { describe, it, expect, beforeEach } from 'vitest';
import type { PluginInstallation } from '../../entities/PluginInstallation';
import type { IPluginInstallationRepository } from '../../repositories/IPluginInstallationRepository';
import type { LifecycleActor } from '../../services/pluginLifecycle';
import {
  makeDisablePluginUseCase,
  makeEnablePluginUseCase,
  makeInstallPluginUseCase,
  makeUninstallPluginUseCase,
  makeUpgradePluginUseCase,
} from './PluginLifecycleUseCases';

class FakeRepo implements IPluginInstallationRepository {
  store = new Map<string, PluginInstallation>();
  saved: PluginInstallation[] = [];
  deleted: string[] = [];

  private key(tenantId: string, pluginId: string) {
    return `${tenantId}:${pluginId}`;
  }

  seed(installation: PluginInstallation) {
    this.store.set(this.key(installation.tenantId, installation.pluginId), installation);
  }

  async getAll(tenantId: string) {
    return [...this.store.values()].filter((i) => i.tenantId === tenantId);
  }
  async getById(tenantId: string, pluginId: string) {
    return this.store.get(this.key(tenantId, pluginId)) ?? null;
  }
  subscribe() {
    return () => {};
  }
  async save(installation: PluginInstallation) {
    this.saved.push(installation);
    this.seed(installation);
  }
  async delete(tenantId: string, pluginId: string) {
    this.deleted.push(this.key(tenantId, pluginId));
    this.store.delete(this.key(tenantId, pluginId));
  }
}

const actor: LifecycleActor = { tenantId: 't1', userId: 'u1', now: new Date('2026-07-22T12:00:00Z') };
const input = { pluginId: 'com.acme.x', version: '1.0.0', grantedPermissions: ['workflow:run'] };

const existing: PluginInstallation = {
  pluginId: 'com.acme.x',
  tenantId: 't1',
  version: '1.0.0',
  enabled: true,
  config: {},
  grantedPermissions: ['workflow:run'],
  installedAt: new Date('2026-01-01'),
  installedBy: 'u0',
  updatedAt: new Date('2026-01-01'),
};

let repo: FakeRepo;
beforeEach(() => {
  repo = new FakeRepo();
});

describe('InstallPluginUseCase', () => {
  it('persiste a instalação quando o plugin não existe', async () => {
    const result = await makeInstallPluginUseCase(repo).execute(input, actor);
    expect(result.ok).toBe(true);
    expect(repo.saved).toHaveLength(1);
    expect(await repo.getById('t1', 'com.acme.x')).toMatchObject({ version: '1.0.0', enabled: true });
  });

  it('não persiste quando a regra recusa', async () => {
    repo.seed(existing);
    const result = await makeInstallPluginUseCase(repo).execute(input, actor);
    expect(result).toMatchObject({ ok: false, error: { code: 'already-installed' } });
    expect(repo.saved).toHaveLength(0);
  });
});

describe('Enable / Disable UseCases', () => {
  it('desativa e reativa', async () => {
    repo.seed(existing);
    await makeDisablePluginUseCase(repo).execute('com.acme.x', actor);
    expect((await repo.getById('t1', 'com.acme.x'))?.enabled).toBe(false);

    await makeEnablePluginUseCase(repo).execute('com.acme.x', actor);
    expect((await repo.getById('t1', 'com.acme.x'))?.enabled).toBe(true);
  });

  it('recusa quando não instalado, sem gravar', async () => {
    const result = await makeEnablePluginUseCase(repo).execute('com.acme.x', actor);
    expect(result).toMatchObject({ ok: false, error: { code: 'not-installed' } });
    expect(repo.saved).toHaveLength(0);
  });
});

describe('UpgradePluginUseCase', () => {
  it('atualiza para versão mais recente', async () => {
    repo.seed(existing);
    const result = await makeUpgradePluginUseCase(repo).execute('com.acme.x', '2.0.0', actor);
    expect(result.ok).toBe(true);
    expect((await repo.getById('t1', 'com.acme.x'))?.version).toBe('2.0.0');
  });

  it('recusa downgrade sem gravar', async () => {
    repo.seed(existing);
    const result = await makeUpgradePluginUseCase(repo).execute('com.acme.x', '0.9.0', actor);
    expect(result).toMatchObject({ ok: false, error: { code: 'not-newer-version' } });
    expect(repo.saved).toHaveLength(0);
  });
});

describe('UninstallPluginUseCase', () => {
  it('remove o registro do plugin instalado', async () => {
    repo.seed(existing);
    const result = await makeUninstallPluginUseCase(repo).execute('com.acme.x', actor);
    expect(result).toEqual({ ok: true, installation: null });
    expect(repo.deleted).toEqual(['t1:com.acme.x']);
    expect(await repo.getById('t1', 'com.acme.x')).toBeNull();
  });

  it('recusa remover o que não está instalado, sem deletar', async () => {
    const result = await makeUninstallPluginUseCase(repo).execute('com.acme.x', actor);
    expect(result).toMatchObject({ ok: false, error: { code: 'not-installed' } });
    expect(repo.deleted).toHaveLength(0);
  });
});

describe('ciclo de vida completo', () => {
  it('instalar → desativar → atualizar → remover', async () => {
    await makeInstallPluginUseCase(repo).execute(input, actor);
    await makeDisablePluginUseCase(repo).execute('com.acme.x', actor);
    await makeUpgradePluginUseCase(repo).execute('com.acme.x', '1.5.0', actor);

    const beforeRemoval = await repo.getById('t1', 'com.acme.x');
    expect(beforeRemoval).toMatchObject({ version: '1.5.0', enabled: false });

    await makeUninstallPluginUseCase(repo).execute('com.acme.x', actor);
    expect(await repo.getById('t1', 'com.acme.x')).toBeNull();
  });
});
