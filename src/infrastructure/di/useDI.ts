import { createContext, useContext } from 'react';
import type { IAuthRepository } from '../../domain/repositories/IAuthRepository';
import type { IUserRepository } from '../../domain/repositories/IUserRepository';
import type { IUserProfileRepository } from '../../domain/repositories/IUserProfileRepository';
import type { IAIConnectionRepository } from '../../domain/repositories/IAIConnectionRepository';
import type { ISavedFilterRepository } from '../../domain/repositories/ISavedFilterRepository';
import type { ISettingsRepository } from '../../domain/repositories/ISettingsRepository';
import type { ITenantRepository } from '../../domain/repositories/ITenantRepository';
import type { ITextAnnotationRepository } from '../../domain/repositories/ITextAnnotationRepository';
import type { IAuditLogRepository } from '../../domain/repositories/IAuditLogRepository';
import type { IAuditArchiveRepository } from '../../domain/repositories/IAuditArchiveRepository';
import type { IMemberMfaRepository } from '../../domain/repositories/IMemberMfaRepository';
import type { IAuditLogService } from '../../domain/repositories/IAuditLogService';
import type {
  IDevicePushService,
  INotificationEmailService,
  INotificationInboxRepository,
  INotificationOptOutService,
  INotificationSmsService,
} from '../../domain/repositories/INotificationRepositories';
import type { IScreenDefinitionRepository } from '../../domain/repositories/IScreenDefinitionRepository';
import type {
  IRecordDocumentRepository,
  IRecordFileRepository,
  IRecordNoteRepository,
  IRecordRepository,
} from '../../domain/repositories/IRecordRepository';
import type { ILookupRepository } from '../../domain/repositories/ILookupRepository';
import type { ILookupDefinitionRepository } from '../../domain/repositories/ILookupDefinitionRepository';
import type { ITagRepository } from '../../domain/repositories/ITagRepository';
import type { ITagDefinitionRepository } from '../../domain/repositories/ITagDefinitionRepository';
import type { IWorkflowDefinitionRepository } from '../../domain/repositories/IWorkflowDefinitionRepository';
import type { IWorkflowExecutionRepository } from '../../domain/repositories/IWorkflowExecutionRepository';
import type { IWorkflowClockRepository } from '../../domain/repositories/IWorkflowClockRepository';
import type { IScriptRepository } from '../../domain/repositories/IScriptRepository';
import type { IDataProcessorRepository } from '../../domain/repositories/IDataProcessorRepository';
import type { IActionRepository } from '../../domain/repositories/IActionRepository';
import type { IReportDefinitionRepository } from '../../domain/repositories/IReportDefinitionRepository';
import type { IDocumentTemplateRepository } from '../../domain/repositories/IDocumentTemplateRepository';
import type { IDownloadRepository } from '../../domain/repositories/IDownloadRepository';
import type { IRoleRepository } from '../../domain/repositories/IRoleRepository';
import type { ITenantExtensionRepository } from '../../domain/repositories/ITenantExtensionRepository';
import type { IInstalledExtensionRepository } from '../../domain/repositories/IInstalledExtensionRepository';
import type { IExtensionMigrationRepository } from '../../domain/repositories/IExtensionMigrationRepository';
import type { IExtensionHistoryRepository } from '../../domain/repositories/IExtensionHistoryRepository';
import type { IPublicExtensionRepository } from '../../domain/repositories/IPublicExtensionRepository';
import type { IExtensionReputationRepository } from '../../domain/repositories/IExtensionReputationRepository';
import type { IAggregateBackfillRepository } from '../../domain/repositories/IAggregateBackfillRepository';
import type { IRecordSearchJobRepository } from '../../domain/repositories/IRecordSearchJobRepository';
import type { IRecordKeyAdoptionRepository } from '../../domain/repositories/IRecordKeyAdoptionRepository';
import type { IRecordImportRepository } from '../../domain/repositories/IRecordImportRepository';
import type { IBackendResidueRepository } from '../../domain/repositories/IBackendResidueRepository';
import type { IAgentAuthRequestRepository } from '../../domain/repositories/IAgentAuthRequestRepository';
import type { IAgentGrantRepository } from '../../domain/repositories/IAgentGrantRepository';
import type { IPortalRepository } from '../../domain/repositories/IPortalRepository';

export interface DIContainer {
  /**
   * Resolve um serviço trazido por um plugin (ponto `data.service`), por chave. É o ponto de
   * extensão do DI: o núcleo mantém seus repositórios tipados abaixo; plugins acrescentam serviços
   * próprios sem editar esta interface. Chave desconhecida → `undefined`.
   */
  resolveService: <T>(serviceKey: string) => T | undefined;
  authRepository: IAuthRepository;
  userRepository: IUserRepository;
  userProfileRepository: IUserProfileRepository;
  aiConnectionRepository: IAIConnectionRepository;
  savedFilterRepository: ISavedFilterRepository;
  settingsRepository: ISettingsRepository;
  tenantRepository: ITenantRepository;
  textAnnotationRepository: ITextAnnotationRepository;
  auditLogRepository: IAuditLogRepository;
  auditArchiveRepository: IAuditArchiveRepository;
  memberMfaRepository: IMemberMfaRepository;
  auditLogService: IAuditLogService;
  notificationInboxRepository: INotificationInboxRepository;
  devicePushService: IDevicePushService;
  notificationEmailService: INotificationEmailService;
  notificationSmsService: INotificationSmsService;
  notificationOptOutService: INotificationOptOutService;
  screenDefinitionRepository: IScreenDefinitionRepository;
  recordRepository: IRecordRepository;
  lookupRepository: ILookupRepository;
  lookupDefinitionRepository: ILookupDefinitionRepository;
  tagRepository: ITagRepository;
  tagDefinitionRepository: ITagDefinitionRepository;
  recordNoteRepository: IRecordNoteRepository;
  recordDocumentRepository: IRecordDocumentRepository;
  recordFileRepository: IRecordFileRepository;
  workflowDefinitionRepository: IWorkflowDefinitionRepository;
  workflowExecutionRepository: IWorkflowExecutionRepository;
  workflowClockRepository: IWorkflowClockRepository;
  scriptRepository: IScriptRepository;
  dataProcessorRepository: IDataProcessorRepository;
  actionRepository: IActionRepository;
  reportRepository: IReportDefinitionRepository;
  documentTemplateRepository: IDocumentTemplateRepository;
  downloadRepository: IDownloadRepository;
  roleRepository: IRoleRepository;
  agentGrantRepository: IAgentGrantRepository;
  agentAuthRequestRepository: IAgentAuthRequestRepository;
  tenantExtensionRepository: ITenantExtensionRepository;
  installedExtensionRepository: IInstalledExtensionRepository;
  extensionMigrationRepository: IExtensionMigrationRepository;
  extensionHistoryRepository: IExtensionHistoryRepository;
  publicExtensionRepository: IPublicExtensionRepository;
  extensionReputationRepository: IExtensionReputationRepository;
  backendResidueRepository: IBackendResidueRepository;
  aggregateBackfillRepository: IAggregateBackfillRepository;
  recordSearchJobRepository: IRecordSearchJobRepository;
  recordKeyAdoptionRepository: IRecordKeyAdoptionRepository;
  recordImportRepository: IRecordImportRepository;
  portalRepository: IPortalRepository;
}

export const DIContext = createContext<DIContainer | null>(null);

export const useDI = (): DIContainer => {
  const ctx = useContext(DIContext);
  if (!ctx) throw new Error('useDI must be used within DIProvider');
  return ctx;
};
