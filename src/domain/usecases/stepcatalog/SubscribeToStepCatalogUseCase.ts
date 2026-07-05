import type { StepDefinitionSummary } from '../../entities/WorkflowStepCatalog';
import type { IStepCatalogRepository } from '../../repositories/IStepCatalogRepository';

export type SubscribeToStepCatalogUseCase = {
  execute: (onUpdate: (catalog: StepDefinitionSummary[]) => void) => () => void;
};

export const makeSubscribeToStepCatalogUseCase = (repo: IStepCatalogRepository): SubscribeToStepCatalogUseCase => ({
  execute: (onUpdate) => repo.subscribeToStepCatalog(onUpdate),
});
