import type { PluginRecord } from '../../kernel';
import { lazyView, nav, page } from '../contributionBuilders';

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
    kernel: '^1.0.0',
    name: 'Configurações',
    description: 'A tela onde plugins registram o que aceitam configurar, no escritório e por usuário.',
    dependencies: { 'core.ui': '^1.0.0' },
    contributes: [
      page({ key: 'settings', title: 'Configurações', icon: 'settings', fullBleed: true }, 'SettingsView'),
      nav({ key: 'settings', label: 'Configurações', icon: 'settings', order: 115 }),
    ],
  },
};
