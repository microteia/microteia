import type { PluginRecord } from '../../kernel';
import { command, lazyView, menuItem, page } from '../contributionBuilders';
import { messageBundleContribution } from '../../domain/schema/i18n/extensionPoints';
import { PERMISSION_AUTOMATION_MANAGE } from '../../domain/schema/access';
import { USER_MENU_SURFACE } from '../../domain/schema/ui/uiExtensionPoints';
import { coreMessage, CORE_AUTOMATION_MESSAGES } from '../coreMessages';
import { WorkflowCommandProvider } from '../../presentation/components/ui/CommandPalette/providers/WorkflowCommandProvider';

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
  },
  manifest: {
    id: 'core.automation',
    version: '1.0.0',
    kernel: '^2.0.0',
    // eslint-disable-next-line no-restricted-syntax -- metadado do plugin do NÚCLEO: não é renderizado.
    name: 'Automations',
    dependencies: { 'core.ui': '^1.0.0' },
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
