import React, { useContext, useMemo } from 'react';
import { KernelContext } from '../../stores/useKernel';
import { resolvePluginService } from './pluginServices';
import { FirebaseAuthRepository } from '../../data/repositories/FirebaseAuthRepository';
import { FirebaseUserRepository } from '../../data/repositories/FirebaseUserRepository';
import { FirebaseUserProfileRepository } from '../../data/repositories/FirebaseUserProfileRepository';
import { FirebaseAIConnectionRepository } from '../../data/repositories/FirebaseAIConnectionRepository';
import { FirebaseGmailConnectionRepository } from '../../data/repositories/FirebaseGmailConnectionRepository';
import { FirebaseNewsRepository } from '../../data/repositories/FirebaseNewsRepository';
import { FirebaseNewsInteractionRepository } from '../../data/repositories/FirebaseNewsInteractionRepository';
import { FirebaseNewsTagRepository } from '../../data/repositories/FirebaseNewsTagRepository';
import { FirebaseNewsTagLinkRepository } from '../../data/repositories/FirebaseNewsTagLinkRepository';
import { FirebaseNewsCommentRepository } from '../../data/repositories/FirebaseNewsCommentRepository';
import { FirebaseNewsDocumentRepository } from '../../data/repositories/FirebaseNewsDocumentRepository';
import { FirebaseNewsCategoryRepository } from '../../data/repositories/FirebaseNewsCategoryRepository';
import { FirebaseSavedFilterRepository } from '../../data/repositories/FirebaseSavedFilterRepository';
import { FirebaseTenantRepository } from '../../data/repositories/FirebaseTenantRepository';
import { FirebasePersonRepository } from '../../data/repositories/FirebasePersonRepository';
import { FirebaseCaseRepository } from '../../data/repositories/FirebaseCaseRepository';
import { FirebaseDeadlineRepository } from '../../data/repositories/FirebaseDeadlineRepository';
import { FirebaseFinancialRepository } from '../../data/repositories/FirebaseFinancialRepository';
import { FirebaseFinancialTagRepository } from '../../data/repositories/FirebaseFinancialTagRepository';
import { FirebaseFinancialDocumentRepository } from '../../data/repositories/FirebaseFinancialDocumentRepository';
import { FirebasePushRepository } from '../../data/repositories/FirebasePushRepository';
import { FirebasePushInteractionRepository } from '../../data/repositories/FirebasePushInteractionRepository';
import { FirebaseTextAnnotationRepository } from '../../data/repositories/FirebaseTextAnnotationRepository';
import { FirebasePersonTagRepository } from '../../data/repositories/FirebasePersonTagRepository';
import { FirebasePersonNoteRepository } from '../../data/repositories/FirebasePersonNoteRepository';
import { FirebasePersonDocumentRepository } from '../../data/repositories/FirebasePersonDocumentRepository';
import { FirebaseCaseTagRepository } from '../../data/repositories/FirebaseCaseTagRepository';
import { FirebaseCaseNoteRepository } from '../../data/repositories/FirebaseCaseNoteRepository';
import { FirebaseCaseDocumentRepository } from '../../data/repositories/FirebaseCaseDocumentRepository';
import { FirebaseCaseAreaRepository } from '../../data/repositories/FirebaseCaseAreaRepository';
import { FirebaseCasePhaseRepository } from '../../data/repositories/FirebaseCasePhaseRepository';
import { FirebaseCaseStatusRepository } from '../../data/repositories/FirebaseCaseStatusRepository';
import { FirebaseCaseInstanceRepository } from '../../data/repositories/FirebaseCaseInstanceRepository';
import { FirebaseCaseActionTypeRepository } from '../../data/repositories/FirebaseCaseActionTypeRepository';
import { FirebaseCaseCourtRepository } from '../../data/repositories/FirebaseCaseCourtRepository';
import { FirebaseCaseDistrictRepository } from '../../data/repositories/FirebaseCaseDistrictRepository';
import { FirebaseCaseJudgeRepository } from '../../data/repositories/FirebaseCaseJudgeRepository';
import { FirebasePersonLookupRepository } from '../../data/repositories/FirebasePersonLookupRepository';
import { FirebaseContractRepository } from '../../data/repositories/FirebaseContractRepository';
import { FirebaseContractTagRepository } from '../../data/repositories/FirebaseContractTagRepository';
import { FirebaseContractNoteRepository } from '../../data/repositories/FirebaseContractNoteRepository';
import { FirebaseContractDocumentRepository } from '../../data/repositories/FirebaseContractDocumentRepository';
import { FirebaseContractLookupRepository } from '../../data/repositories/FirebaseContractLookupRepository';
import { FirebaseFinancialLookupRepository } from '../../data/repositories/FirebaseFinancialLookupRepository';
import { FirebaseDeadlineTypeRepository } from '../../data/repositories/FirebaseDeadlineTypeRepository';
import { FirebaseDocumentTypeRepository } from '../../data/repositories/FirebaseDocumentTypeRepository';
import { FirebaseAuditLogRepository } from '../../data/repositories/FirebaseAuditLogRepository';
import { FirebaseAuditLogService } from '../../data/services/FirebaseAuditLogService';
import { FirebaseScreenDefinitionRepository } from '../../data/repositories/FirebaseScreenDefinitionRepository';
import { FirebaseCustomRecordRepository } from '../../data/repositories/FirebaseCustomRecordRepository';
import { FirebaseCustomRecordNoteRepository } from '../../data/repositories/FirebaseCustomRecordNoteRepository';
import { FirebaseCustomRecordDocumentRepository } from '../../data/repositories/FirebaseCustomRecordDocumentRepository';
import { FirebaseWorkflowDefinitionRepository } from '../../data/repositories/FirebaseWorkflowDefinitionRepository';
import { FirebaseWorkflowExecutionRepository } from '../../data/repositories/FirebaseWorkflowExecutionRepository';
import { FirebaseScriptRepository } from '../../data/repositories/FirebaseScriptRepository';
import { FirebaseDataProcessorRepository } from '../../data/repositories/FirebaseDataProcessorRepository';
import { FirebaseActionRepository } from '../../data/repositories/FirebaseActionRepository';
import { ViaCepLookupService } from '../../data/services/ViaCepLookupService';
import { DIContext } from './useDI';
import type { DIContainer } from './useDI';

export const DIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const kernel = useContext(KernelContext);
  const host = kernel?.host ?? null;

  const container = useMemo<DIContainer>(() => ({
    resolveService: <T,>(serviceKey: string): T | undefined =>
      host ? resolvePluginService<T>(host, serviceKey) : undefined,
    authRepository:           new FirebaseAuthRepository(),
    userRepository:           new FirebaseUserRepository(),
    userProfileRepository:    new FirebaseUserProfileRepository(),
    aiConnectionRepository:   new FirebaseAIConnectionRepository(),
    gmailConnectionRepository: new FirebaseGmailConnectionRepository(),
    newsRepository:           new FirebaseNewsRepository(),
    newsInteractionRepository: new FirebaseNewsInteractionRepository(),
    newsTagRepository:        new FirebaseNewsTagRepository(),
    newsTagLinkRepository:    new FirebaseNewsTagLinkRepository(),
    newsCommentRepository:    new FirebaseNewsCommentRepository(),
    newsDocumentRepository:   new FirebaseNewsDocumentRepository(),
    newsCategoryRepository:   new FirebaseNewsCategoryRepository(),
    savedFilterRepository:    new FirebaseSavedFilterRepository(),
    tenantRepository:         new FirebaseTenantRepository(),
    personRepository:         new FirebasePersonRepository(),
    personTagRepository:      new FirebasePersonTagRepository(),
    personNoteRepository:     new FirebasePersonNoteRepository(),
    personDocumentRepository: new FirebasePersonDocumentRepository(),
    personLookupRepository:   new FirebasePersonLookupRepository(),
    caseRepository:           new FirebaseCaseRepository(),
    caseTagRepository:        new FirebaseCaseTagRepository(),
    caseNoteRepository:       new FirebaseCaseNoteRepository(),
    caseDocumentRepository:   new FirebaseCaseDocumentRepository(),
    caseAreaRepository:       new FirebaseCaseAreaRepository(),
    casePhaseRepository:      new FirebaseCasePhaseRepository(),
    caseStatusRepository:     new FirebaseCaseStatusRepository(),
    caseInstanceRepository:   new FirebaseCaseInstanceRepository(),
    caseActionTypeRepository: new FirebaseCaseActionTypeRepository(),
    caseCourtRepository:      new FirebaseCaseCourtRepository(),
    caseDistrictRepository:   new FirebaseCaseDistrictRepository(),
    caseJudgeRepository:      new FirebaseCaseJudgeRepository(),
    contractRepository:         new FirebaseContractRepository(),
    contractTagRepository:      new FirebaseContractTagRepository(),
    contractNoteRepository:     new FirebaseContractNoteRepository(),
    contractDocumentRepository: new FirebaseContractDocumentRepository(),
    contractLookupRepository:   new FirebaseContractLookupRepository(),
    deadlineRepository:       new FirebaseDeadlineRepository(),
    deadlineTypeRepository:   new FirebaseDeadlineTypeRepository(),
    financialRepository:      new FirebaseFinancialRepository(),
    financialTagRepository:   new FirebaseFinancialTagRepository(),
    financialDocumentRepository: new FirebaseFinancialDocumentRepository(),
    financialLookupRepository: new FirebaseFinancialLookupRepository(),
    textAnnotationRepository: new FirebaseTextAnnotationRepository(),
    pushRepository:           new FirebasePushRepository(),
    pushInteractionRepository: new FirebasePushInteractionRepository(),
    documentTypeRepository:   new FirebaseDocumentTypeRepository(),
    auditLogRepository:       new FirebaseAuditLogRepository(),
    auditLogService:          new FirebaseAuditLogService(),
    screenDefinitionRepository: new FirebaseScreenDefinitionRepository(),
    customRecordRepository:   new FirebaseCustomRecordRepository(),
    customRecordNoteRepository: new FirebaseCustomRecordNoteRepository(),
    customRecordDocumentRepository: new FirebaseCustomRecordDocumentRepository(),
    workflowDefinitionRepository: new FirebaseWorkflowDefinitionRepository(),
    workflowExecutionRepository: new FirebaseWorkflowExecutionRepository(),
    scriptRepository:         new FirebaseScriptRepository(),
    dataProcessorRepository:  new FirebaseDataProcessorRepository(),
    actionRepository:         new FirebaseActionRepository(),
    externalLookupServices:   [new ViaCepLookupService()],
  }), [host]);

  return <DIContext.Provider value={container}>{children}</DIContext.Provider>;
};
