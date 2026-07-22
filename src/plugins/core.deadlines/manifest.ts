import type { PluginRecord } from '../../kernel';
import { lazyView, nav, page } from '../contributionBuilders';

export const coreDeadlinesPlugin: PluginRecord = {
  trusted: true,
  implementations: {
    DeadlinesView: lazyView(() => import('../../presentation/pages/Deadlines/Deadlines.view'), 'DeadlinesView'),
    ViewDeadlineView: lazyView(() => import('../../presentation/pages/ViewDeadline/ViewDeadline.view'), 'ViewDeadlineView'),
  },
  manifest: {
    id: 'core.deadlines',
    version: '1.0.0',
    kernel: '^1.0.0',
    name: 'Prazos',
    dependencies: { 'core.ui': '^1.0.0' },
    contributes: [
      page({ key: 'deadlines', title: 'Prazos', icon: 'time' }, 'DeadlinesView'),
      page({ key: 'new-deadline', title: 'Novo Prazo', icon: 'time' }, 'ViewDeadlineView'),
      page({ key: '', keyPrefix: 'view-deadline:', title: 'Prazo', icon: 'time' }, 'ViewDeadlineView'),
      nav({ key: 'deadlines', label: 'Prazos', icon: 'time', order: 60 }),
    ],
  },
};
