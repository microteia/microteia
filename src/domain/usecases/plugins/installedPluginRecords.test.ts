import { describe, it, expect } from 'vitest';
import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import type { PluginInstallation } from '../../entities/PluginInstallation';
import { createPluginHost } from '../../../kernel';
import { CORE_PLUGINS } from '../../../plugins';
import { guiaPlugin } from '../../../plugins/marketplace/catalog';
import { UI_NAV_POINT, UI_PAGE_POINT } from '../../../presentation/shared/uiExtensionPoints';
import { installedPluginRecords } from './installedPluginRecords';

const plugin = (id: string, contributes: unknown[] = []): MarketplacePlugin => ({
  summary: id,
  manifest: { id, version: '1.0.0', kernel: '^1.0.0', name: id, contributes: contributes as never },
  workflows: [],
});

const installation = (pluginId: string, enabled: boolean): PluginInstallation => ({
  pluginId,
  tenantId: 't1',
  version: '1.0.0',
  enabled,
  config: {},
  grantedPermissions: [],
  installedAt: new Date(),
  installedBy: 'u1',
  updatedAt: new Date(),
});

describe('installedPluginRecords', () => {
  const catalog = [plugin('com.acme.a'), plugin('com.acme.b')];

  it('devolve record só dos instalados e habilitados', () => {
    const records = installedPluginRecords(catalog, [installation('com.acme.a', true)]);
    expect(records.map((r) => r.manifest.id)).toEqual(['com.acme.a']);
  });

  it('exclui os desabilitados', () => {
    const records = installedPluginRecords(catalog, [installation('com.acme.a', false)]);
    expect(records).toEqual([]);
  });

  it('marca todo plugin instalado como não confiável', () => {
    const records = installedPluginRecords(catalog, [installation('com.acme.a', true)]);
    expect(records[0].trusted).toBe(false);
  });

  it('usa o manifest vindo do catálogo', () => {
    const records = installedPluginRecords(catalog, [installation('com.acme.b', true)]);
    expect(records[0].manifest.name).toBe('com.acme.b');
  });

  it('ignora instalação órfã (id fora do catálogo — despublicado depois de instalar)', () => {
    const records = installedPluginRecords(catalog, [installation('com.acme.sumiu', true)]);
    expect(records).toEqual([]);
  });

  it('sem instalações, nada é carregado', () => {
    expect(installedPluginRecords(catalog, [])).toEqual([]);
  });

  it('plugin com views (fonte confiável do catálogo) é trusted e recebe marcadores ExtensionViewRef', () => {
    const withView: MarketplacePlugin = {
      ...plugin('com.acme.kanban', [
        { point: UI_PAGE_POINT, id: 'kanban', apiVersion: '1.0.0', metadata: { key: 'kanban' }, impl: { kind: 'code', key: 'kanban' } },
      ]),
      views: [{ key: 'kanban', title: 'Kanban', icon: 'layoutGrid', source: 'export default () => null;' }],
    };
    const records = installedPluginRecords([withView], [installation('com.acme.kanban', true)]);
    expect(records[0].trusted).toBe(true);
    expect(records[0].implementations?.kanban).toMatchObject({
      kind: 'extension-view',
      pluginId: 'com.acme.kanban',
      viewKey: 'kanban',
    });
  });
});

describe('carga por tenant — integração com o host', () => {
  const guia = guiaPlugin;

  const navKeys = (host: ReturnType<typeof createPluginHost>) =>
    host.contributions.query(UI_NAV_POINT).map((c) => (c.metadata as { key: string }).key);
  const pageKeys = (host: ReturnType<typeof createPluginHost>) =>
    host.contributions.query(UI_PAGE_POINT).map((c) => (c.metadata as { key?: string }).key).filter(Boolean);

  it('o plugin Guia existe no catálogo e contribui nav + página widget', () => {
    expect(guia).toBeDefined();
    expect(guia?.manifest.contributes?.some((c) => c.point === UI_NAV_POINT)).toBe(true);
    const widgetPage = guia?.manifest.contributes?.find((c) => c.point === UI_PAGE_POINT);
    expect(widgetPage?.impl).toMatchObject({ kind: 'widget' });
  });

  it('sem o plugin instalado, o host base NÃO tem o menu nem a página "guia"', () => {
    const host = createPluginHost();
    host.load(CORE_PLUGINS);
    expect(navKeys(host)).not.toContain('guia');
    expect(pageKeys(host)).not.toContain('guia');
  });

  it('carregando core + Guia (instalado), o menu e a página "guia" aparecem', () => {
    const host = createPluginHost();
    const records = [...CORE_PLUGINS, ...installedPluginRecords([guiaPlugin], [installation('com.curatino.guia', true)])];
    const result = host.load(records);

    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(navKeys(host)).toContain('guia');
    expect(pageKeys(host)).toContain('guia');
    expect(host.isLoaded('com.curatino.guia')).toBe(true);
  });

  it('a página widget do plugin instalado é aceita mesmo sendo não confiável', () => {
    const host = createPluginHost();
    host.load([...CORE_PLUGINS, ...installedPluginRecords([guiaPlugin], [installation('com.curatino.guia', true)])]);

    const widgetPage = host.contributions
      .query(UI_PAGE_POINT)
      .find((c) => (c.metadata as { key?: string }).key === 'guia');
    expect(widgetPage?.impl).toMatchObject({ kind: 'widget' });
    expect(widgetPage?.pluginId).toBe('com.curatino.guia');
  });
});
