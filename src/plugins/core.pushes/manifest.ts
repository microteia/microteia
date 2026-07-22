import type { PluginRecord } from '../../kernel';
import { lazyView, nav, page } from '../contributionBuilders';

export const corePushesPlugin: PluginRecord = {
  trusted: true,
  implementations: {
    PushesView: lazyView(() => import('../../presentation/pages/Pushes/Pushes.view'), 'PushesView'),
    DashboardPushesView: lazyView(() => import('../../presentation/pages/DashboardPushes/DashboardPushes.view'), 'DashboardPushesView'),
  },
  manifest: {
    id: 'core.pushes',
    version: '1.0.0',
    kernel: '^1.0.0',
    name: 'Pushes do Tribunal',
    dependencies: { 'core.ui': '^1.0.0' },
    contributes: [
      page({ key: 'pushes', title: 'Pushes do Tribunal', icon: 'inbox' }, 'PushesView'),
      page({ key: 'dashboard-pushes', title: 'Dashboard de Pushes', icon: 'barChartBox' }, 'DashboardPushesView'),
      nav({ key: 'pushes', label: 'Pushes do Tribunal', icon: 'inbox', order: 80 }),
    ],
  },
};
