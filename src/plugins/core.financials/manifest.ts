import type { PluginRecord } from '../../kernel';
import { command, lazyView, nav, page } from '../contributionBuilders';
import { FinancialCommandProvider } from '../../presentation/components/ui/CommandPalette/providers/FinancialCommandProvider';

export const coreFinancialsPlugin: PluginRecord = {
  trusted: true,
  implementations: {
    FinancialsView: lazyView(() => import('../../presentation/pages/Financials/Financials.view'), 'FinancialsView'),
    ViewFinancialView: lazyView(() => import('../../presentation/pages/ViewFinancial/ViewFinancial.view'), 'ViewFinancialView'),
    FinancialDashboardView: lazyView(() => import('../../presentation/pages/FinancialDashboard/FinancialDashboard.view'), 'FinancialDashboardView'),
    FinancialCommandProvider,
  },
  manifest: {
    id: 'core.financials',
    version: '1.0.0',
    kernel: '^1.0.0',
    name: 'Financeiro',
    dependencies: { 'core.ui': '^1.0.0' },
    contributes: [
      page({ key: 'financials', title: 'Financeiro', icon: 'moneyDollar' }, 'FinancialsView'),
      page({ key: 'financial-dashboard', title: 'Dashboard Financeiro', icon: 'lineChart' }, 'FinancialDashboardView'),
      page({ key: 'new-financial', title: 'Novo Lançamento', icon: 'moneyDollar' }, 'ViewFinancialView'),
      page({ key: '', keyPrefix: 'new-financial:clone:', title: 'Novo Lançamento', icon: 'moneyDollar' }, 'ViewFinancialView'),
      page({ key: '', keyPrefix: 'view-financial:', title: 'Lançamento', icon: 'moneyDollar' }, 'ViewFinancialView'),
      nav({ key: 'financials', label: 'Financeiro', icon: 'moneyDollar', order: 70 }),
      command('financial', { group: 'Financeiro' }, 'FinancialCommandProvider'),
    ],
  },
};
