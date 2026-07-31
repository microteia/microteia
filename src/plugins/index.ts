import type { PluginRecord } from '../kernel';
import { coreUiPlugin } from './core.ui/manifest';
import { coreWorkspacePlugin } from './core.workspace/manifest';
import { corePersonsPlugin } from './core.persons/manifest';
import { coreContractsPlugin } from './core.contracts/manifest';
import { coreDeadlinesPlugin } from './core.deadlines/manifest';
import { coreFinancialsPlugin } from './core.financials/manifest';
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
  corePersonsPlugin,
  coreContractsPlugin,
  coreDeadlinesPlugin,
  coreFinancialsPlugin,
  corePushesPlugin,
  coreNewsPlugin,
  coreRecordsPlugin,
  coreAutomationPlugin,
  coreAdminPlugin,
  coreDataPlugin,
  coreMarketplacePlugin,
];
