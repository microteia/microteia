import type { PluginRecord } from '../../kernel';
import { command, lazyView, page } from '../contributionBuilders';
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
    kernel: '^1.0.0',
    name: 'Automações',
    dependencies: { 'core.ui': '^1.0.0' },
    contributes: [
      page({ key: 'workflows', title: 'Automações', icon: 'flowChart' }, 'WorkflowsView'),
      page({ key: 'new-workflow', title: 'Nova Automação', icon: 'flowChart' }, 'ViewWorkflowView'),
      page({ key: '', keyPrefix: 'new-workflow:clone:', title: 'Nova Automação', icon: 'flowChart' }, 'ViewWorkflowView'),
      page({ key: '', keyPrefix: 'view-workflow:', title: 'Automação', icon: 'flowChart' }, 'ViewWorkflowView'),
      page({ key: '', keyPrefix: 'edit-workflow-step:', title: 'Editar Step', icon: 'flowChart' }, 'EditWorkflowStepView'),
      page({ key: 'scripts', title: 'Scripts', icon: 'codeBox' }, 'ScriptsView'),
      page({ key: 'new-script', title: 'Novo Script', icon: 'codeBox' }, 'ViewScriptView'),
      page({ key: '', keyPrefix: 'view-script:', title: 'Script', icon: 'codeBox' }, 'ViewScriptView'),
      page({ key: 'actions', title: 'Ações', icon: 'cursor' }, 'ActionsView'),
      page({ key: 'new-action', title: 'Nova Ação', icon: 'cursor' }, 'ViewActionView'),
      page({ key: '', keyPrefix: 'view-action:', title: 'Ação', icon: 'cursor' }, 'ViewActionView'),
      page({ key: 'function-reference', title: 'Referência de Expressões', icon: 'bookSimple' }, 'FunctionReferenceView'),
      page({ key: 'data-function-reference', title: 'Funções de Dados', icon: 'database2' }, 'DataFunctionReferenceView'),
      command('workflow', { group: 'Automações' }, 'WorkflowCommandProvider'),
    ],
  },
};
