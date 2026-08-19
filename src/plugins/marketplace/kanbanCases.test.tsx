// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createPluginHost } from '../../kernel';
import { CORE_PLUGINS } from '..';
import { installedPluginRecords } from '../../domain/usecases/plugins/installedPluginRecords';
import { evaluateExtensionView } from '../../presentation/shared/extensions/evaluateExtensionView';
import { UI_NAV_POINT, UI_PAGE_POINT } from '../../domain/schema/ui/uiExtensionPoints';
import type { PluginInstallation } from '../../domain/entities/PluginInstallation';
import { kanbanCasesPlugin } from './kanbanCases';

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

describe('kanbanCasesPlugin', () => {
  it('carrega no host como extensão trusted, com nav + página de código, sem erros', () => {
    const host = createPluginHost();
    const records = [...CORE_PLUGINS, ...installedPluginRecords([kanbanCasesPlugin], [installation(kanbanCasesPlugin.manifest.id)])];
    const result = host.load(records);

    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(host.isLoaded(kanbanCasesPlugin.manifest.id)).toBe(true);

    const navKeys = host.contributions.query(UI_NAV_POINT).map((c) => (c.metadata as { key: string }).key);
    expect(navKeys).toContain('kanban-processos');

    const codePage = host.contributions
      .query(UI_PAGE_POINT)
      .find((c) => (c.metadata as { key?: string }).key === 'kanban-processos');
    expect(codePage?.impl).toMatchObject({ kind: 'code', key: 'kanban' });
  });

  it('a fonte real da view compila pelo runtime (não cai no fallback)', () => {
    const view = kanbanCasesPlugin.views?.[0];
    expect(view).toBeDefined();
    const Component = evaluateExtensionView('test::kanban', view!.source);
    expect(typeof Component).toBe('function');
    expect(Component.name).toBe('KanbanCasesView');
  });
});
