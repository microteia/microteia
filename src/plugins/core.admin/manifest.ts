import type { PluginRecord } from '../../kernel';
import { lazyView, nav, page } from '../contributionBuilders';
import { messageBundleContribution } from '../../domain/schema/i18n/extensionPoints';
import { coreMessage, CORE_ADMIN_MESSAGES } from '../coreMessages';

export const coreAdminPlugin: PluginRecord = {
  trusted: true,
  implementations: {
    TenantSettingsView: lazyView(() => import('../../presentation/pages/TenantSettings/TenantSettings.view'), 'TenantSettingsView'),
    AccessManagementView: lazyView(() => import('../../presentation/pages/AccessManagement/AccessManagement.view'), 'AccessManagementView'),
    AuditLogsView: lazyView(() => import('../../presentation/pages/AuditLogs/AuditLogs.view'), 'AuditLogsView'),
    DataProcessorView: lazyView(() => import('../../presentation/pages/DataProcessor'), 'DataProcessorView'),
  },
  manifest: {
    id: 'core.admin',
    version: '1.0.0',
    kernel: '^1.0.0',
    name: 'Organization Administration',
    dependencies: { 'core.ui': '^1.0.0' },
    contributes: [
      messageBundleContribution(coreMessage('core.admin', CORE_ADMIN_MESSAGES)),
      page({ key: 'tenant-settings', title: '@core.admin/page.tenant-settings', icon: 'building', fullBleed: true }, 'TenantSettingsView'),
      page({ key: '', keyPrefix: 'tenant-settings:', title: '@core.admin/page.tenant-settings', icon: 'building', fullBleed: true }, 'TenantSettingsView'),
      page({ key: 'access-management', title: '@core.admin/page.access-management', icon: 'shieldUser', requiredRole: 'SYSTEM' }, 'AccessManagementView'),
      page({ key: 'audit-logs', title: '@core.admin/page.audit-logs', icon: 'history' }, 'AuditLogsView'),
      page({ key: 'data-processor', title: '@core.admin/page.data-processor', icon: 'sparkling' }, 'DataProcessorView'),
      nav({ key: 'tenant-settings', label: '@core.admin/nav.tenant-settings', icon: 'building', order: 110 }),
      nav({ key: 'audit-logs', label: '@core.admin/nav.audit-logs', icon: 'history', order: 120, requiresTenantAdmin: true }),
    ],
  },
};
