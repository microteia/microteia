import { stepRegistry } from '../../domain/engine/StepRegistry';
import type { IDeadlineRepository } from '../../domain/repositories/IDeadlineRepository';
import type { CreateAuditLogUseCase } from '../../domain/usecases/CreateAuditLogUseCase';
import { makeCreateDeadlineStepDefinition } from './steps/CreateDeadlineStep';
import { makeNotifyStepDefinition } from './steps/NotifyStep';
import { makeRegisterAuditStepDefinition } from './steps/RegisterAuditStep';
import { makeSetVariableStepDefinition } from './steps/SetVariableStep';

export interface RegisterStepsDeps {
  deadlineRepository: IDeadlineRepository;
  createAuditLogUseCase: CreateAuditLogUseCase;
}

/**
 * Composition root: único lugar em todo o motor que conhece tanto o StepRegistry quanto os
 * Steps concretos (que dependem de módulos de domínio). Chamado uma vez no cold start da
 * function. Adicionar um novo Step nunca exige alterar WorkflowExecutor/StepRegistry — só
 * escrever o plugin e registrá-lo aqui.
 */
export const registerSteps = (deps: RegisterStepsDeps): void => {
  stepRegistry.register(makeCreateDeadlineStepDefinition(deps.deadlineRepository));
  stepRegistry.register(makeNotifyStepDefinition(deps.createAuditLogUseCase));
  stepRegistry.register(makeRegisterAuditStepDefinition(deps.createAuditLogUseCase));
  stepRegistry.register(makeSetVariableStepDefinition());
};
