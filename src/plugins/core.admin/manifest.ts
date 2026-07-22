import type { PluginRecord } from '../../kernel';
import { lazyView, nav, page } from '../contributionBuilders';

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
    name: 'Administração do Escritório',
    dependencies: { 'core.ui': '^1.0.0' },
    contributes: [
      page({ key: 'tenant-settings', title: 'Escritório', icon: 'building', fullBleed: true }, 'TenantSettingsView'),
      page({ key: '', keyPrefix: 'tenant-settings:', title: 'Escritório', icon: 'building', fullBleed: true }, 'TenantSettingsView'),
      page({ key: 'access-management', title: 'Gestão de Acessos', icon: 'shieldUser', requiredRole: 'SYSTEM' }, 'AccessManagementView'),
      page({ key: 'audit-logs', title: 'Auditoria', icon: 'history' }, 'AuditLogsView'),
      page({ key: 'data-processor', title: 'Processador de Dados', icon: 'sparkling' }, 'DataProcessorView'),
      nav({ key: 'tenant-settings', label: 'Escritório', icon: 'building', order: 110 }),
      nav({ key: 'audit-logs', label: 'Auditoria', icon: 'history', order: 120, requiresTenantAdmin: true }),
    ],
  },
};
