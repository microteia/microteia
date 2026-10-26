import type { IWorkflowQueryRepository } from '../../domain/repositories/IWorkflowQueryRepository';
import type { IWorkflowRecordFetcher } from '../../domain/repositories/IWorkflowRecordFetcher';
import type { IWorkflowMutationRepository } from '../../domain/repositories/IWorkflowMutationRepository';
import type { IScreenDefinitionProvider } from '../../domain/repositories/IScreenDefinitionProvider';
import type { IScriptRepository } from '../../domain/repositories/IScriptRepository';
import type { IAIConnectionRepository } from '../../domain/repositories/IAIConnectionRepository';
import type { IWorkflowDefinitionRepository } from '../../domain/repositories/IWorkflowDefinitionRepository';
import type { CreateAuditLogUseCase } from '../../domain/usecases/CreateAuditLogUseCase';
import type { DispatchNotificationUseCase } from '../../domain/usecases/DispatchNotificationUseCase';
import type { RenderDocumentUseCase } from '../../domain/usecases/RenderDocumentUseCase';
import type { ShareRecordDocumentsUseCase } from '../../domain/usecases/ShareRecordDocumentsUseCase';
import type { CallAIUseCase } from '../../domain/usecases/CallAIUseCase';
import type { RunCalledWorkflowUseCase } from '../../domain/usecases/RunCalledWorkflowUseCase';

/**
 * Dependências que o composition root injeta nas fábricas de Step. Vive em arquivo próprio para
 * que o manifest dos plugins possa tipar sua fábrica sem importar o loader — o que fecharia um
 * ciclo (loader importa manifest, manifest importaria loader).
 */
export interface RegisterStepsDeps {
  createAuditLogUseCase: CreateAuditLogUseCase;
  dispatchNotificationUseCase: DispatchNotificationUseCase;
  renderDocumentUseCase: RenderDocumentUseCase;
  shareRecordDocumentsUseCase: ShareRecordDocumentsUseCase;
  workflowQueryRepository: IWorkflowQueryRepository;
  workflowRecordFetcher: IWorkflowRecordFetcher;
  workflowMutationRepository: IWorkflowMutationRepository;
  screenDefinitionProvider: IScreenDefinitionProvider;
  scriptRepository: IScriptRepository;
  runCalledWorkflowUseCase: RunCalledWorkflowUseCase;
  workflowDefinitionRepository: IWorkflowDefinitionRepository;
  aiConnectionRepository: IAIConnectionRepository;
  callAIUseCase: CallAIUseCase;
}

/**
 * O que um passo de IA precisa: o modelo, a credencial do escritório e as automações que ele pode
 * ler. Os três andam juntos — quem detecta a automação e quem extrai os parâmetros dela usam
 * exatamente o mesmo trio.
 */
export interface AIStepDeps {
  workflowDefinitionRepository: IWorkflowDefinitionRepository;
  aiConnectionRepository: IAIConnectionRepository;
  callAIUseCase: CallAIUseCase;
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

export const aiDepsOf = (deps: RegisterStepsDeps): AIStepDeps => ({
  workflowDefinitionRepository: deps.workflowDefinitionRepository,
  aiConnectionRepository: deps.aiConnectionRepository,
  callAIUseCase: deps.callAIUseCase,
});
