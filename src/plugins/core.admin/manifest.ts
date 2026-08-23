import type { PluginRecord } from '../../kernel';
import { lazyView, nav, page } from '../contributionBuilders';
import { messageBundleContribution } from '../../domain/schema/i18n/extensionPoints';
import { coreMessage, CORE_ADMIN_MESSAGES } from '../coreMessages';
import { PERMISSION_AUDIT_READ, PERMISSION_DATA_PROCESSOR_USE } from '../../domain/schema/access';

export const coreAdminPlugin: PluginRecord = {
  trusted: true,
  implementations: {
    AccessManagementView: lazyView(() => import('../../presentation/pages/AccessManagement/AccessManagement.view'), 'AccessManagementView'),
    AuditLogsView: lazyView(() => import('../../presentation/pages/AuditLogs/AuditLogs.view'), 'AuditLogsView'),
    DataProcessorView: lazyView(() => import('../../presentation/pages/DataProcessor'), 'DataProcessorView'),
  },
  manifest: {
    id: 'core.admin',
    version: '1.0.0',
    kernel: '^2.0.0',
    // eslint-disable-next-line no-restricted-syntax -- metadado do plugin do NÚCLEO: não é renderizado.
    name: 'Organization Administration',
    dependencies: { 'core.ui': '^1.0.0', 'core.access': '^1.0.0' },
    contributes: [
      messageBundleContribution(coreMessage('core.admin', CORE_ADMIN_MESSAGES)),
      page({ key: 'access-management', title: '@core.admin/page.access-management', icon: 'shieldUser', requiresSystemAdmin: true }, 'AccessManagementView'),
      page({ key: 'audit-logs', title: '@core.admin/page.audit-logs', icon: 'history', requiredPermissions: [PERMISSION_AUDIT_READ] }, 'AuditLogsView'),
      page({ key: 'data-processor', title: '@core.admin/page.data-processor', icon: 'sparkling', requiredPermissions: [PERMISSION_DATA_PROCESSOR_USE] }, 'DataProcessorView'),
      nav({ key: 'audit-logs', label: '@core.admin/nav.audit-logs', icon: 'history', order: 120, requiredPermissions: [PERMISSION_AUDIT_READ] }),
    ],
  },
};
