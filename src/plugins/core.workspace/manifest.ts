import type { PluginRecord } from '../../kernel';
import { command, lazyView, nav, page } from '../contributionBuilders';
import { NavigationCommandProvider } from '../../presentation/components/ui/CommandPalette/providers/NavigationCommandProvider';
import { SystemCommandProvider } from '../../presentation/components/ui/CommandPalette/providers/SystemCommandProvider';

export const coreWorkspacePlugin: PluginRecord = {
  trusted: true,
  implementations: {
    CalendarView: lazyView(() => import('../../presentation/pages/Calendar/Calendar.view'), 'CalendarView'),
    ProfileView: lazyView(() => import('../../presentation/pages/Profile/Profile.view'), 'ProfileView'),
    NavigationCommandProvider,
    SystemCommandProvider,
  },
  manifest: {
    id: 'core.workspace',
    version: '1.0.0',
    kernel: '^1.0.0',
    name: 'Área de Trabalho',
    dependencies: { 'core.ui': '^1.0.0' },
    contributes: [
      page({ key: 'calendar', title: 'Calendário', icon: 'calendar' }, 'CalendarView'),
      page({ key: 'profile', title: 'Meu Perfil', icon: 'user' }, 'ProfileView'),
      nav({ key: 'calendar', label: 'Calendário', icon: 'calendar', order: 20 }),
      command('navigation', { group: 'Navegação' }, 'NavigationCommandProvider'),
      command('system', { group: 'Sistema' }, 'SystemCommandProvider'),
    ],
  },
};
