import { getDb } from '../firebase/initFirebase';
import { FirebaseAuditLogRepository } from '../../data/repositories/FirebaseAuditLogRepository';
import { FirebaseExtensionStatsRepository } from '../../data/repositories/FirebaseExtensionStatsRepository';
import {
  makeRecountExtensionInstallsUseCase,
  makeRecountExtensionRatingsUseCase,
} from '../../domain/usecases/RecountExtensionStatsUseCase';
import type {
  RecountExtensionInstallsUseCase,
  RecountExtensionRatingsUseCase,
} from '../../domain/usecases/RecountExtensionStatsUseCase';
import type { IExtensionStatsRepository } from '../../domain/repositories/IExtensionStatsRepository';
import { UserProfileLookupService } from '../../data/services/UserProfileLookupService';
import { FkNameEnricherService } from '../../data/services/FkNameEnricherService';
import { PermissionCatalogCache } from '../../data/services/PermissionCatalogCache';
import { InstalledExtensionCache } from '../../data/services/InstalledExtensionCache';
import { BusinessCalendarLoader } from '../../data/services/BusinessCalendarLoader';
import { makeMaterializeMemberPermissionsUseCase } from '../../domain/usecases/MaterializeMemberPermissionsUseCase';
import type { MaterializeMemberPermissionsUseCase } from '../../domain/usecases/MaterializeMemberPermissionsUseCase';
import { makeCreateAuditLogUseCase } from '../../domain/usecases/CreateAuditLogUseCase';
import type { CreateAuditLogUseCase } from '../../domain/usecases/CreateAuditLogUseCase';
import { makeLogClientErrorUseCase } from '../../domain/usecases/LogClientErrorUseCase';
import type { LogClientErrorUseCase } from '../../domain/usecases/LogClientErrorUseCase';
import type { IAuditLogRepository } from '../../domain/repositories/IAuditLogRepository';
import type { IUserProfileLookupService } from '../../domain/repositories/IUserProfileLookupService';
import type { IFkNameEnricherService } from '../../domain/repositories/IFkNameEnricherService';
import { FirebaseAIConnectionRepository } from '../../data/repositories/FirebaseAIConnectionRepository';
import { FirebaseTenantMemberRepository } from '../../data/repositories/FirebaseTenantMemberRepository';
import { FirebaseAgentGrantRepository } from '../../data/repositories/FirebaseAgentGrantRepository';
import { FirebaseAgentAuthRequestRepository } from '../../data/repositories/FirebaseAgentAuthRequestRepository';
import { FirebaseUserRepository } from '../../data/repositories/FirebaseUserRepository';
import { FirebaseNicknameRepository } from '../../data/repositories/FirebaseNicknameRepository';
import { FirebaseTenantRepository } from '../../data/repositories/FirebaseTenantRepository';
import { FirebaseTenantSettingsRepository } from '../../data/repositories/FirebaseTenantSettingsRepository';
import { makeGetDefaultAICredentialsUseCase } from '../../domain/usecases/GetDefaultAICredentialsUseCase';
import { makeCallAIAnalysisUseCase } from '../../domain/usecases/CallAIAnalysisUseCase';
import { makeCallAIUseCase } from '../../domain/usecases/CallAIUseCase';
import { makeGetUserInfoUseCase } from '../../domain/usecases/GetUserInfoUseCase';
import { makeCheckNicknameAvailabilityUseCase } from '../../domain/usecases/CheckNicknameAvailabilityUseCase';
import { makeClaimNicknameUseCase } from '../../domain/usecases/ClaimNicknameUseCase';
import { makeAddTenantMemberUseCase } from '../../domain/usecases/AddTenantMemberUseCase';
import { makeRemoveTenantMemberUseCase } from '../../domain/usecases/RemoveTenantMemberUseCase';
import { makeBootstrapUserUseCase } from '../../domain/usecases/BootstrapUserUseCase';
import type { GetDefaultAICredentialsUseCase } from '../../domain/usecases/GetDefaultAICredentialsUseCase';
import type { CallAIAnalysisUseCase } from '../../domain/usecases/CallAIAnalysisUseCase';
import type { CallAIUseCase } from '../../domain/usecases/CallAIUseCase';
import type { GetUserInfoUseCase } from '../../domain/usecases/GetUserInfoUseCase';
import type { CheckNicknameAvailabilityUseCase } from '../../domain/usecases/CheckNicknameAvailabilityUseCase';
import type { ClaimNicknameUseCase } from '../../domain/usecases/ClaimNicknameUseCase';
import type { AddTenantMemberUseCase } from '../../domain/usecases/AddTenantMemberUseCase';
import type { RemoveTenantMemberUseCase } from '../../domain/usecases/RemoveTenantMemberUseCase';
import type { BootstrapUserUseCase } from '../../domain/usecases/BootstrapUserUseCase';
import type { IAIProviderService } from '../../domain/repositories/IAIProviderService';
import type { IAIConnectionRepository } from '../../domain/repositories/IAIConnectionRepository';
import type { ITenantRepository } from '../../domain/repositories/ITenantRepository';
import type { ITenantSettingsRepository } from '../../domain/repositories/ITenantSettingsRepository';
import type { ITenantMemberRepository } from '../../domain/repositories/ITenantMemberRepository';
import type { IAgentGrantRepository } from '../../domain/repositories/IAgentGrantRepository';
import type { IAgentAuthRequestRepository } from '../../domain/repositories/IAgentAuthRequestRepository';
import type { IUserRepository } from '../../domain/repositories/IUserRepository';
import { FirebaseWorkflowDefinitionRepository } from '../../data/repositories/FirebaseWorkflowDefinitionRepository';
import { FirebaseWorkflowClockRepository } from '../../data/repositories/FirebaseWorkflowClockRepository';
import type { WorkflowClockDeps } from '../../domain/services/workflowClock';
import { dateReachedOnSave } from '../../domain/services/workflowClock';
import { resumeWorkflowExecution } from '../../domain/services/workflowSuspension';
import { entityDateFieldKeys, eventEntity } from '../../domain/schema/eventCatalog';
import { dateReachedEventName } from '../../domain/schema/workflowClock';
import { FirebaseWorkflowExecutionRepository } from '../../data/repositories/FirebaseWorkflowExecutionRepository';
import type { IWorkflowDefinitionRepository } from '../../domain/repositories/IWorkflowDefinitionRepository';
import type { IWorkflowExecutionRepository } from '../../domain/repositories/IWorkflowExecutionRepository';
import { makeRunWorkflowsForEventUseCase } from '../../domain/usecases/RunWorkflowsForEventUseCase';
import type { RunWorkflowsForEventUseCase } from '../../domain/usecases/RunWorkflowsForEventUseCase';
import { makeRunCalledWorkflowUseCase } from '../../domain/usecases/RunCalledWorkflowUseCase';
import type { RunCalledWorkflowUseCase } from '../../domain/usecases/RunCalledWorkflowUseCase';
import type { WorkflowServices } from '../../domain/entities/WorkflowContext';
import { stepRegistry } from '../../domain/engine/StepRegistry';
import { capabilityProvidersOf, registerStepsFromPlugins } from '../workflow/loadWorkflowPlugins';
import { WorkflowContextHydrator } from '../../domain/engine/WorkflowContextHydrator';
import { FirestoreWorkflowRecordFetcher } from '../../data/services/FirestoreWorkflowRecordFetcher';
import { FirestoreWorkflowQueryRepository } from '../../data/services/FirestoreWorkflowQueryRepository';
import { FirestoreWorkflowMutationRepository } from '../../data/services/FirestoreWorkflowMutationRepository';
import { FirebaseScriptRepository } from '../../data/repositories/FirebaseScriptRepository';
import { ScreenDefinitionCache } from '../../data/services/ScreenDefinitionCache';
import type { AggregateRecomputeDeps } from '../../domain/services/recomputeAggregates';
import type { AggregateBackfillDeps } from '../../domain/services/aggregateBackfill';
import { FirebaseAggregateBackfillRepository } from '../../data/repositories/FirebaseAggregateBackfillRepository';
import type { SchemaContext } from '../../domain/schema/pathResolver';
import { AGGREGATE_ENGINE_ACTOR } from '../../domain/schema/aggregateBackfill';
import type { RecordKeyAdoptionDeps } from '../../domain/services/recordKeyAdoption';
import { FirebaseRecordKeyAdoptionRepository } from '../../data/repositories/FirebaseRecordKeyAdoptionRepository';
import { tenantTimeZone } from '../settings/tenantTimeZone';
import {
  FirestoreNotificationDirectory,
  FirestoreNotificationEmailConfigRepository,
  FirestoreNotificationInboxRepository,
} from '../../data/repositories/FirestoreNotificationRepositories';
import { SmtpEmailTransport, StandardWebPushSender, VapidKeyStore } from '../../data/services/NotificationTransports';
import type { INotificationEmailConfigRepository } from '../../domain/repositories/INotificationDelivery';
import { makeDispatchNotificationUseCase } from '../../domain/usecases/DispatchNotificationUseCase';
import type { DispatchNotificationUseCase } from '../../domain/usecases/DispatchNotificationUseCase';
import { makeNotificationTextCatalog } from '../notifications/notificationTextCatalog';
import type { IRecordDocumentWriter } from '../../domain/repositories/IRecordDocumentWriter';
import { FirebaseRecordDocumentWriter } from '../../data/services/FirebaseRecordDocumentWriter';
import { FirestoreDocumentTemplateSource } from '../../data/services/FirestoreDocumentTemplateSource';
import { TemplateDocumentRenderer } from '../../data/services/document/TemplateDocumentRenderer';
import { WorkflowDocumentRecordReader } from '../document/WorkflowDocumentRecordReader';
import { makeRenderDocumentUseCase } from '../../domain/usecases/RenderDocumentUseCase';
import type { RenderDocumentUseCase } from '../../domain/usecases/RenderDocumentUseCase';
import { preferredLocale } from '../../domain/services/tenantSettings';

class DIContainer {
  private static instance: DIContainer;

  private aiProviders: IAIProviderService[];
  private aiConnectionRepo?: IAIConnectionRepository;
  private permissionCatalogCache?: PermissionCatalogCache;
  private materializeMemberPermissionsUC?: MaterializeMemberPermissionsUseCase;
  private tenantRepo?: ITenantRepository;
  private tenantSettingsRepo?: ITenantSettingsRepository;
  private auditLogRepo?: IAuditLogRepository;
  private userProfileLookupService?: IUserProfileLookupService;
  private fkNameEnricherService?: IFkNameEnricherService;
  private createAuditLogUC?: CreateAuditLogUseCase;
  private logClientErrorUC?: LogClientErrorUseCase;
  private getDefaultAICredentialsUC?: GetDefaultAICredentialsUseCase;
  private callAIAnalysisUC?: CallAIAnalysisUseCase;
  private callAIUC?: CallAIUseCase;
  private getUserInfoUC?: GetUserInfoUseCase;
  private checkNicknameAvailabilityUC?: CheckNicknameAvailabilityUseCase;
  private claimNicknameUC?: ClaimNicknameUseCase;
  private tenantMemberRepo?: ITenantMemberRepository;
  private agentGrantRepo?: IAgentGrantRepository;

  private agentAuthRequestRepo?: IAgentAuthRequestRepository;
  private installedExtensionCache?: InstalledExtensionCache;
  private businessCalendarLoader?: BusinessCalendarLoader;
  private addTenantMemberUC?: AddTenantMemberUseCase;
  private removeTenantMemberUC?: RemoveTenantMemberUseCase;
  private userRepo?: IUserRepository;
  private bootstrapUserUC?: BootstrapUserUseCase;
  private workflowDefinitionRepo?: IWorkflowDefinitionRepository;
  private workflowExecutionRepo?: IWorkflowExecutionRepository;
  private runWorkflowsForEventUC?: RunWorkflowsForEventUseCase;
  private runCalledWorkflowUC?: RunCalledWorkflowUseCase;
  private screenDefinitionCache?: ScreenDefinitionCache;
  private aggregateRecomputeDeps?: AggregateRecomputeDeps;
  private aggregateBackfillDeps?: AggregateBackfillDeps;
  private recordKeyAdoptionDeps?: RecordKeyAdoptionDeps;
  private workflowClockDeps?: WorkflowClockDeps;
  private workflowContextHydrator?: WorkflowContextHydrator;
  private notificationEmailConfigRepo?: INotificationEmailConfigRepository;
  private vapidKeyStore?: VapidKeyStore;
  private dispatchNotificationUC?: DispatchNotificationUseCase;
  private recordDocumentWriter?: IRecordDocumentWriter;
  private renderDocumentUC?: RenderDocumentUseCase;
  private workflowStepsRegistered = false;
  private extensionStatsRepo?: IExtensionStatsRepository;
  private recountExtensionInstallsUC?: RecountExtensionInstallsUseCase;
  private recountExtensionRatingsUC?: RecountExtensionRatingsUseCase;

  private constructor() {
    this.aiProviders = capabilityProvidersOf<IAIProviderService>('ai.completion');
  }

  static getInstance(): DIContainer {
    if (!DIContainer.instance) {
      DIContainer.instance = new DIContainer();
    }
    return DIContainer.instance;
  }

  getDefaultAICredentialsUseCase(): GetDefaultAICredentialsUseCase {
    if (!this.getDefaultAICredentialsUC) {
      const db = getDb();
      const aiConnectionRepo = new FirebaseAIConnectionRepository(db);
      const tenantMemberRepo = new FirebaseTenantMemberRepository(db);
      this.getDefaultAICredentialsUC = makeGetDefaultAICredentialsUseCase(aiConnectionRepo, tenantMemberRepo);
    }
    return this.getDefaultAICredentialsUC;
  }

  getCallAIAnalysisUseCase(): CallAIAnalysisUseCase {
    if (!this.callAIAnalysisUC) {
      this.callAIAnalysisUC = makeCallAIAnalysisUseCase(this.aiProviders);
    }
    return this.callAIAnalysisUC;
  }

  getCallAIUseCase(): CallAIUseCase {
    if (!this.callAIUC) {
      this.callAIUC = makeCallAIUseCase(this.aiProviders);
    }
    return this.callAIUC;
  }

  getUserRepository(): IUserRepository {
    if (!this.userRepo) {
      this.userRepo = new FirebaseUserRepository(getDb());
    }
    return this.userRepo;
  }

  getUserInfoUseCase(): GetUserInfoUseCase {
    if (!this.getUserInfoUC) {
      this.getUserInfoUC = makeGetUserInfoUseCase(this.getUserRepository());
    }
    return this.getUserInfoUC;
  }

  getBootstrapUserUseCase(): BootstrapUserUseCase {
    if (!this.bootstrapUserUC) {
      this.bootstrapUserUC = makeBootstrapUserUseCase(this.getUserRepository(), this.getTenantRepository());
    }
    return this.bootstrapUserUC;
  }

  getCheckNicknameAvailabilityUseCase(): CheckNicknameAvailabilityUseCase {
    if (!this.checkNicknameAvailabilityUC) {
      const db = getDb();
      const nicknameRepo = new FirebaseNicknameRepository(db);
      this.checkNicknameAvailabilityUC = makeCheckNicknameAvailabilityUseCase(nicknameRepo);
    }
    return this.checkNicknameAvailabilityUC;
  }

  getClaimNicknameUseCase(): ClaimNicknameUseCase {
    if (!this.claimNicknameUC) {
      const db = getDb();
      const nicknameRepo = new FirebaseNicknameRepository(db);
      this.claimNicknameUC = makeClaimNicknameUseCase(nicknameRepo);
    }
    return this.claimNicknameUC;
  }

  getAIConnectionRepository(): IAIConnectionRepository {
    if (!this.aiConnectionRepo) {
      const db = getDb();
      this.aiConnectionRepo = new FirebaseAIConnectionRepository(db);
    }
    return this.aiConnectionRepo;
  }

  getExtensionStatsRepository(): IExtensionStatsRepository {
    if (!this.extensionStatsRepo) {
      this.extensionStatsRepo = new FirebaseExtensionStatsRepository(getDb());
    }
    return this.extensionStatsRepo;
  }

  getRecountExtensionInstallsUseCase(): RecountExtensionInstallsUseCase {
    if (!this.recountExtensionInstallsUC) {
      this.recountExtensionInstallsUC = makeRecountExtensionInstallsUseCase(this.getExtensionStatsRepository());
    }
    return this.recountExtensionInstallsUC;
  }

  getRecountExtensionRatingsUseCase(): RecountExtensionRatingsUseCase {
    if (!this.recountExtensionRatingsUC) {
      this.recountExtensionRatingsUC = makeRecountExtensionRatingsUseCase(this.getExtensionStatsRepository());
    }
    return this.recountExtensionRatingsUC;
  }

  getTenantRepository(): ITenantRepository {
    if (!this.tenantRepo) {
      this.tenantRepo = new FirebaseTenantRepository();
    }
    return this.tenantRepo;
  }

  getTenantSettingsRepository(): ITenantSettingsRepository {
    if (!this.tenantSettingsRepo) {
      this.tenantSettingsRepo = new FirebaseTenantSettingsRepository();
    }
    return this.tenantSettingsRepo;
  }

  getTenantMemberRepository(): ITenantMemberRepository {
    if (!this.tenantMemberRepo) {
      this.tenantMemberRepo = new FirebaseTenantMemberRepository(getDb());
    }
    return this.tenantMemberRepo;
  }

  getInstalledExtensionCache(): InstalledExtensionCache {
    if (!this.installedExtensionCache) {
      this.installedExtensionCache = new InstalledExtensionCache(getDb());
    }
    return this.installedExtensionCache;
  }

  getBusinessCalendarLoader(): BusinessCalendarLoader {
    if (!this.businessCalendarLoader) {
      this.businessCalendarLoader = new BusinessCalendarLoader(getDb(), (tenantId) =>
        this.getInstalledExtensionCache().businessCalendarCollections(tenantId),
      );
    }
    return this.businessCalendarLoader;
  }

  getAgentGrantRepository(): IAgentGrantRepository {
    if (!this.agentGrantRepo) {
      this.agentGrantRepo = new FirebaseAgentGrantRepository(getDb());
    }
    return this.agentGrantRepo;
  }

  getAgentAuthRequestRepository(): IAgentAuthRequestRepository {
    if (!this.agentAuthRequestRepo) {
      this.agentAuthRequestRepo = new FirebaseAgentAuthRequestRepository(getDb());
    }
    return this.agentAuthRequestRepo;
  }

  getAddTenantMemberUseCase(): AddTenantMemberUseCase {
    if (!this.addTenantMemberUC) {
      this.addTenantMemberUC = makeAddTenantMemberUseCase(
        this.getTenantRepository(),
        this.getTenantMemberRepository(),
        this.getUserRepository(),
      );
    }
    return this.addTenantMemberUC;
  }

  getRemoveTenantMemberUseCase(): RemoveTenantMemberUseCase {
    if (!this.removeTenantMemberUC) {
      this.removeTenantMemberUC = makeRemoveTenantMemberUseCase(
        this.getTenantRepository(),
        this.getTenantMemberRepository(),
        this.getUserRepository(),
      );
    }
    return this.removeTenantMemberUC;
  }

  getAuditLogRepository(): IAuditLogRepository {
    if (!this.auditLogRepo) {
      this.auditLogRepo = new FirebaseAuditLogRepository(getDb());
    }
    return this.auditLogRepo;
  }

  getUserProfileLookupService(): IUserProfileLookupService {
    if (!this.userProfileLookupService) {
      this.userProfileLookupService = new UserProfileLookupService(getDb());
    }
    return this.userProfileLookupService;
  }

  getFkNameEnricherService(): IFkNameEnricherService {
    if (!this.fkNameEnricherService) {
      this.fkNameEnricherService = new FkNameEnricherService(getDb(), this.getScreenDefinitionCache());
    }
    return this.fkNameEnricherService;
  }

  getCreateAuditLogUseCase(): CreateAuditLogUseCase {
    if (!this.createAuditLogUC) {
      this.createAuditLogUC = makeCreateAuditLogUseCase(this.getAuditLogRepository());
    }
    return this.createAuditLogUC;
  }

  getLogClientErrorUseCase(): LogClientErrorUseCase {
    if (!this.logClientErrorUC) {
      this.logClientErrorUC = makeLogClientErrorUseCase(
        this.getTenantMemberRepository(),
        this.getUserProfileLookupService(),
        this.getCreateAuditLogUseCase(),
      );
    }
    return this.logClientErrorUC;
  }

  getWorkflowDefinitionRepository(): IWorkflowDefinitionRepository {
    if (!this.workflowDefinitionRepo) {
      this.workflowDefinitionRepo = new FirebaseWorkflowDefinitionRepository(getDb());
    }
    return this.workflowDefinitionRepo;
  }

  getWorkflowExecutionRepository(): IWorkflowExecutionRepository {
    if (!this.workflowExecutionRepo) {
      this.workflowExecutionRepo = new FirebaseWorkflowExecutionRepository(getDb());
    }
    return this.workflowExecutionRepo;
  }

  getWorkflowServices(): WorkflowServices {
    return {
      logger: {
        info: (message) => console.log(`[workflow] ${message}`),
        warn: (message) => console.warn(`[workflow] ${message}`),
        error: (message) => console.error(`[workflow] ${message}`),
      },
      now: () => new Date(),
      timeZoneOf: tenantTimeZone,
      businessCalendarsOf: (tenantId) => this.getBusinessCalendarLoader().load(tenantId),
    };
  }

  getPermissionCatalogCache(): PermissionCatalogCache {
    if (!this.permissionCatalogCache) {
      this.permissionCatalogCache = new PermissionCatalogCache(getDb());
    }
    return this.permissionCatalogCache;
  }

  getMaterializeMemberPermissionsUseCase(): MaterializeMemberPermissionsUseCase {
    if (!this.materializeMemberPermissionsUC) {
      this.materializeMemberPermissionsUC = makeMaterializeMemberPermissionsUseCase(
        getDb(),
        this.getPermissionCatalogCache(),
      );
    }
    return this.materializeMemberPermissionsUC;
  }

  getScreenDefinitionCache(): ScreenDefinitionCache {
    if (!this.screenDefinitionCache) {
      this.screenDefinitionCache = new ScreenDefinitionCache(getDb());
    }
    return this.screenDefinitionCache;
  }

  getAggregateRecomputeDeps(): AggregateRecomputeDeps {
    if (!this.aggregateRecomputeDeps) {
      this.aggregateRecomputeDeps = {
        screenProvider: this.getScreenDefinitionCache(),
        queryRepository: new FirestoreWorkflowQueryRepository(getDb()),
        mutationRepository: new FirestoreWorkflowMutationRepository(getDb()),
        logger: { warn: (message: string) => console.warn(`[aggregate] ${message}`) },
        timeZoneOf: (tenantId: string) => tenantTimeZone(tenantId),
        businessCalendarsOf: (tenantId: string) => this.getBusinessCalendarLoader().load(tenantId),
      };
    }
    return this.aggregateRecomputeDeps;
  }

  /** A declaração relida do banco: o recálculo não pode agir sobre a tela de antes do cache vencer. */
  getFreshSchemaContext(tenantId: string): Promise<SchemaContext> {
    const cache = this.getScreenDefinitionCache();
    cache.invalidate(tenantId);
    return cache.getSchemaContext(tenantId);
  }

  getWorkflowClockDeps(): WorkflowClockDeps {
    if (!this.workflowClockDeps) {
      const repository = new FirebaseWorkflowClockRepository(getDb());
      this.workflowClockDeps = {
        repository,
        officeTimeZone: (tenantId) => tenantTimeZone(tenantId),
        deactivatedPluginIds: (tenantId) => this.getInstalledExtensionCache().deactivatedPluginIds(tenantId),
        resolveDateField: async (tenantId, prefix, field) => {
          const ctx = await this.getScreenDefinitionCache().getSchemaContext(tenantId);
          const entity = eventEntity(dateReachedEventName(prefix), ctx);
          return entity && entityDateFieldKeys(entity).includes(field) ? { collection: entity.collection } : null;
        },
        now: () => new Date(),
        logger: console,
        resume: async (entry) => {
          await this.ensureWorkflowStepsRegistered();
          return resumeWorkflowExecution(entry, {
            executionRepository: this.getWorkflowExecutionRepository(),
            clockRepository: repository,
            definitionRepository: this.getWorkflowDefinitionRepository(),
            registry: stepRegistry,
            services: this.getWorkflowServices(),
            hydrator: this.getWorkflowContextHydrator(),
            deactivatedPluginIds: (tenantId) => this.getInstalledExtensionCache().deactivatedPluginIds(tenantId),
            now: () => new Date(),
          });
        },
      };
    }
    return this.workflowClockDeps;
  }

  getAggregateBackfillDeps(): AggregateBackfillDeps {
    if (!this.aggregateBackfillDeps) {
      this.aggregateBackfillDeps = {
        ...this.getAggregateRecomputeDeps(),
        backfillRepository: new FirebaseAggregateBackfillRepository(getDb()),
        freshSchemaContext: (tenantId: string) => this.getFreshSchemaContext(tenantId),
        now: () => Date.now(),
        recordPassFinished: async (tenantId, table, state) => {
          // A passada que não mudou nenhum registro não tem o que registrar — é o caso comum da
          // primeira conferência depois de uma atualização, sobre telas que já estavam certas.
          if (state.written === 0 && state.failed === 0 && state.truncated === 0) return;
          try {
            await this.getCreateAuditLogUseCase().execute({
              tenantId,
              title: '@core.admin/audit.aggregate-backfill.title',
              userId: 'system',
              userName: AGGREGATE_ENGINE_ACTOR,
              photoURL: '',
              action: 'SYSTEM',
              severity: state.failed > 0 ? 'HIGH' : 'LOW',
              type: 'AUDIT',
              entity: table,
              entityId: table,
              text: '@core.admin/audit.aggregate-backfill.text',
              textParams: {
                screen: table,
                processed: String(state.processed),
                written: String(state.written),
                failed: String(state.failed),
                truncated: String(state.truncated),
              },
            });
          } catch (error) {
            console.error(`[aggregate-backfill] Falha ao registrar a auditoria de ${tenantId}/${table}:`, error);
          }
        },
      };
    }
    return this.aggregateBackfillDeps;
  }

  getRecordKeyAdoptionDeps(): RecordKeyAdoptionDeps {
    if (!this.recordKeyAdoptionDeps) {
      this.recordKeyAdoptionDeps = {
        adoptionRepository: new FirebaseRecordKeyAdoptionRepository(getDb()),
        freshSchemaContext: (tenantId: string) => this.getFreshSchemaContext(tenantId),
        now: () => Date.now(),
        logger: { warn: (message: string) => console.warn(`[record-key-adoption] ${message}`) },
        recordPassFinished: async (tenantId, collection, state) => {
          const adopting = Object.keys(state.pending);
          // A passada que só confirmou o que já estava reservado não tem o que registrar — é o caso
          // da primeira conferência depois de uma atualização, sobre chaves que já valiam.
          if (adopting.length === 0 && state.reserved === 0) return;
          const keys = (adopting.length > 0 ? adopting : Object.keys(state.adopted)).join(', ');
          try {
            await this.getCreateAuditLogUseCase().execute({
              tenantId,
              title: '@core.admin/audit.record-key-adoption.title',
              userId: 'system',
              userName: 'record-key-adoption',
              photoURL: '',
              action: 'SYSTEM',
              severity: adopting.length > 0 ? 'HIGH' : 'LOW',
              type: 'AUDIT',
              entity: collection,
              entityId: collection,
              text: adopting.length > 0
                ? '@core.admin/audit.record-key-adoption.pending.text'
                : '@core.admin/audit.record-key-adoption.active.text',
              textParams: {
                screen: collection,
                keys,
                processed: String(state.processed),
                reserved: String(state.reserved),
                issues: String(state.issueCount),
                failed: String(state.failed),
              },
            });
          } catch (error) {
            console.error(`[record-key-adoption] Falha ao registrar a auditoria de ${tenantId}/${collection}:`, error);
          }
        },
      };
    }
    return this.recordKeyAdoptionDeps;
  }

  getNotificationEmailConfigRepository(): INotificationEmailConfigRepository {
    if (!this.notificationEmailConfigRepo) {
      this.notificationEmailConfigRepo = new FirestoreNotificationEmailConfigRepository(getDb());
    }
    return this.notificationEmailConfigRepo;
  }

  getVapidKeyStore(): VapidKeyStore {
    if (!this.vapidKeyStore) this.vapidKeyStore = new VapidKeyStore(getDb());
    return this.vapidKeyStore;
  }

  getDispatchNotificationUseCase(): DispatchNotificationUseCase {
    if (!this.dispatchNotificationUC) {
      this.dispatchNotificationUC = makeDispatchNotificationUseCase({
        createAuditLog: this.getCreateAuditLogUseCase(),
        directory: new FirestoreNotificationDirectory(getDb()),
        inbox: new FirestoreNotificationInboxRepository(getDb()),
        emailConfig: this.getNotificationEmailConfigRepository(),
        emailTransport: new SmtpEmailTransport(),
        push: new StandardWebPushSender(getDb(), this.getVapidKeyStore(), webPushSubject),
        catalog: makeNotificationTextCatalog(this.getInstalledExtensionCache()),
        tenantName: async (tenantId) => (await this.getTenantRepository().getById(tenantId))?.name ?? '',
        now: () => new Date(),
      });
    }
    return this.dispatchNotificationUC;
  }

  getRecordDocumentWriter(): IRecordDocumentWriter {
    if (!this.recordDocumentWriter) this.recordDocumentWriter = new FirebaseRecordDocumentWriter();
    return this.recordDocumentWriter;
  }

  getRenderDocumentUseCase(): RenderDocumentUseCase {
    if (!this.renderDocumentUC) {
      this.renderDocumentUC = makeRenderDocumentUseCase({
        templates: new FirestoreDocumentTemplateSource(
          getDb(),
          this.getInstalledExtensionCache(),
          this.getScreenDefinitionCache(),
        ),
        screens: this.getScreenDefinitionCache(),
        records: new WorkflowDocumentRecordReader(
          new FirestoreWorkflowRecordFetcher(getDb()),
          this.getScreenDefinitionCache(),
          new FirestoreWorkflowQueryRepository(getDb()),
        ),
        renderer: new TemplateDocumentRenderer(),
        writer: this.getRecordDocumentWriter(),
        // O documento é do ESCRITÓRIO: o idioma é o dele, não o de quem apertou o botão.
        localeOf: async (tenantId) => preferredLocale({}, await this.getTenantSettingsRepository().getTenantValues(tenantId)),
        timeZoneOf: (tenantId) => tenantTimeZone(tenantId),
        businessCalendarsOf: (tenantId) => this.getBusinessCalendarLoader().load(tenantId),
      });
    }
    return this.renderDocumentUC;
  }

  getWorkflowContextHydrator(): WorkflowContextHydrator {
    if (!this.workflowContextHydrator) {
      this.workflowContextHydrator = new WorkflowContextHydrator(
        new FirestoreWorkflowRecordFetcher(getDb()),
        this.getScreenDefinitionCache(),
      );
    }
    return this.workflowContextHydrator;
  }

  getRunWorkflowsForEventUseCase(): RunWorkflowsForEventUseCase {
    if (!this.runWorkflowsForEventUC) {
      this.runWorkflowsForEventUC = makeRunWorkflowsForEventUseCase(
        this.getWorkflowDefinitionRepository(),
        this.getWorkflowExecutionRepository(),
        stepRegistry,
        this.getWorkflowServices(),
        this.getWorkflowContextHydrator(),
        {
          deactivatedPluginIds: (tenantId) => this.getInstalledExtensionCache().deactivatedPluginIds(tenantId),
          onDateReachedSave: (event, definitions) => dateReachedOnSave(event, definitions, this.getWorkflowClockDeps()),
          clockRepository: this.getWorkflowClockDeps().repository,
        },
      );
    }
    return this.runWorkflowsForEventUC;
  }

  getRunCalledWorkflowUseCase(): RunCalledWorkflowUseCase {
    if (!this.runCalledWorkflowUC) {
      this.runCalledWorkflowUC = makeRunCalledWorkflowUseCase(
        this.getWorkflowDefinitionRepository(),
        this.getWorkflowExecutionRepository(),
        stepRegistry,
        this.getWorkflowServices(),
        this.getWorkflowContextHydrator(),
      );
    }
    return this.runCalledWorkflowUC;
  }

  /**
   * Composition root do Workflow Engine: registra os Steps concretos no StepRegistry.
   * Idempotente e chamado uma única vez por instância da function (guardado por
   * `workflowStepsRegistered`), tipicamente no cold start.
   * O catálogo é servido diretamente via getWorkflowStepCatalog cloud function.
   */
  async ensureWorkflowStepsRegistered(): Promise<void> {
    if (this.workflowStepsRegistered) return;
    registerStepsFromPlugins({
      createAuditLogUseCase: this.getCreateAuditLogUseCase(),
      dispatchNotificationUseCase: this.getDispatchNotificationUseCase(),
      renderDocumentUseCase: this.getRenderDocumentUseCase(),
      workflowQueryRepository: new FirestoreWorkflowQueryRepository(getDb()),
      workflowRecordFetcher: new FirestoreWorkflowRecordFetcher(getDb()),
      workflowMutationRepository: new FirestoreWorkflowMutationRepository(getDb()),
      screenDefinitionProvider: this.getScreenDefinitionCache(),
      scriptRepository: new FirebaseScriptRepository(getDb()),
      runCalledWorkflowUseCase: this.getRunCalledWorkflowUseCase(),
      workflowDefinitionRepository: this.getWorkflowDefinitionRepository(),
      aiConnectionRepository: this.getAIConnectionRepository(),
      callAIUseCase: this.getCallAIUseCase(),
    });
    this.workflowStepsRegistered = true;
  }
}

/**
 * O contato que o padrão VAPID pede ao serviço de push. É o endereço do próprio projeto — o Firebase o
 * expõe a toda function —, e não um domínio nosso: a instalação é do escritório.
 */
const webPushSubject = (): string => {
  const projectId = process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT ?? '';
  return projectId ? `https://${projectId}.web.app` : 'mailto:postmaster@localhost';
};

export const getDI = (): DIContainer => DIContainer.getInstance();
