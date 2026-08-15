import type { PluginRecord } from '../../kernel';
import { mutationDepsOf, queryDepsOf } from '../../infrastructure/workflow/stepDeps';
import type { StepFactory } from '../workflowExtensionPoints';
import { workflowStep } from '../workflowExtensionPoints';
import { makeCallWorkflowStepDefinition } from '../../infrastructure/workflow/steps/CallWorkflowStep';
import { makeScriptStepDefinition } from '../../infrastructure/workflow/steps/ScriptStep';
import { makeNotifyStepDefinition } from '../../infrastructure/workflow/steps/NotifyStep';
import { makeExitStepDefinition } from '../../infrastructure/workflow/steps/ExitStep';
import { makeMapStepDefinition } from '../../infrastructure/workflow/steps/MapStep';
import { makeQueryStepDefinition } from '../../infrastructure/workflow/steps/QueryStep';
import { makeUpsertStepDefinition } from '../../infrastructure/workflow/steps/UpsertStep';
import { makeValidateStepDefinition } from '../../infrastructure/workflow/steps/ValidateStep';
import { makeRemoveStepDefinition } from '../../infrastructure/workflow/steps/RemoveStep';
import { makeRegisterAuditStepDefinition } from '../../infrastructure/workflow/steps/RegisterAuditStep';
import { makeSetVariableStepDefinition } from '../../infrastructure/workflow/steps/SetVariableStep';

const factories: Record<string, StepFactory> = {
  Notify: (deps) => makeNotifyStepDefinition(deps.createAuditLogUseCase),
  RegisterAudit: (deps) => makeRegisterAuditStepDefinition(deps.createAuditLogUseCase),
  SetVariable: () => makeSetVariableStepDefinition(),
  Map: () => makeMapStepDefinition(),
  Validate: (deps) => makeValidateStepDefinition(deps.screenDefinitionProvider),
  Exit: () => makeExitStepDefinition(),
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
};

export const coreStepsPlugin: PluginRecord = {
  trusted: true,
  implementations: factories,
  manifest: {
    id: 'core.steps',
    version: '1.0.0',
    kernel: '^1.0.0',
    name: '@core.automation/plugin.steps.name',
    dependencies: { 'core.workflow': '^1.0.0' },
    contributes: [
      workflowStep({ stepDefinitionId: 'notify', name: 'Notificar', category: 'Notification' }, 'Notify'),
      workflowStep({ stepDefinitionId: 'register-audit', name: 'Registrar Auditoria', category: 'Action' }, 'RegisterAudit'),
      workflowStep({ stepDefinitionId: 'set-variable', name: '@core.automation/step.set-variable.short-name', category: 'Action' }, 'SetVariable'),
      workflowStep({ stepDefinitionId: 'map', name: 'Montar Objeto', category: 'Data' }, 'Map'),
      workflowStep({ stepDefinitionId: 'validate-object', name: 'Validar Objeto', category: 'Data' }, 'Validate'),
      workflowStep({ stepDefinitionId: 'exit', name: 'Encerrar Workflow', category: 'Action' }, 'Exit'),
      workflowStep({ stepDefinitionId: 'call-workflow', name: 'Chamar Workflow', category: 'Action' }, 'CallWorkflow'),
      workflowStep({ stepDefinitionId: 'script', name: 'Script', category: 'Action' }, 'Script'),
      workflowStep({ stepDefinitionId: 'query', name: 'Buscar Registros', category: 'Data' }, 'Query'),
      workflowStep({ stepDefinitionId: 'upsert', name: 'Gravar Registro', category: 'Data' }, 'Upsert'),
      workflowStep({ stepDefinitionId: 'remove', name: 'Excluir Registro', category: 'Data' }, 'Remove'),
    ],
  },
};
