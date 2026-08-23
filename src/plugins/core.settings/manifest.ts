import type { PluginRecord } from '../../kernel';
import { lazyView, nav, page } from '../contributionBuilders';
import { messageBundleContribution } from '../../domain/schema/i18n/extensionPoints';
import { coreMessage, CORE_SETTINGS_MESSAGES } from '../coreMessages';

/**
 * O hospedeiro das configurações. Ele não declara NENHUMA configuração — só a tela que renderiza as
 * seções contribuídas por quem as tem. É o par do `core.ui` para o ponto `ui.settings`: um declara o
 * contrato, este entrega o lugar onde ele aparece.
 */
export const coreSettingsPlugin: PluginRecord = {
  trusted: true,
  implementations: {
    SettingsView: lazyView(() => import('../../presentation/pages/Settings/Settings.view'), 'SettingsView'),
  },
  manifest: {
    id: 'core.settings',
    version: '1.0.0',
    kernel: '^2.0.0',
    // eslint-disable-next-line no-restricted-syntax -- metadado do plugin do NÚCLEO: não é renderizado.
    name: 'Settings',
    // eslint-disable-next-line no-restricted-syntax -- metadado do plugin do NÚCLEO: não é renderizado.
    description: 'The screen where plugins register what they accept configuring, per organization and per user.',
    dependencies: { 'core.ui': '^1.0.0' },
    contributes: [
      messageBundleContribution(coreMessage('core.settings', CORE_SETTINGS_MESSAGES)),
      page({ key: 'settings', title: '@core.settings/page.settings', icon: 'settings', fullBleed: true }, 'SettingsView'),
      nav({ key: 'settings', label: '@core.settings/nav.settings', icon: 'settings', order: 115 }),
    ],
  },
};
