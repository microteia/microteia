import type { PluginRecord } from '../../kernel';
import { command, lazyView, menuItem, page } from '../contributionBuilders';
import { NavigationCommandProvider } from '../../presentation/components/ui/CommandPalette/providers/NavigationCommandProvider';
import { SystemCommandProvider } from '../../presentation/components/ui/CommandPalette/providers/SystemCommandProvider';
import { DockCommandProvider } from '../../presentation/components/ui/CommandPalette/providers/DockCommandProvider';
import { messageBundleContribution } from '../../domain/schema/i18n/extensionPoints';
import { USER_MENU_SURFACE } from '../../domain/schema/ui/uiExtensionPoints';
import { coreMessage, CORE_WORKSPACE_MESSAGES } from '../coreMessages';

export const coreWorkspacePlugin: PluginRecord = {
  trusted: true,
  implementations: {
    ProfileView: lazyView(() => import('../../presentation/pages/Profile/Profile.view'), 'ProfileView'),
    NavigationCommandProvider,
    SystemCommandProvider,
    DockCommandProvider,
  },
  manifest: {
    id: 'core.workspace',
    version: '1.0.0',
    kernel: '^2.0.0',
    // eslint-disable-next-line no-restricted-syntax -- metadado do plugin do NÚCLEO: não é renderizado.
    name: 'Workspace',
    dependencies: { 'core.ui': '^1.0.0' },
    contributes: [
      messageBundleContribution(coreMessage('core.workspace', CORE_WORKSPACE_MESSAGES)),
      page({ key: 'profile', title: '@core.workspace/page.profile', icon: 'user' }, 'ProfileView'),
      menuItem({
        surface: USER_MENU_SURFACE,
        key: 'profile',
        title: '@core.workspace/page.profile',
        icon: 'user',
        order: 10,
        action: { kind: 'openTab', tabKey: 'profile' },
      }),
      command('navigation', { group: '@core.workspace/command.group.navigation' }, 'NavigationCommandProvider'),
      command('system', { group: '@core.workspace/command.group.system' }, 'SystemCommandProvider'),
      command('dock', { group: '@core.workspace/command.group.panels' }, 'DockCommandProvider'),
    ],
  },
};
