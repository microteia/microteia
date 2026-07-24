import { describe, it, expect } from 'vitest';
import { registryDataFromPlugin, pluginFromRegistryDoc } from './pluginRegistryMapping';
import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';

const plugin: MarketplacePlugin = {
  manifest: {
    id: 'com.acme.kanban',
    version: '1.0.0',
    kernel: '^1.0.0',
    name: 'Kanban',
    contributes: [
      { point: 'ui.nav', id: 'kanban', apiVersion: '1.0.0', metadata: { key: 'kanban' } },
      { point: 'ui.page', id: 'kanban', apiVersion: '1.0.0', metadata: { key: 'kanban' }, impl: { kind: 'code', key: 'kanban' } },
    ],
  },
  summary: 'Quadro de processos',
  workflows: [],
  views: [{ key: 'kanban', title: 'Kanban', icon: 'layoutGrid', source: 'export default () => null;' }],
};

describe('pluginRegistryMapping', () => {
  it('preserva views/contributes no round-trip publish→read (regressão do bug do menu)', () => {
    const back = pluginFromRegistryDoc(plugin.manifest.id, registryDataFromPlugin(plugin));
    expect(back.views).toEqual(plugin.views);
    expect(back.manifest.contributes).toHaveLength(2);
    expect(back.summary).toBe('Quadro de processos');
  });

  it('omite chaves ausentes (sem views/screens) em vez de gravar undefined', () => {
    const data = registryDataFromPlugin({ manifest: plugin.manifest, summary: 's', workflows: [] });
    expect('views' in data).toBe(false);
    expect('screens' in data).toBe(false);
    expect(pluginFromRegistryDoc('id', data).views).toBeUndefined();
  });
});
