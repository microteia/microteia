import type { PluginRecord } from '../kernel';
import { coreUiPlugin } from './core.ui/manifest';
import { coreWorkspacePlugin } from './core.workspace/manifest';
import { coreRecordsPlugin } from './core.records/manifest';
import { coreAutomationPlugin } from './core.automation/manifest';
import { coreAdminPlugin } from './core.admin/manifest';
import { coreDataPlugin } from './core.data/manifest';
import { coreMarketplacePlugin } from './core.marketplace/manifest';
import { coreSettingsPlugin } from './core.settings/manifest';
import { coreI18nPlugin } from './core.i18n/manifest';
import { coreThemePlugin } from './core.theme/manifest';
import { coreLicensePlugin } from './core.license/manifest';
import { BUNDLED_LOCALE_PLUGINS } from './bundledLocales';
import { BUNDLED_THEME_PLUGINS } from './themes/systemThemes';

/**
 * Composition root dos plugins internos — o ÚNICO lugar do app que conhece a lista de plugins.
 * O Kernel recebe isto como dado; remover uma linha daqui remove a tela, o item de menu e os
 * comandos daquele módulo, sem tocar em nenhum arquivo do Kernel.
 */
export const CORE_PLUGINS: PluginRecord[] = [
  coreUiPlugin,
  coreWorkspacePlugin,
  coreRecordsPlugin,
  coreAutomationPlugin,
  coreAdminPlugin,
  coreDataPlugin,
  coreMarketplacePlugin,
  coreSettingsPlugin,
  coreI18nPlugin,
  coreThemePlugin,
  coreLicensePlugin,
  ...BUNDLED_LOCALE_PLUGINS,
  ...BUNDLED_THEME_PLUGINS,
];
