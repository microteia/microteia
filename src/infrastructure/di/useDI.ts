import { createContext, useContext } from 'react';
import type { IAuthRepository } from '../../domain/repositories/IAuthRepository';
import type { IUserRepository } from '../../domain/repositories/IUserRepository';
import type { IUserProfileRepository } from '../../domain/repositories/IUserProfileRepository';
import type { IAIConnectionRepository } from '../../domain/repositories/IAIConnectionRepository';
import type { IGmailConnectionRepository } from '../../domain/repositories/IGmailConnectionRepository';
import type { INewsRepository } from '../../domain/repositories/INewsRepository';
import type { INewsInteractionRepository } from '../../domain/repositories/INewsInteractionRepository';
import type { INewsTagRepository } from '../../domain/repositories/INewsTagRepository';
import type { INewsTagLinkRepository } from '../../domain/repositories/INewsTagLinkRepository';
import type { INewsCommentRepository } from '../../domain/repositories/INewsCommentRepository';
import type { INewsDocumentRepository } from '../../domain/repositories/INewsDocumentRepository';
import type { ISavedFilterRepository } from '../../domain/repositories/ISavedFilterRepository';
import type { ITenantRepository } from '../../domain/repositories/ITenantRepository';
import type { IPersonRepository } from '../../domain/repositories/IPersonRepository';
import type { ICaseRepository } from '../../domain/repositories/ICaseRepository';
import type { IDeadlineRepository } from '../../domain/repositories/IDeadlineRepository';
import type { IFinancialRepository } from '../../domain/repositories/IFinancialRepository';
import type { IFinancialDocumentRepository } from '../../domain/repositories/IFinancialDocumentRepository';
import type { ITextAnnotationRepository } from '../../domain/repositories/ITextAnnotationRepository';
import type { IPersonNoteRepository } from '../../domain/repositories/IPersonNoteRepository';
import type { IPersonDocumentRepository } from '../../domain/repositories/IPersonDocumentRepository';
import type { ICaseNoteRepository } from '../../domain/repositories/ICaseNoteRepository';
import type { ICaseDocumentRepository } from '../../domain/repositories/ICaseDocumentRepository';
import type { IContractRepository } from '../../domain/repositories/IContractRepository';
import type { IContractNoteRepository } from '../../domain/repositories/IContractNoteRepository';
import type { IContractDocumentRepository } from '../../domain/repositories/IContractDocumentRepository';
import type { IPushRepository, IPushInteractionRepository } from '../../domain/repositories/IPushRepository';
import type { IAuditLogRepository } from '../../domain/repositories/IAuditLogRepository';
import type { IAuditLogService } from '../../domain/repositories/IAuditLogService';
import type { IScreenDefinitionRepository } from '../../domain/repositories/IScreenDefinitionRepository';
import type {
  IRecordDocumentRepository,
  IRecordNoteRepository,
  IRecordRepository,
} from '../../domain/repositories/IRecordRepository';
import type { ILookupRepository } from '../../domain/repositories/ILookupRepository';
import type { ILookupDefinitionRepository } from '../../domain/repositories/ILookupDefinitionRepository';
import type { ITagRepository } from '../../domain/repositories/ITagRepository';
import type { ITagDefinitionRepository } from '../../domain/repositories/ITagDefinitionRepository';
import type { IWorkflowDefinitionRepository } from '../../domain/repositories/IWorkflowDefinitionRepository';
import type { IWorkflowExecutionRepository } from '../../domain/repositories/IWorkflowExecutionRepository';
import type { IScriptRepository } from '../../domain/repositories/IScriptRepository';
import type { IDataProcessorRepository } from '../../domain/repositories/IDataProcessorRepository';
import type { IActionRepository } from '../../domain/repositories/IActionRepository';
import type { IPluginInstallationRepository } from '../../domain/repositories/IPluginInstallationRepository';
import type { IPluginRegistryRepository } from '../../domain/repositories/IPluginRegistryRepository';
import type { ITenantExtensionRepository } from '../../domain/repositories/ITenantExtensionRepository';
import type { IInstalledExtensionRepository } from '../../domain/repositories/IInstalledExtensionRepository';
import type { IPublicExtensionRepository } from '../../domain/repositories/IPublicExtensionRepository';

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
  gmailConnectionRepository: IGmailConnectionRepository;
  newsRepository: INewsRepository;
  newsInteractionRepository: INewsInteractionRepository;
  newsTagRepository: INewsTagRepository;
  newsTagLinkRepository: INewsTagLinkRepository;
  newsCommentRepository: INewsCommentRepository;
  newsDocumentRepository: INewsDocumentRepository;
  savedFilterRepository: ISavedFilterRepository;
  tenantRepository: ITenantRepository;
  personRepository: IPersonRepository;
  personNoteRepository: IPersonNoteRepository;
  personDocumentRepository: IPersonDocumentRepository;
  caseRepository: ICaseRepository;
  caseNoteRepository: ICaseNoteRepository;
  caseDocumentRepository: ICaseDocumentRepository;
  contractRepository: IContractRepository;
  contractNoteRepository: IContractNoteRepository;
  contractDocumentRepository: IContractDocumentRepository;
  deadlineRepository: IDeadlineRepository;
  financialRepository: IFinancialRepository;
  financialDocumentRepository: IFinancialDocumentRepository;
  textAnnotationRepository: ITextAnnotationRepository;
  pushRepository: IPushRepository;
  pushInteractionRepository: IPushInteractionRepository;
  auditLogRepository: IAuditLogRepository;
  auditLogService: IAuditLogService;
  screenDefinitionRepository: IScreenDefinitionRepository;
  recordRepository: IRecordRepository;
  lookupRepository: ILookupRepository;
  lookupDefinitionRepository: ILookupDefinitionRepository;
  tagRepository: ITagRepository;
  tagDefinitionRepository: ITagDefinitionRepository;
  recordNoteRepository: IRecordNoteRepository;
  recordDocumentRepository: IRecordDocumentRepository;
  workflowDefinitionRepository: IWorkflowDefinitionRepository;
  workflowExecutionRepository: IWorkflowExecutionRepository;
  scriptRepository: IScriptRepository;
  dataProcessorRepository: IDataProcessorRepository;
  actionRepository: IActionRepository;
  pluginInstallationRepository: IPluginInstallationRepository;
  pluginRegistryRepository: IPluginRegistryRepository;
  tenantExtensionRepository: ITenantExtensionRepository;
  installedExtensionRepository: IInstalledExtensionRepository;
  publicExtensionRepository: IPublicExtensionRepository;
}

export const DIContext = createContext<DIContainer | null>(null);

export const useDI = (): DIContainer => {
  const ctx = useContext(DIContext);
  if (!ctx) throw new Error('useDI must be used within DIProvider');
  return ctx;
};
