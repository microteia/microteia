import type { IWorkflowQueryRepository } from '../../domain/repositories/IWorkflowQueryRepository';
import type { IWorkflowRecordFetcher } from '../../domain/repositories/IWorkflowRecordFetcher';
import type { IWorkflowMutationRepository } from '../../domain/repositories/IWorkflowMutationRepository';
import type { IScreenDefinitionProvider } from '../../domain/repositories/IScreenDefinitionProvider';
import type { IScriptRepository } from '../../domain/repositories/IScriptRepository';
import type { CreateAuditLogUseCase } from '../../domain/usecases/CreateAuditLogUseCase';
import type { RunCalledWorkflowUseCase } from '../../domain/usecases/RunCalledWorkflowUseCase';

/**
 * Dependências que o composition root injeta nas fábricas de Step. Vive em arquivo próprio para
 * que o manifest dos plugins possa tipar sua fábrica sem importar o loader — o que fecharia um
 * ciclo (loader importa manifest, manifest importaria loader).
 */
export interface RegisterStepsDeps {
  createAuditLogUseCase: CreateAuditLogUseCase;
  workflowQueryRepository: IWorkflowQueryRepository;
  workflowRecordFetcher: IWorkflowRecordFetcher;
  workflowMutationRepository: IWorkflowMutationRepository;
  screenDefinitionProvider: IScreenDefinitionProvider;
  scriptRepository: IScriptRepository;
  runCalledWorkflowUseCase: RunCalledWorkflowUseCase;
}

export interface QueryStepDeps {
  queryRepository: IWorkflowQueryRepository;
  fetcher: IWorkflowRecordFetcher;
  screenProvider: IScreenDefinitionProvider;
}

export interface MutationStepDeps {
  mutationRepository: IWorkflowMutationRepository;
  screenProvider: IScreenDefinitionProvider;
}

export const queryDepsOf = (deps: RegisterStepsDeps): QueryStepDeps => ({
  queryRepository: deps.workflowQueryRepository,
  fetcher: deps.workflowRecordFetcher,
  screenProvider: deps.screenDefinitionProvider,
});

export const mutationDepsOf = (deps: RegisterStepsDeps): MutationStepDeps => ({
  mutationRepository: deps.workflowMutationRepository,
  screenProvider: deps.screenDefinitionProvider,
});
