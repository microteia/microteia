import type { PluginRecord } from '../../kernel';
import { command, lazyView, menuItem, page, settingsSection, surfaceSlot, surfaceTab } from '../contributionBuilders';
import { messageBundleContribution } from '../../domain/schema/i18n/extensionPoints';
import { PERMISSION_AUTOMATION_MANAGE, PERMISSION_SETTINGS_MANAGE } from '../../domain/schema/access';
import { USER_MENU_SURFACE, WORKSPACE_SLOT_SURFACES } from '../../domain/schema/ui/uiExtensionPoints';
import { NOTIFICATION_SETTINGS_PROPERTIES } from '../../domain/schema/notifications';
import { coreMessage, CORE_AUTOMATION_MESSAGES } from '../coreMessages';
import { TENANT_SETTINGS_SURFACE } from '../core.tenant/surface';
import { WorkflowCommandProvider } from '../../presentation/components/ui/CommandPalette/providers/WorkflowCommandProvider';
import { NotificationBell } from '../../presentation/components/layout/NotificationBell';

export const coreAutomationPlugin: PluginRecord = {
  trusted: true,
  implementations: {
    WorkflowsView: lazyView(() => import('../../presentation/pages/Workflows/Workflows.view'), 'WorkflowsView'),
    ViewWorkflowView: lazyView(() => import('../../presentation/pages/ViewWorkflow/ViewWorkflow.view'), 'ViewWorkflowView'),
    EditWorkflowStepView: lazyView(() => import('../../presentation/pages/EditWorkflowStep/EditWorkflowStep.view'), 'EditWorkflowStepView'),
    ScriptsView: lazyView(() => import('../../presentation/pages/Scripts/Scripts.view'), 'ScriptsView'),
    ViewScriptView: lazyView(() => import('../../presentation/pages/ViewScript/ViewScript.view'), 'ViewScriptView'),
    ActionsView: lazyView(() => import('../../presentation/pages/Actions/Actions.view'), 'ActionsView'),
    ViewActionView: lazyView(() => import('../../presentation/pages/ViewAction/ViewAction.view'), 'ViewActionView'),
    FunctionReferenceView: lazyView(() => import('../../presentation/pages/FunctionReference/FunctionReference.view'), 'FunctionReferenceView'),
    DataFunctionReferenceView: lazyView(() => import('../../presentation/pages/DataFunctionReference/DataFunctionReference.view'), 'DataFunctionReferenceView'),
    WorkflowCommandProvider,
    NotificationBell,
    NotificationEmailTabView: lazyView(() => import('../../presentation/pages/TenantSettings/EmailTab/EmailTab.view'), 'EmailTabView'),
  },
  manifest: {
    id: 'core.automation',
    version: '1.0.0',
    kernel: '^2.0.0',
    // eslint-disable-next-line no-restricted-syntax -- metadado do plugin do NÚCLEO: não é renderizado.
    name: 'Automations',
    dependencies: { 'core.ui': '^1.0.0', 'core.tenant': '^1.0.0' },
    contributes: [
      messageBundleContribution(coreMessage('core.automation', CORE_AUTOMATION_MESSAGES)),
      page({ key: 'workflows', title: '@core.automation/page.workflows', icon: 'flowChart' }, 'WorkflowsView'),
      page({ key: 'new-workflow', title: '@core.automation/page.new-workflow', icon: 'flowChart' }, 'ViewWorkflowView'),
      page({ key: '', keyPrefix: 'new-workflow:clone:', title: '@core.automation/page.new-workflow', icon: 'flowChart' }, 'ViewWorkflowView'),
      page({ key: '', keyPrefix: 'view-workflow:', title: '@core.automation/page.view-workflow', icon: 'flowChart' }, 'ViewWorkflowView'),
      page({ key: '', keyPrefix: 'edit-workflow-step:', title: '@core.automation/page.edit-workflow-step', icon: 'flowChart' }, 'EditWorkflowStepView'),
      page({ key: 'scripts', title: '@core.automation/page.scripts', icon: 'codeBox' }, 'ScriptsView'),
      page({ key: 'new-script', title: '@core.automation/page.new-script', icon: 'codeBox' }, 'ViewScriptView'),
      page({ key: '', keyPrefix: 'view-script:', title: '@core.automation/page.view-script', icon: 'codeBox' }, 'ViewScriptView'),
      page({ key: 'actions', title: '@core.automation/page.actions', icon: 'cursor' }, 'ActionsView'),
      page({ key: 'new-action', title: '@core.automation/page.new-action', icon: 'cursor' }, 'ViewActionView'),
      page({ key: '', keyPrefix: 'view-action:', title: '@core.automation/page.view-action', icon: 'cursor' }, 'ViewActionView'),
      page({ key: 'function-reference', title: '@core.automation/page.function-reference', icon: 'bookSimple' }, 'FunctionReferenceView'),
      page({ key: 'data-function-reference', title: '@core.automation/page.data-function-reference', icon: 'database2' }, 'DataFunctionReferenceView'),
      command('workflow', { group: '@core.automation/command.group' }, 'WorkflowCommandProvider'),
      // O sino é o LEITOR do canal "no app" do passo Notificar: sem ele, a entrega chegaria a lugar
      // nenhum. É o único trecho de shell que o núcleo ocupa, e mora aqui — no plugin dono do passo —
      // pela mesma razão dos itens de menu: some junto com quem o justifica, e o escritório o desliga
      // em Configurações como qualquer trecho (`top-bar.right.slots`).
      surfaceSlot({
        surface: WORKSPACE_SLOT_SURFACES.topBarRight,
        key: 'notifications',
        title: '@core.automation/notifications.bell.title',
        icon: 'notification',
        order: 10,
        defaultEnabled: true,
      }, 'NotificationBell'),
      settingsSection({
        key: 'notifications',
        title: '@core.automation/notifications.settings.title',
        description: '@core.automation/notifications.settings.description',
        icon: 'notification',
        order: 20,
        properties: [...NOTIFICATION_SETTINGS_PROPERTIES],
      }),
      surfaceTab({
        surface: TENANT_SETTINGS_SURFACE,
        key: 'email',
        title: '@core.automation/notifications.email.tab',
        icon: 'mailSend',
        order: 32,
        requiredPermissions: [PERMISSION_SETTINGS_MANAGE],
      }, 'NotificationEmailTabView'),
      menuItem({
        surface: USER_MENU_SURFACE,
        key: 'workflows',
        title: '@core.automation/page.workflows',
        icon: 'flowChart',
        order: 40,
        requiredPermissions: [PERMISSION_AUTOMATION_MANAGE],
        action: { kind: 'openTab', tabKey: 'workflows' },
      }),
      menuItem({
        surface: USER_MENU_SURFACE,
        key: 'scripts',
        title: '@core.automation/page.scripts',
        icon: 'codeBox',
        order: 50,
        requiredPermissions: [PERMISSION_AUTOMATION_MANAGE],
        action: { kind: 'openTab', tabKey: 'scripts' },
      }),
      menuItem({
        surface: USER_MENU_SURFACE,
        key: 'actions',
        title: '@core.automation/page.actions',
        icon: 'cursor',
        order: 60,
        requiredPermissions: [PERMISSION_AUTOMATION_MANAGE],
        action: { kind: 'openTab', tabKey: 'actions' },
      }),
    ],
  },
};
