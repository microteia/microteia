import type { PluginRecord } from '../../kernel';
import { mutationDepsOf, queryDepsOf } from '../../infrastructure/workflow/stepDeps';
import type { StepFactory } from '../workflowExtensionPoints';
import { workflowStep } from '../workflowExtensionPoints';
import { makeCallWorkflowStepDefinition } from '../../infrastructure/workflow/steps/CallWorkflowStep';
import { makeScriptStepDefinition } from '../../infrastructure/workflow/steps/ScriptStep';
import { makeNotifyStepDefinition } from '../../infrastructure/workflow/steps/NotifyStep';
import { makeExitStepDefinition } from '../../infrastructure/workflow/steps/ExitStep';
import { makeDelayStepDefinition } from '../../infrastructure/workflow/steps/DelayStep';
import { makeMapStepDefinition } from '../../infrastructure/workflow/steps/MapStep';
import { makeQueryStepDefinition } from '../../infrastructure/workflow/steps/QueryStep';
import { makeUpsertStepDefinition } from '../../infrastructure/workflow/steps/UpsertStep';
import { makeValidateStepDefinition } from '../../infrastructure/workflow/steps/ValidateStep';
import { makeRemoveStepDefinition } from '../../infrastructure/workflow/steps/RemoveStep';
import { makeRegisterAuditStepDefinition } from '../../infrastructure/workflow/steps/RegisterAuditStep';
import { makeSetVariableStepDefinition } from '../../infrastructure/workflow/steps/SetVariableStep';
import { makeRenderDocumentStepDefinition } from '../../infrastructure/workflow/steps/RenderDocumentStep';
import { makeShareDocumentsStepDefinition } from '../../infrastructure/workflow/steps/ShareDocumentsStep';
import { makePortalInviteStepDefinition, makePortalRevokeStepDefinition } from '../../infrastructure/workflow/steps/PortalAccessSteps';
import { makeHttpRequestStepDefinition } from '../../infrastructure/workflow/steps/HttpRequestStep';
import { makeApprovalStepDefinition } from '../../infrastructure/workflow/steps/ApprovalStep';

const factories: Record<string, StepFactory> = {
  Notify: (deps) => makeNotifyStepDefinition(deps.dispatchNotificationUseCase, deps.screenDefinitionProvider),
  RegisterAudit: (deps) => makeRegisterAuditStepDefinition(deps.createAuditLogUseCase),
  SetVariable: () => makeSetVariableStepDefinition(),
  Map: () => makeMapStepDefinition(),
  Validate: (deps) => makeValidateStepDefinition(deps.screenDefinitionProvider),
  Exit: () => makeExitStepDefinition(),
  Delay: () => makeDelayStepDefinition(),
  Approval: (deps) => makeApprovalStepDefinition(deps.approval),
  CallWorkflow: (deps) => makeCallWorkflowStepDefinition(deps.runCalledWorkflowUseCase),
  Script: (deps) =>
    makeScriptStepDefinition(deps.scriptRepository, queryDepsOf(deps), mutationDepsOf(deps)),
  Query: (deps) =>
    makeQueryStepDefinition(
      deps.workflowQueryRepository,
      deps.workflowRecordFetcher,
      deps.screenDefinitionProvider,
    ),
  Upsert: (deps) => makeUpsertStepDefinition(mutationDepsOf(deps)),
  Remove: (deps) => makeRemoveStepDefinition(mutationDepsOf(deps)),
  RenderDocument: (deps) => makeRenderDocumentStepDefinition(deps.renderDocumentUseCase),
  ShareDocuments: (deps) => makeShareDocumentsStepDefinition(deps.shareRecordDocumentsUseCase),
  PortalInvite: (deps) => makePortalInviteStepDefinition(deps.portalAccess),
  PortalRevoke: (deps) => makePortalRevokeStepDefinition(deps.portalAccess),
  HttpRequest: (deps) => makeHttpRequestStepDefinition(deps.http),
};

export const coreStepsPlugin: PluginRecord = {
  trusted: true,
  implementations: factories,
  manifest: {
    id: 'core.steps',
    version: '1.0.0',
    kernel: '^2.0.0',
    name: '@core.automation/plugin.steps.name',
    dependencies: { 'core.workflow': '^1.0.0' },
    contributes: [
      workflowStep({ stepDefinitionId: 'notify', name: '@core.automation/step.notify.name', category: 'Notification' }, 'Notify'),
      workflowStep({ stepDefinitionId: 'register-audit', name: '@core.automation/step.register-audit.name', category: 'Action' }, 'RegisterAudit'),
      workflowStep({ stepDefinitionId: 'set-variable', name: '@core.automation/step.set-variable.short-name', category: 'Action' }, 'SetVariable'),
      workflowStep({ stepDefinitionId: 'map', name: '@core.automation/step.map.name', category: 'Data' }, 'Map'),
      workflowStep({ stepDefinitionId: 'validate-object', name: '@core.automation/step.validate-object.name', category: 'Data' }, 'Validate'),
      workflowStep({ stepDefinitionId: 'exit', name: '@core.automation/step.exit.name', category: 'Action' }, 'Exit'),
      workflowStep({ stepDefinitionId: 'delay', name: '@core.automation/step.delay.name', category: 'Action' }, 'Delay'),
      workflowStep({ stepDefinitionId: 'approval', name: '@core.automation/step.approval.name', category: 'Action' }, 'Approval'),
      workflowStep({ stepDefinitionId: 'call-workflow', name: '@core.automation/step.call-workflow.name', category: 'Action' }, 'CallWorkflow'),
      workflowStep({ stepDefinitionId: 'script', name: '@core.automation/step.script.name', category: 'Action' }, 'Script'),
      workflowStep({ stepDefinitionId: 'query', name: '@core.automation/step.query.name', category: 'Data' }, 'Query'),
      workflowStep({ stepDefinitionId: 'upsert', name: '@core.automation/step.upsert.name', category: 'Data' }, 'Upsert'),
      workflowStep({ stepDefinitionId: 'remove', name: '@core.automation/step.remove.name', category: 'Data' }, 'Remove'),
      workflowStep({ stepDefinitionId: 'render-document', name: '@core.automation/step.render-document.name', category: 'Data' }, 'RenderDocument'),
      workflowStep({ stepDefinitionId: 'share-documents', name: '@core.automation/step.share-documents.name', category: 'Data' }, 'ShareDocuments'),
      workflowStep({ stepDefinitionId: 'portal-invite', name: '@core.automation/step.portal-invite.name', category: 'Data' }, 'PortalInvite'),
      workflowStep({ stepDefinitionId: 'portal-revoke', name: '@core.automation/step.portal-revoke.name', category: 'Data' }, 'PortalRevoke'),
      workflowStep({ stepDefinitionId: 'http-request', name: '@core.automation/step.http.name', category: 'Integration' }, 'HttpRequest'),
    ],
  },
};
