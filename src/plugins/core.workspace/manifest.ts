import type { PluginRecord } from '../../kernel';
import { command, lazyView, page } from '../contributionBuilders';
import { NavigationCommandProvider } from '../../presentation/components/ui/CommandPalette/providers/NavigationCommandProvider';
import { SystemCommandProvider } from '../../presentation/components/ui/CommandPalette/providers/SystemCommandProvider';
import { messageBundleContribution } from '../../domain/schema/i18n/extensionPoints';
import { coreMessage, CORE_WORKSPACE_MESSAGES } from '../coreMessages';

export const coreWorkspacePlugin: PluginRecord = {
  trusted: true,
  implementations: {
    ProfileView: lazyView(() => import('../../presentation/pages/Profile/Profile.view'), 'ProfileView'),
    NavigationCommandProvider,
    SystemCommandProvider,
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
      command('navigation', { group: '@core.workspace/command.group.navigation' }, 'NavigationCommandProvider'),
      command('system', { group: '@core.workspace/command.group.system' }, 'SystemCommandProvider'),
    ],
  },
};
