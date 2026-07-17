import { stepRegistry } from '../../domain/engine/StepRegistry';
import type { IDeadlineRepository } from '../../domain/repositories/IDeadlineRepository';
import type { IWorkflowQueryRepository } from '../../domain/repositories/IWorkflowQueryRepository';
import type { IWorkflowRecordFetcher } from '../../domain/repositories/IWorkflowRecordFetcher';
import type { IWorkflowMutationRepository } from '../../domain/repositories/IWorkflowMutationRepository';
import type { IScreenDefinitionProvider } from '../../domain/repositories/IScreenDefinitionProvider';
import type { IScriptRepository } from '../../domain/repositories/IScriptRepository';
import type { CreateAuditLogUseCase } from '../../domain/usecases/CreateAuditLogUseCase';
import type { RunCalledWorkflowUseCase } from '../../domain/usecases/RunCalledWorkflowUseCase';
import { makeCallWorkflowStepDefinition } from './steps/CallWorkflowStep';
import { makeScriptStepDefinition } from './steps/ScriptStep';
import { makeCreateDeadlineStepDefinition } from './steps/CreateDeadlineStep';
import { makeNotifyStepDefinition } from './steps/NotifyStep';
import { makeOutputStepDefinition } from './steps/OutputStep';
import { makeMapStepDefinition } from './steps/MapStep';
import { makeQueryStepDefinition } from './steps/QueryStep';
import { makeUpsertStepDefinition } from './steps/UpsertStep';
import { makeValidateStepDefinition } from './steps/ValidateStep';
import { makeRemoveStepDefinition } from './steps/RemoveStep';
import { makeRegisterAuditStepDefinition } from './steps/RegisterAuditStep';
import { makeSetVariableStepDefinition } from './steps/SetVariableStep';

export interface RegisterStepsDeps {
  deadlineRepository: IDeadlineRepository;
  createAuditLogUseCase: CreateAuditLogUseCase;
  workflowQueryRepository: IWorkflowQueryRepository;
  workflowRecordFetcher: IWorkflowRecordFetcher;
  workflowMutationRepository: IWorkflowMutationRepository;
  screenDefinitionProvider: IScreenDefinitionProvider;
  scriptRepository: IScriptRepository;
  runCalledWorkflowUseCase: RunCalledWorkflowUseCase;
}

/**
 * Composition root: único lugar em todo o motor que conhece tanto o StepRegistry quanto os
 * Steps concretos (que dependem de módulos de domínio). Chamado uma vez no cold start da
 * function. Adicionar um novo Step nunca exige alterar WorkflowExecutor/StepRegistry — só
 * escrever o plugin e registrá-lo aqui.
 */
export const registerSteps = (deps: RegisterStepsDeps): void => {
  const queryDeps = {
    queryRepository: deps.workflowQueryRepository,
    fetcher: deps.workflowRecordFetcher,
    screenProvider: deps.screenDefinitionProvider,
  };
  const mutationDeps = {
    mutationRepository: deps.workflowMutationRepository,
    screenProvider: deps.screenDefinitionProvider,
  };

  stepRegistry.register(makeCreateDeadlineStepDefinition(deps.deadlineRepository));
  stepRegistry.register(makeNotifyStepDefinition(deps.createAuditLogUseCase));
  stepRegistry.register(makeRegisterAuditStepDefinition(deps.createAuditLogUseCase));
  stepRegistry.register(makeSetVariableStepDefinition());
  stepRegistry.register(makeMapStepDefinition());
  stepRegistry.register(makeValidateStepDefinition(deps.screenDefinitionProvider));
  stepRegistry.register(makeOutputStepDefinition());
  stepRegistry.register(makeCallWorkflowStepDefinition(deps.runCalledWorkflowUseCase));
  stepRegistry.register(makeScriptStepDefinition(deps.scriptRepository, queryDeps, mutationDeps));
  stepRegistry.register(
    makeQueryStepDefinition(deps.workflowQueryRepository, deps.workflowRecordFetcher, deps.screenDefinitionProvider),
  );
  stepRegistry.register(makeUpsertStepDefinition(mutationDeps));
  stepRegistry.register(makeRemoveStepDefinition(mutationDeps));
};
