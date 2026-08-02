import type { PluginRecord } from '../kernel';
import { coreUiPlugin } from './core.ui/manifest';
import { coreWorkspacePlugin } from './core.workspace/manifest';
import { coreFinancialDashboardPlugin } from './core.financial-dashboard/manifest';
import { corePushesPlugin } from './core.pushes/manifest';
import { coreNewsPlugin } from './core.news/manifest';
import { coreRecordsPlugin } from './core.records/manifest';
import { coreAutomationPlugin } from './core.automation/manifest';
import { coreAdminPlugin } from './core.admin/manifest';
import { coreDataPlugin } from './core.data/manifest';
import { coreMarketplacePlugin } from './core.marketplace/manifest';

/**
 * Composition root dos plugins internos — o ÚNICO lugar do app que conhece a lista de plugins.
 * O Kernel recebe isto como dado; remover uma linha daqui remove a tela, o item de menu e os
 * comandos daquele módulo, sem tocar em nenhum arquivo do Kernel.
 */
export const CORE_PLUGINS: PluginRecord[] = [
  coreUiPlugin,
  coreWorkspacePlugin,
  coreFinancialDashboardPlugin,
  corePushesPlugin,
  coreNewsPlugin,
  coreRecordsPlugin,
  coreAutomationPlugin,
  coreAdminPlugin,
  coreDataPlugin,
  coreMarketplacePlugin,
];
