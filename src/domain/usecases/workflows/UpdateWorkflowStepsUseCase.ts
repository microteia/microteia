import type { WorkflowStep } from '../../entities/Workflow';
import type { IWorkflowDefinitionRepository } from '../../repositories/IWorkflowDefinitionRepository';

export type UpdateWorkflowStepsUseCase = {
  execute: (tenantId: string, id: string, steps: WorkflowStep[]) => Promise<void>;
};

export const makeUpdateWorkflowStepsUseCase = (repo: IWorkflowDefinitionRepository): UpdateWorkflowStepsUseCase => ({
  execute: (tenantId, id, steps) => repo.updateWorkflowSteps(tenantId, id, steps),
});
