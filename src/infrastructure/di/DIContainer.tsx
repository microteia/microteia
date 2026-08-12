import React, { useContext, useMemo } from 'react';
import { KernelContext } from '../../stores/useKernel';
import { resolvePluginService } from './pluginServices';
import { FirebaseAuthRepository } from '../../data/repositories/FirebaseAuthRepository';
import { FirebaseUserRepository } from '../../data/repositories/FirebaseUserRepository';
import { FirebaseUserProfileRepository } from '../../data/repositories/FirebaseUserProfileRepository';
import { FirebaseAIConnectionRepository } from '../../data/repositories/FirebaseAIConnectionRepository';
import { FirebaseGmailConnectionRepository } from '../../data/repositories/FirebaseGmailConnectionRepository';
import { FirebaseSavedFilterRepository } from '../../data/repositories/FirebaseSavedFilterRepository';
import { FirebaseTenantRepository } from '../../data/repositories/FirebaseTenantRepository';
import { FirebaseTextAnnotationRepository } from '../../data/repositories/FirebaseTextAnnotationRepository';
import { FirebaseAuditLogRepository } from '../../data/repositories/FirebaseAuditLogRepository';
import { FirebaseAuditLogService } from '../../data/services/FirebaseAuditLogService';
import { FirebaseScreenDefinitionRepository } from '../../data/repositories/FirebaseScreenDefinitionRepository';
import { FirebaseRecordRepository } from '../../data/repositories/FirebaseRecordRepository';
import { FirebaseLookupRepository } from '../../data/repositories/FirebaseLookupRepository';
import { FirebaseLookupDefinitionRepository } from '../../data/repositories/FirebaseLookupDefinitionRepository';
import { FirebaseTagRepository } from '../../data/repositories/FirebaseTagRepository';
import { FirebaseTagDefinitionRepository } from '../../data/repositories/FirebaseTagDefinitionRepository';
import { FirebaseRecordNoteRepository } from '../../data/repositories/FirebaseRecordNoteRepository';
import { FirebaseRecordDocumentRepository } from '../../data/repositories/FirebaseRecordDocumentRepository';
import { FirebaseWorkflowDefinitionRepository } from '../../data/repositories/FirebaseWorkflowDefinitionRepository';
import { FirebaseWorkflowExecutionRepository } from '../../data/repositories/FirebaseWorkflowExecutionRepository';
import { FirebaseScriptRepository } from '../../data/repositories/FirebaseScriptRepository';
import { FirebaseDataProcessorRepository } from '../../data/repositories/FirebaseDataProcessorRepository';
import { FirebaseActionRepository } from '../../data/repositories/FirebaseActionRepository';
import { FirebasePluginInstallationRepository } from '../../data/repositories/FirebasePluginInstallationRepository';
import { FirebasePluginRegistryRepository } from '../../data/repositories/FirebasePluginRegistryRepository';
import { FirebaseTenantExtensionRepository } from '../../data/repositories/FirebaseTenantExtensionRepository';
import { FirebaseInstalledExtensionRepository } from '../../data/repositories/FirebaseInstalledExtensionRepository';
import { FirebasePublicExtensionRepository } from '../../data/repositories/FirebasePublicExtensionRepository';
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
    savedFilterRepository:    new FirebaseSavedFilterRepository(),
    tenantRepository:         new FirebaseTenantRepository(),
    textAnnotationRepository: new FirebaseTextAnnotationRepository(),
    auditLogRepository:       new FirebaseAuditLogRepository(),
    auditLogService:          new FirebaseAuditLogService(),
    screenDefinitionRepository: new FirebaseScreenDefinitionRepository(),
    recordRepository:         new FirebaseRecordRepository(),
    lookupRepository:         new FirebaseLookupRepository(),
    lookupDefinitionRepository: new FirebaseLookupDefinitionRepository(),
    tagRepository:            new FirebaseTagRepository(),
    tagDefinitionRepository:  new FirebaseTagDefinitionRepository(),
    recordNoteRepository:     new FirebaseRecordNoteRepository(),
    recordDocumentRepository: new FirebaseRecordDocumentRepository(),
    workflowDefinitionRepository: new FirebaseWorkflowDefinitionRepository(),
    workflowExecutionRepository: new FirebaseWorkflowExecutionRepository(),
    scriptRepository:         new FirebaseScriptRepository(),
    dataProcessorRepository:  new FirebaseDataProcessorRepository(),
    actionRepository:         new FirebaseActionRepository(),
    pluginInstallationRepository: new FirebasePluginInstallationRepository(),
    pluginRegistryRepository: new FirebasePluginRegistryRepository(),
    tenantExtensionRepository: new FirebaseTenantExtensionRepository(),
    installedExtensionRepository: new FirebaseInstalledExtensionRepository(),
    publicExtensionRepository: new FirebasePublicExtensionRepository(),
  }), [host]);

  return <DIContext.Provider value={container}>{children}</DIContext.Provider>;
};
