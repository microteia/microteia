import type { StepDefinitionSummary } from '../entities/WorkflowStepCatalog';

export interface IStepCatalogRepository {
  subscribeToStepCatalog(onUpdate: (catalog: StepDefinitionSummary[]) => void): () => void;
}
