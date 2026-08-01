import type { PluginRecord } from '../../kernel';
import { lazyView, page } from '../contributionBuilders';

/**
 * O PAINEL financeiro — a única parte do Financeiro que ainda é do kernel.
 *
 * A entidade saiu: quem descreve `financials` é a extensão `com.microteia.financeiro`. O painel
 * ficou porque é um RELATÓRIO de gráficos (`recharts`), e a API curada das extensões ainda não expõe
 * biblioteca de gráfico. Ele já lê a coleção pelo caminho genérico (`useFinancialRecords`), então
 * não depende de entidade nenhuma declarada em código — sai daqui no dia em que uma extensão puder
 * desenhar os mesmos gráficos.
 */
export const coreFinancialDashboardPlugin: PluginRecord = {
  trusted: true,
  implementations: {
    FinancialDashboardView: lazyView(() => import('../../presentation/pages/FinancialDashboard/FinancialDashboard.view'), 'FinancialDashboardView'),
  },
  manifest: {
    id: 'core.financial-dashboard',
    version: '1.0.0',
    kernel: '^1.0.0',
    name: 'Painel Financeiro',
    dependencies: { 'core.ui': '^1.0.0' },
    contributes: [
      page({ key: 'financial-dashboard', title: 'Painel Financeiro', icon: 'lineChart' }, 'FinancialDashboardView'),
    ],
  },
};
