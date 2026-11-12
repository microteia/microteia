import type { PluginRecord } from '../../kernel';
import { command, lazyView, nav, page } from '../contributionBuilders';
import { PERMISSION_REPORTS_MANAGE, PERMISSION_REPORTS_PERSONAL } from '../../domain/schema/access';
import { REPORT_DESIGN_TAB_PREFIX, REPORT_TAB_PREFIX } from '../../shared/constants/reportKeys';
import { REPORT_EXTENSION_POINTS } from '../../domain/schema/report/reportExtensionPoints';
import { ReportCommandProvider } from '../../presentation/components/ui/CommandPalette/providers/ReportCommandProvider';
import { messageBundleContribution } from '../../domain/schema/i18n/extensionPoints';
import { coreMessage, CORE_REPORTS_MESSAGES } from '../coreMessages';

/**
 * **Os relatórios** — o lugar onde o escritório pergunta um número à própria base.
 *
 * Ele não declara relatório nenhum, e é essa ausência que o justifica: relatório é sobre um assunto,
 * e assunto é do escritório ou da extensão que o traz. O que o núcleo declara é a CAPACIDADE de
 * agrupar, dobrar e mostrar — a mesma inversão que faz o Painel entregar só o lugar e o Form Design
 * só a autoria.
 *
 * A permissão de autoria (`reports.manage`) mora em `core.access`, com as outras capacidades do
 * núcleo. Ela não aparece aqui porque não é sobre relatório: é sobre administrar o produto, e o
 * catálogo de permissões tem um dono só.
 */
export const coreReportsPlugin: PluginRecord = {
  trusted: true,
  implementations: {
    ReportsView: lazyView(() => import('../../presentation/pages/Reports/Reports.view'), 'ReportsView'),
    ViewReportView: lazyView(
      () => import('../../presentation/pages/ViewReport/ViewReport.view'),
      'ViewReportView',
    ),
    ReportDesignView: lazyView(
      () => import('../../presentation/pages/ReportDesign/ReportDesign.view'),
      'ReportDesignView',
    ),
    ReportCommandProvider,
  },
  manifest: {
    id: 'core.reports',
    version: '1.0.0',
    kernel: '^2.0.0',
    // eslint-disable-next-line no-restricted-syntax -- metadado do plugin do NÚCLEO: não é renderizado.
    name: 'Reports',
    description:
      // eslint-disable-next-line no-restricted-syntax -- metadado do plugin do NÚCLEO: não é renderizado.
      'Declares the extension point through which a report reaches the organization, and the vocabulary it is written in.',
    extensionPoints: REPORT_EXTENSION_POINTS,
    contributes: [
      messageBundleContribution(coreMessage('core.reports', CORE_REPORTS_MESSAGES)),
      nav({ key: 'reports', label: '@core.reports/nav.reports', icon: 'fileChart', order: 95 }),
      command('report', { group: '@core.reports/command.group' }, 'ReportCommandProvider'),
      page({ key: 'reports', title: '@core.reports/page.reports', icon: 'fileChart' }, 'ReportsView'),
      // Uma aba por relatório: a chave dele vem no nome da aba, como em `dyn:` e `view-dyn:`.
      page(
        { key: '', keyPrefix: REPORT_TAB_PREFIX, title: '@core.reports/page.report', icon: 'fileChart' },
        'ViewReportView',
      ),
      // A autoria é de quem gerencia relatórios OU cria os pessoais — `requiredPermissions` basta uma.
      page(
        {
          key: 'report-design',
          title: '@core.reports/page.design',
          icon: 'fileList2',
          requiredPermissions: [PERMISSION_REPORTS_MANAGE, PERMISSION_REPORTS_PERSONAL],
        },
        'ReportDesignView',
      ),
      // A autoria de um relatório que JÁ EXISTE: a chave dele vem no nome da aba, como em `rep:`.
      page(
        {
          key: '',
          keyPrefix: REPORT_DESIGN_TAB_PREFIX,
          title: '@core.reports/page.design',
          icon: 'fileList2',
          requiredPermissions: [PERMISSION_REPORTS_MANAGE, PERMISSION_REPORTS_PERSONAL],
        },
        'ReportDesignView',
      ),
    ],
    dependencies: { 'core.ui': '^1.0.0' },
  },
};
