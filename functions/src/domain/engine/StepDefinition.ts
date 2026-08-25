import type { WorkflowContext, WorkflowResult } from '../entities/WorkflowContext';
import type { CatalogStepType, WorkflowStepMetadata } from '../schema/workflowStepCatalog';

/**
 * A metadata de um passo é DADO do kernel, e vive em `src/domain/schema/workflowStepCatalog.ts` —
 * de onde `sync-schemas` a copia para cá. Aqui fica só o que é do backend: o executor.
 *
 * Antes deste arquivo era o dono das duas coisas, e o efeito era que o catálogo — a única coisa que
 * quem escreve uma automação precisa saber antes de tudo — ficava inalcançável para o SDK, o MCP e o
 * guia de autoria, que vivem em `src/`.
 */
export type {
  CatalogStepType,
  DynamicInputsMetadata,
  DynamicOutputsMetadata,
  InputDefinition,
  InputMappingKind,
  InputOptionsSource,
  InputType,
  OutputDefinition,
  StepCategory,
  WorkflowStepMetadata,
} from '../schema/workflowStepCatalog';

export { coreStepMetadata } from '../schema/workflowStepCatalog';

/** Nome herdado. `CatalogStepType` é o mesmo tipo, e diz melhor o que ele restringe. */
export type StepType = CatalogStepType;

export interface WorkflowStepExecutor {
  execute(inputs: Record<string, unknown>, context: WorkflowContext): Promise<WorkflowResult>;
}

export interface StepDefinition extends WorkflowStepMetadata {
  createExecutor(): WorkflowStepExecutor;
}
