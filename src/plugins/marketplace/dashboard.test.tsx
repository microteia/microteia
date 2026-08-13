// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createPluginHost } from '../../kernel';
import { CORE_PLUGINS } from '..';
import { installedPluginRecords } from '../../domain/usecases/plugins/installedPluginRecords';
import { evaluateExtensionView } from '../../presentation/shared/extensions/evaluateExtensionView';
import { UI_SETTINGS_POINT, UI_WIDGET_POINT } from '../../presentation/shared/uiExtensionPoints';
import type { PluginInstallation } from '../../domain/entities/PluginInstallation';
import type { SettingsSection } from '../../domain/schema/settings';
import { MARKETPLACE_CATALOG } from './catalog';
import { dashboardPlugin } from './dashboard';

const installation = (pluginId: string): PluginInstallation => ({
  pluginId,
  tenantId: 't1',
  version: '1.0.0',
  enabled: true,
  config: {},
  grantedPermissions: [],
  installedAt: new Date(),
  installedBy: 'u1',
  updatedAt: new Date(),
});

const hostWithCatalog = () => {
  const host = createPluginHost();
  const result = host.load([
    ...CORE_PLUGINS,
    ...installedPluginRecords(MARKETPLACE_CATALOG, MARKETPLACE_CATALOG.map((plugin) => installation(plugin.manifest.id))),
  ]);
  return { host, result };
};

describe('dashboardPlugin', () => {
  it('carrega no host e contribui a tela, o menu e a seção de configuração', () => {
    const { host, result } = hostWithCatalog();

    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(host.isLoaded(dashboardPlugin.manifest.id)).toBe(true);

    const secoes = host.contributions
      .query(UI_SETTINGS_POINT)
      .map((contribution) => contribution.metadata as unknown as SettingsSection);
    expect(secoes.map((secao) => secao.key)).toContain('dashboard');
  });

  /**
   * O ponto do Dashboard: ele não conhece widget nenhum. Se esta lista dependesse de algo escrito na
   * extensão do Dashboard, instalar uma extensão nova não faria cartão aparecer.
   */
  it('não declara nenhum widget — quem os traz são as extensões de domínio', () => {
    const widgetKeys = (dashboardPlugin.manifest.contributes ?? [])
      .filter((contribution) => contribution.point === UI_WIDGET_POINT);
    expect(widgetKeys).toEqual([]);
  });

  it('a configuração do Dashboard aponta para a superfície e aceita os dois escopos', () => {
    const contribution = (dashboardPlugin.manifest.contributes ?? [])
      .find((item) => item.point === UI_SETTINGS_POINT);
    const secao = contribution?.metadata as unknown as SettingsSection;
    const [propriedade] = secao.properties;

    expect(propriedade.key).toBe('dashboard.widgets');
    expect(propriedade.type).toBe('widgets');
    expect(propriedade.surface).toBe('dashboard');
    expect(propriedade.scopes).toEqual(['tenant', 'user']);
  });

  it('a fonte da view compila pelo runtime (não cai no fallback)', () => {
    for (const view of dashboardPlugin.views ?? []) {
      const Component = evaluateExtensionView(`test::${view.key}`, view.source);
      expect(typeof Component, view.key).toBe('function');
    }
  });
});

describe('widgets do Dashboard — o catálogo inteiro', () => {
  it('todo widget contribuído tem view correspondente e compila', () => {
    for (const plugin of MARKETPLACE_CATALOG) {
      const views = new Map((plugin.views ?? []).map((view) => [view.key, view.source]));
      const widgets = (plugin.manifest.contributes ?? [])
        .filter((contribution) => contribution.point === UI_WIDGET_POINT);

      for (const widget of widgets) {
        const implKey = (widget.impl as { key?: string } | undefined)?.key ?? '';
        const source = views.get(implKey);
        expect(source, `${plugin.manifest.id} → ${implKey}`).toBeDefined();
        const Component = evaluateExtensionView(`test::${implKey}`, source ?? '');
        expect(typeof Component, implKey).toBe('function');
      }
    }
  });

  it('nenhuma chave de widget se repete entre extensões', () => {
    const keys = MARKETPLACE_CATALOG.flatMap((plugin) =>
      (plugin.manifest.contributes ?? [])
        .filter((contribution) => contribution.point === UI_WIDGET_POINT)
        .map((contribution) => (contribution.metadata as { key?: string }).key ?? ''),
    );

    expect(keys.length).toBeGreaterThan(0);
    expect(new Set(keys).size).toBe(keys.length);
  });

  /** Largura fora da grade quebraria o alinhamento de quem estivesse ao lado. */
  it('a largura padrão de todo widget cabe na grade', () => {
    for (const plugin of MARKETPLACE_CATALOG) {
      for (const contribution of plugin.manifest.contributes ?? []) {
        if (contribution.point !== UI_WIDGET_POINT) continue;
        const span = (contribution.metadata as { defaultSpan?: number }).defaultSpan ?? 1;
        expect(span, `${plugin.manifest.id}`).toBeGreaterThanOrEqual(1);
        expect(span, `${plugin.manifest.id}`).toBeLessThanOrEqual(3);
      }
    }
  });
});
