import { describe, it, expect, beforeEach } from 'vitest';
import { KERNEL_VERSION } from '../../schema/plugin/kernelVersion';
import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import type { IPluginRegistryRepository, PublishedPlugin } from '../../repositories/IPluginRegistryRepository';
import type { ExtensionPointDefinition } from '../../schema/plugin/extensionPoint';
import { makePublishPluginUseCase } from './PublishPluginUseCase';

const uiPage: ExtensionPointDefinition = {
  id: 'ui.page',
  apiVersion: '1.0.0',
  title: 'Página',
  ownerPluginId: 'core.ui',
  allowedImplKinds: ['code', 'widget'],
  implRequired: true,
  multiple: true,
};

const points = new Map<string, ExtensionPointDefinition>([[uiPage.id, uiPage]]);
const context = { points, kernelVersion: KERNEL_VERSION };

class FakeRegistry implements IPluginRegistryRepository {
  published: MarketplacePlugin[] = [];
  subscribe() {
    return () => {};
  }
  async getAll(): Promise<PublishedPlugin[]> {
    return [];
  }
  async publish(plugin: MarketplacePlugin) {
    this.published.push(plugin);
  }
  async unpublish() {}
}

const plugin = (overrides: Partial<MarketplacePlugin['manifest']> = {}): MarketplacePlugin => ({
  summary: 'x',
  workflows: [],
  manifest: { id: 'com.acme.x', version: '1.0.0', kernel: '^2.0.0', name: 'Acme', ...overrides },
});

let repo: FakeRegistry;
beforeEach(() => {
  repo = new FakeRegistry();
});

describe('PublishPluginUseCase', () => {
  it('publica um plugin válido', async () => {
    const result = await makePublishPluginUseCase(repo).execute(plugin(), 'sys', context);
    expect(result).toEqual({ ok: true });
    expect(repo.published).toHaveLength(1);
  });

  it('recusa e NÃO grava um manifest com id inválido', async () => {
    const result = await makePublishPluginUseCase(repo).execute(plugin({ id: 'acme' }), 'sys', context);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].code).toBe('manifest.id.invalid');
    expect(repo.published).toHaveLength(0);
  });

  it('recusa plugin incompatível com a versão do kernel', async () => {
    const result = await makePublishPluginUseCase(repo).execute(plugin({ kernel: '^0.1.0' }), 'sys', context);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.code === 'manifest.kernel.incompatible')).toBe(true);
    expect(repo.published).toHaveLength(0);
  });

  it('recusa contribuição para um ponto que o kernel não conhece', async () => {
    const withBadContribution = plugin();
    withBadContribution.manifest.contributes = [
      { point: 'ui.inexistente', id: 'x', apiVersion: '1.0.0', metadata: {} },
    ];
    const result = await makePublishPluginUseCase(repo).execute(withBadContribution, 'sys', context);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.code === 'contribution.point.unknown')).toBe(true);
    expect(repo.published).toHaveLength(0);
  });

  it('recusa plugin de terceiro que tenta contribuir código compilado', async () => {
    const withCode = plugin();
    withCode.manifest.contributes = [
      { point: 'ui.page', id: 'tela', apiVersion: '1.0.0', metadata: {}, impl: { kind: 'code', key: 'X' } },
    ];
    const result = await makePublishPluginUseCase(repo).execute(withCode, 'sys', context);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.code === 'contribution.impl.forbidden')).toBe(true);
  });

  it('aceita plugin de terceiro que entrega tela por widget', async () => {
    const withWidget = plugin();
    withWidget.manifest.contributes = [
      { point: 'ui.page', id: 'tela', apiVersion: '1.0.0', metadata: {}, impl: { kind: 'widget', spec: {} } },
    ];
    const result = await makePublishPluginUseCase(repo).execute(withWidget, 'sys', context);
    expect(result).toEqual({ ok: true });
    expect(repo.published).toHaveLength(1);
  });
});
