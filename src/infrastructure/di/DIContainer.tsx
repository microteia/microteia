import React, { useContext, useMemo } from 'react';
import { KernelContext } from '../../stores/useKernel';
import { resolvePluginService } from './pluginServices';
import { FirebaseAuthRepository } from '../../data/repositories/FirebaseAuthRepository';
import { FirebaseUserRepository } from '../../data/repositories/FirebaseUserRepository';
import { FirebaseRegistrationPolicyRepository } from '../../data/repositories/FirebaseRegistrationPolicyRepository';
import { FirebaseUserProfileRepository } from '../../data/repositories/FirebaseUserProfileRepository';
import { FirebaseAIConnectionRepository } from '../../data/repositories/FirebaseAIConnectionRepository';
import { FirebaseHttpConnectionRepository } from '../../data/repositories/FirebaseHttpConnectionRepository';
import { FirebaseHttpRequestTester } from '../../data/repositories/FirebaseHttpRequestTester';
import { FirebaseSavedFilterRepository } from '../../data/repositories/FirebaseSavedFilterRepository';
import { FirebaseTenantRepository } from '../../data/repositories/FirebaseTenantRepository';
import { FirebaseTextAnnotationRepository } from '../../data/repositories/FirebaseTextAnnotationRepository';
import { FirebaseAuditLogRepository } from '../../data/repositories/FirebaseAuditLogRepository';
import { FirebaseAuditArchiveRepository } from '../../data/repositories/FirebaseAuditArchiveRepository';
import { FirebaseMemberMfaRepository } from '../../data/repositories/FirebaseMemberMfaRepository';
import { FirebaseAuditLogService } from '../../data/services/FirebaseAuditLogService';
import { FirebaseNotificationInboxRepository } from '../../data/repositories/FirebaseNotificationInboxRepository';
import { BrowserDevicePushService } from '../../data/services/BrowserDevicePushService';
import { FirebaseNotificationEmailService } from '../../data/services/FirebaseNotificationEmailService';
import { FirebaseNotificationSmsService } from '../../data/services/FirebaseNotificationSmsService';
import { FirebaseNotificationOptOutService } from '../../data/services/FirebaseNotificationOptOutService';
import { FirebaseScreenDefinitionRepository } from '../../data/repositories/FirebaseScreenDefinitionRepository';
import { FirebaseRecordRepository } from '../../data/repositories/FirebaseRecordRepository';
import { FirebaseLookupRepository } from '../../data/repositories/FirebaseLookupRepository';
import { FirebaseLookupDefinitionRepository } from '../../data/repositories/FirebaseLookupDefinitionRepository';
import { FirebaseTagRepository } from '../../data/repositories/FirebaseTagRepository';
import { FirebaseTagDefinitionRepository } from '../../data/repositories/FirebaseTagDefinitionRepository';
import { FirebaseRecordNoteRepository } from '../../data/repositories/FirebaseRecordNoteRepository';
import { FirebaseRecordDocumentRepository } from '../../data/repositories/FirebaseRecordDocumentRepository';
import { FirebaseRecordFileRepository } from '../../data/repositories/FirebaseRecordFileRepository';
import { FirebaseWorkflowDefinitionRepository } from '../../data/repositories/FirebaseWorkflowDefinitionRepository';
import { FirebaseWorkflowExecutionRepository } from '../../data/repositories/FirebaseWorkflowExecutionRepository';
import { FirebaseWorkflowTaskRepository } from '../../data/repositories/FirebaseWorkflowTaskRepository';
import { FirebaseWorkflowWebhookRepository } from '../../data/repositories/FirebaseWorkflowWebhookRepository';
import { FirebaseWorkflowVersionRepository } from '../../data/repositories/FirebaseWorkflowVersionRepository';
import { FirebaseReportDraftRepository } from '../../data/repositories/FirebaseReportDraftRepository';
import { FirebaseWorkflowClockRepository } from '../../data/repositories/FirebaseWorkflowClockRepository';
import { FirebaseScriptRepository } from '../../data/repositories/FirebaseScriptRepository';
import { FirebaseDataProcessorRepository } from '../../data/repositories/FirebaseDataProcessorRepository';
import { FirebaseActionRepository } from '../../data/repositories/FirebaseActionRepository';
import { FirebaseReportDefinitionRepository } from '../../data/repositories/FirebaseReportDefinitionRepository';
import { FirebasePersonalReportRepository } from '../../data/repositories/FirebasePersonalReportRepository';
import { FirebaseDocumentTemplateRepository } from '../../data/repositories/FirebaseDocumentTemplateRepository';
import { FirebaseDownloadRepository } from '../../data/repositories/FirebaseDownloadRepository';
import { FirebasePortalRepository } from '../../data/repositories/FirebasePortalRepository';
import { FirebaseRoleRepository } from '../../data/repositories/FirebaseRoleRepository';
import { FirebaseAgentGrantRepository } from '../../data/repositories/FirebaseAgentGrantRepository';
import { FirebaseAgentAuthRequestRepository } from '../../data/repositories/FirebaseAgentAuthRequestRepository';
import { FirebaseTenantExtensionRepository } from '../../data/repositories/FirebaseTenantExtensionRepository';
import { FirebaseInstalledExtensionRepository } from '../../data/repositories/FirebaseInstalledExtensionRepository';
import { FirebaseExtensionMigrationRepository } from '../../data/repositories/FirebaseExtensionMigrationRepository';
import { FirebaseExtensionHistoryRepository } from '../../data/repositories/FirebaseExtensionHistoryRepository';
import { FirebasePublicExtensionRepository } from '../../data/repositories/FirebasePublicExtensionRepository';
import { FirebaseExtensionReputationRepository } from '../../data/repositories/FirebaseExtensionReputationRepository';
import { FirebaseSettingsRepository } from '../../data/repositories/FirebaseSettingsRepository';
import { FirebaseAggregateBackfillRepository } from '../../data/repositories/FirebaseAggregateBackfillRepository';
import { FirebaseRecordSearchJobRepository } from '../../data/repositories/FirebaseRecordSearchJobRepository';
import { FirebaseRecordKeyAdoptionRepository } from '../../data/repositories/FirebaseRecordKeyAdoptionRepository';
import { FirebaseRecordImportRepository } from '../../data/repositories/FirebaseRecordImportRepository';
import { FirebaseBackendResidueRepository } from '../../data/repositories/FirebaseBackendResidueRepository';
import { FirebaseAppliedBackendRepository } from '../../data/repositories/FirebaseAppliedBackendRepository';
import { FirebaseInstalledCatalogSourceRepository } from '../../data/repositories/FirebaseInstalledCatalogSourceRepository';
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
    registrationPolicyRepository: new FirebaseRegistrationPolicyRepository(),
    userProfileRepository:    new FirebaseUserProfileRepository(),
    aiConnectionRepository:   new FirebaseAIConnectionRepository(),
    httpConnectionRepository: new FirebaseHttpConnectionRepository(),
    httpRequestTester:        new FirebaseHttpRequestTester(),
    savedFilterRepository:    new FirebaseSavedFilterRepository(),
    settingsRepository:       new FirebaseSettingsRepository(),
    tenantRepository:         new FirebaseTenantRepository(),
    textAnnotationRepository: new FirebaseTextAnnotationRepository(),
    auditLogRepository:       new FirebaseAuditLogRepository(),
    auditArchiveRepository:   new FirebaseAuditArchiveRepository(),
    memberMfaRepository:      new FirebaseMemberMfaRepository(),
    auditLogService:          new FirebaseAuditLogService(),
    notificationInboxRepository: new FirebaseNotificationInboxRepository(),
    devicePushService:        new BrowserDevicePushService(),
    notificationEmailService: new FirebaseNotificationEmailService(),
    notificationSmsService:   new FirebaseNotificationSmsService(),
    notificationOptOutService: new FirebaseNotificationOptOutService(),
    screenDefinitionRepository: new FirebaseScreenDefinitionRepository(),
    recordRepository:         new FirebaseRecordRepository(),
    lookupRepository:         new FirebaseLookupRepository(),
    lookupDefinitionRepository: new FirebaseLookupDefinitionRepository(),
    tagRepository:            new FirebaseTagRepository(),
    tagDefinitionRepository:  new FirebaseTagDefinitionRepository(),
    recordNoteRepository:     new FirebaseRecordNoteRepository(),
    recordDocumentRepository: new FirebaseRecordDocumentRepository(),
    recordFileRepository:     new FirebaseRecordFileRepository(),
    workflowDefinitionRepository: new FirebaseWorkflowDefinitionRepository(),
    workflowExecutionRepository: new FirebaseWorkflowExecutionRepository(),
    workflowTaskRepository:   new FirebaseWorkflowTaskRepository(),
    workflowWebhookRepository: new FirebaseWorkflowWebhookRepository(),
    workflowVersionRepository: new FirebaseWorkflowVersionRepository(),
    reportDraftRepository: new FirebaseReportDraftRepository(),
    workflowClockRepository:  new FirebaseWorkflowClockRepository(),
    scriptRepository:         new FirebaseScriptRepository(),
    dataProcessorRepository:  new FirebaseDataProcessorRepository(),
    actionRepository:         new FirebaseActionRepository(),
    reportRepository:         new FirebaseReportDefinitionRepository(),
    personalReportRepository: new FirebasePersonalReportRepository(),
    documentTemplateRepository: new FirebaseDocumentTemplateRepository(),
    downloadRepository:       new FirebaseDownloadRepository(),
    roleRepository:           new FirebaseRoleRepository(),
    agentGrantRepository:     new FirebaseAgentGrantRepository(),
    agentAuthRequestRepository: new FirebaseAgentAuthRequestRepository(),
    tenantExtensionRepository: new FirebaseTenantExtensionRepository(),
    installedExtensionRepository: new FirebaseInstalledExtensionRepository(),
    extensionMigrationRepository: new FirebaseExtensionMigrationRepository(),
    extensionHistoryRepository: new FirebaseExtensionHistoryRepository(),
    publicExtensionRepository: new FirebasePublicExtensionRepository(),
    extensionReputationRepository: new FirebaseExtensionReputationRepository(),
    backendResidueRepository: new FirebaseBackendResidueRepository(),
    appliedBackendRepository: new FirebaseAppliedBackendRepository(),
    installedCatalogSourceRepository: new FirebaseInstalledCatalogSourceRepository(),
    aggregateBackfillRepository: new FirebaseAggregateBackfillRepository(),
    recordSearchJobRepository: new FirebaseRecordSearchJobRepository(),
    recordKeyAdoptionRepository: new FirebaseRecordKeyAdoptionRepository(),
    recordImportRepository: new FirebaseRecordImportRepository(),
    portalRepository:         new FirebasePortalRepository(),
  }), [host]);

  return <DIContext.Provider value={container}>{children}</DIContext.Provider>;
};
