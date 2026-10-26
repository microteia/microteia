import type { PluginRecord } from '../../kernel';
import { command, lazyView, nav, page, settingsSection, surfaceSlot, surfaceTab } from '../contributionBuilders';
import { messageBundleContribution } from '../../domain/schema/i18n/extensionPoints';
import { PERMISSION_AUTOMATION_MANAGE, PERMISSION_SETTINGS_MANAGE } from '../../domain/schema/access';
import { AUTOMATION_NAV_GROUP, WORKSPACE_SLOT_SURFACES } from '../../domain/schema/ui/uiExtensionPoints';
import {
  NOTIFICATION_EXTENSION_POINTS,
  NOTIFICATION_SETTINGS_PROPERTIES,
  NOTIFICATIONS_PAGE_KEY,
  notificationCategoryContribution,
} from '../../domain/schema/notifications';
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
    NotificationsView: lazyView(() => import('../../presentation/pages/Notifications/Notifications.view'), 'NotificationsView'),
    NotificationEmailTabView: lazyView(() => import('../../presentation/pages/TenantSettings/EmailTab/EmailTab.view'), 'EmailTabView'),
  },
  manifest: {
    id: 'core.automation',
    version: '1.0.0',
    kernel: '^2.0.0',
    // eslint-disable-next-line no-restricted-syntax -- metadado do plugin do NÚCLEO: não é renderizado.
    name: 'Automations',
    dependencies: { 'core.ui': '^1.0.0', 'core.tenant': '^1.0.0' },
    extensionPoints: NOTIFICATION_EXTENSION_POINTS,
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
      // A página com TODOS os avisos — o sino mostra os recentes e leva para cá —, e onde cada pessoa
      // escolhe, por tipo de aviso, por quais canais quer recebê-los.
      // Os tipos de aviso do PRÓPRIO kernel moram aqui, com o dono do ponto: `core.tenant` carrega
      // antes deste plugin, e uma contribuição dele cairia num ponto que ainda não existe.
      notificationCategoryContribution({
        key: 'portal-activity',
        title: '@core.records/portal.activity.category',
        description: '@core.records/portal.activity.category.description',
        icon: 'team',
        variables: ['guest', 'screen', 'record'],
      }),
      // A adoção de chaves acha duplicatas antigas por vários gatilhos, e nenhum deles é um gesto de
      // quem resolve: sem este aviso, só sabia quem abrisse a listagem.
      notificationCategoryContribution({
        key: 'record-key-conflicts',
        title: '@core.records/key.adoption.notice.category',
        description: '@core.records/key.adoption.notice.category.description',
        icon: 'key',
        variables: ['screen', 'keys', 'count'],
      }),
      // A exportação do arquivo da Auditoria roda sozinha, de hora em hora: sem este aviso, a falha
      // ficaria no badge de quem abre a Auditoria — justamente quem não está olhando.
      notificationCategoryContribution({
        key: 'audit-archive',
        title: '@core.admin/audit.archive.category',
        description: '@core.admin/audit.archive.category.description',
        icon: 'history',
        variables: ['day', 'attempts', 'error'],
      }),
      page({ key: NOTIFICATIONS_PAGE_KEY, title: '@core.automation/page.notifications', icon: 'notification' }, 'NotificationsView'),
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
      nav({ key: 'workflows', label: '@core.automation/page.workflows', icon: 'flowChart', order: 106, group: AUTOMATION_NAV_GROUP, requiredPermissions: [PERMISSION_AUTOMATION_MANAGE] }),
      nav({ key: 'scripts', label: '@core.automation/page.scripts', icon: 'codeBox', order: 107, group: AUTOMATION_NAV_GROUP, requiredPermissions: [PERMISSION_AUTOMATION_MANAGE] }),
      nav({ key: 'actions', label: '@core.automation/page.actions', icon: 'cursor', order: 108, group: AUTOMATION_NAV_GROUP, requiredPermissions: [PERMISSION_AUTOMATION_MANAGE] }),
    ],
  },
};
