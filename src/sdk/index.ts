/**
 * `@microteia/sdk` — a superfície de autoria de extensões, tal como ela sai desta casa.
 *
 * Este arquivo NÃO é um `export *`: cada linha aqui é uma decisão de que aquele símbolo pode ser
 * escrito por alguém de fora e, a partir daí, tem de continuar valendo. O que não está listado é
 * interno, ainda que more no mesmo diretório — é a diferença entre publicar um contrato e publicar
 * uma árvore de módulos.
 *
 * Duas travas guardam o que está escrito acima: `sdkPurity.test.ts` prova que o fechamento daqui só
 * alcança `domain/` (nada de React, Firebase, stores ou apresentação), e `sdkSurface.test.ts`
 * carimba a lista para que ampliá-la ou reduzi-la seja um gesto deliberado, com `KERNEL_VERSION`.
 */

// ─── O pacote ─────────────────────────────────────────────────────────────────

export type {
  ActionModuleTemplate,
  LookupModuleTemplate,
  MarketplacePlugin,
  ScreenModuleTemplate,
  ScreenPatchTemplate,
  ScriptModuleTemplate,
  TemplateField,
  ViewModuleTemplate,
  WorkflowModuleTemplate,
} from '../domain/entities/MarketplacePlugin';

// ─── Manifest, contribuições e pontos de extensão ─────────────────────────────

export type {
  ArtifactRef,
  Contribution,
  ImplKind,
  ImplRef,
  ExtensionPointDefinition,
  PluginBackendRequirement,
  PluginDependency,
  BackendPrerequisite,
  FirestoreIndexField,
  FirestoreIndexSpec,
  PluginDiagnostic,
  DiagnosticCode,
  DiagnosticSeverity,
  PluginLifecycle,
  PluginLifecycleHook,
  PluginManifest,
  PluginPublisher,
  PluginMigration,
  MigrationPhase,
  CapabilityProvision,
  CapabilityRequirement,
  ParsedPermission,
  PermissionDomain,
  SemVer,
  ValidateManifestOptions,
} from '../domain/schema/plugin';

export {
  ARTIFACT_REF_SEPARATOR,
  MAX_ARTIFACT_ID_LENGTH,
  artifactRef,
  hasRefSeparator,
  isArtifactId,
  isArtifactRef,
  parseArtifactRef,
  DEFAULT_CONTRIBUTION_PRIORITY,
  IMPL_KINDS,
  KERNEL_PLUGIN_ID,
  KERNEL_VERSION,
  MIGRATION_ID_MAX_LENGTH,
  MIGRATION_ID_PATTERN,
  MIGRATION_PHASES,
  PERMISSION_DOMAINS,
  THIRD_PARTY_IMPL_KINDS,
  backendFingerprint,
  compareSemVer,
  contributionKey,
  isApiVersionCompatible,
  isKernelCompatible,
  isTrustedOnlyImplKind,
  isValidContributionId,
  isValidExtensionPointId,
  isValidPermission,
  isValidPluginId,
  isValidRange,
  isValidSemVer,
  parseSemVer,
  satisfiesRange,
  sortContributions,
  validateBackendRequirement,
  validateContribution,
  validateExtensionPoint,
  validateMigrations,
  validatePermissions,
  validatePluginManifest,
} from '../domain/schema/plugin';

// ─── Controle de acesso: as permissões que a extensão declara e as Roles do escritório ────────

export type {
  AccessPermission,
  AccessRequirement,
  CatalogPermission,
  CrudAction,
  DeclaredPermission,
  DeclaredRequirement,
  ParsedAccessPermission,
  PermissionCatalog,
  PermissionResource,
  ResolvedPermissions,
  ResourceLabel,
} from '../domain/schema/access';

export {
  ACCESS_API_VERSION,
  ACCESS_EXTENSION_POINTS,
  ACCESS_PERMISSION_POINT,
  ACCESS_REQUIREMENT_POINT,
  ACCESS_RESOURCE_POINT,
  CRUD_ACTIONS,
  accessPermissionContribution,
  accessPermissionOf,
  accessRequirementContribution,
  accessResourceContribution,
  buildPermissionCatalog,
  collectionPermissionId,
  declaredPermissionsOf,
  declaredRequirementsOf,
  declaredResourcesOf,
  dependenciesOf,
  isValidAccessPermissionId,
  parseAccessPermission,
  resolveEffective,
  validateAccessPermission,
  validateAccessRequirement,
} from '../domain/schema/access';

// ─── Pontos de extensão do produto — a lista que o autor consulta ─────────────

export type {
  AuthProviderFlow,
  AuthProviderKind,
  AuthProviderMetadata,
  AuthProviderSpec,
} from '../domain/schema/auth';

export {
  AUTH_API_VERSION,
  AUTH_EXTENSION_POINTS,
  AUTH_PROVIDER_KINDS,
  AUTH_PROVIDER_KINDS_REQUIRING_ID,
  AUTH_PROVIDER_POINT,
  asAuthProviderMetadata,
  authProviderSpecOf,
} from '../domain/schema/auth';

export type {
  UiCommandMetadata,
  UiMenuAction,
  UiMenuItemMetadata,
  UiNavBadge,
  UiNavGroupMetadata,
  UiNavMetadata,
  UiNavTarget,
  UiPageMetadata,
  RecordTabProps,
  UiRecordActionMetadata,
  UiSlotMetadata,
  UiTabMetadata,
  UiWidgetMetadata,
} from '../domain/schema/ui/uiExtensionPoints';

export {
  ADMIN_NAV_GROUP,
  AUTOMATION_NAV_GROUP,
  CUSTOMIZATION_NAV_GROUP,
  UI_API_VERSION,
  UI_COMMAND_POINT,
  UI_EXTENSION_POINTS,
  UI_MENU_POINT,
  UI_NAV_GROUP_POINT,
  UI_NAV_POINT,
  UI_PAGE_POINT,
  UI_RECORD_ACTION_POINT,
  UI_SETTINGS_POINT,
  UI_SLOT_POINT,
  UI_TAB_POINT,
  UI_WIDGET_POINT,
  LOGIN_SLOT_SURFACES,
  RECORD_SURFACE_PREFIX,
  USER_MENU_SURFACE,
  WORKSPACE_SLOT_SURFACES,
  recordSurface,
  recordSurfaceSourceId,
} from '../domain/schema/ui/uiExtensionPoints';

export type { WidgetNodeType, WidgetSpec } from '../domain/schema/ui/widgetSpec';
export { WIDGET_NODE_TYPES, isWidgetSpec, widgetChildren } from '../domain/schema/ui/widgetSpec';
export type { CardNode, CardNodeType, CardTemplate } from '../domain/schema/ui/cardTemplate';
export { CARD_NODE_TYPES, DEFAULT_CARD_BODY, readCardTemplate } from '../domain/schema/ui/cardTemplate';
export type { CardTemplateIssue } from '../domain/schema/ui/cardTemplateIssues';
export { cardTemplateIssues } from '../domain/schema/ui/cardTemplateIssues';
export type { PortalTemplate, PortalTemplateNode, PortalTemplateNodeType } from '../domain/schema/ui/portalTemplate';
export {
  DEFAULT_PORTAL_CARD_BODY,
  DEFAULT_PORTAL_DETAIL_BODY,
  PORTAL_TEMPLATE_NODE_TYPES,
  readPortalTemplate,
} from '../domain/schema/ui/portalTemplate';
export { portalTemplateIssues } from '../domain/schema/ui/portalTemplateIssues';
export type {
  PortalCountNode,
  PortalMarkdownNode,
  PortalPageSpec,
  PortalRecordsNode,
  PortalWidgetNode,
  PortalWidgetNodeType,
  PortalWidgetSpec,
} from '../domain/schema/ui/portalWidget';
export {
  PORTAL_PAGE_SPEC_SINCE_KERNEL,
  PORTAL_WIDGET_NODE_TYPES,
  PORTAL_WIDGET_RECORDS_MAX_LIMIT,
  PORTAL_WIDGET_SPEC_SINCE_KERNEL,
  readPortalWidgetSpec,
} from '../domain/schema/ui/portalWidget';
export type { PortalWidgetFieldsOf } from '../domain/schema/ui/portalWidgetIssues';
export { portalWidgetSpecIssues } from '../domain/schema/ui/portalWidgetIssues';

export { STEP_TYPES } from '../domain/entities/Workflow';

export {
  DATA_API_VERSION,
  DATA_ENTITY_POINT,
  DATA_EXTENSION_POINTS,
  DATA_EXTERNAL_LOOKUP_POINT,
  DATA_FIELD_RULE_PRESET_POINT,
  DATA_LOOKUP_POINT,
  DATA_SERVICE_POINT,
  fieldRulePresetContribution,
  lookupProviderContribution,
} from '../domain/schema/dataExtensionPoints';

export type { FieldRulePreset, FieldRulePresetMask, FieldRulePresetValidate, FormatOp } from '../domain/schema/fieldRulePresets';
export type { LookupProviderFailure, LookupProviderRequest, LookupProviderSpec } from '../domain/schema/lookupProviderSpec';

export type { MessageBundle, MessageParams, TranslateFn } from '../domain/schema/i18n';
export {
  DEFAULT_LOCALE,
  I18N_API_VERSION,
  I18N_EXTENSION_POINTS,
  I18N_MESSAGES_POINT,
  MESSAGE_REF_SIGIL,
  isMessageRef,
  isValidMessageKey,
  messageBundleContribution,
  qualifyKey,
} from '../domain/schema/i18n';
export type { LocaleCode } from '../domain/schema/i18n';

export type { ThemeBase, ThemeSpec, ThemeTagColor, ThemeTokenBundle } from '../domain/schema/theme';
export {
  THEME_API_VERSION,
  THEME_DEFINITION_POINT,
  THEME_EXTENSION_POINTS,
  THEME_TOKENS_POINT,
  /**
   * A PALETA. Faltava aqui enquanto o irmão dela — o construtor de tokens de domínio — já estava, e a
   * assimetria era descuido, não decisão: `theme.definition` é metadata pura (`allowedImplKinds: []`),
   * então qualquer pacote pode contribuí-la, e só o construtor não atravessava. Quem escrevesse um tema
   * pelo SDK montava a contribuição à mão ou não escrevia.
   */
  themeContribution,
  themeTokensContribution,
} from '../domain/schema/theme';

// ─── Relatórios: a pergunta que se faz ao dado ────────────────────────────────

export type {
  ReportAccess,
  ReportAggregateMeasure,
  ReportChart,
  ReportChartKind,
  ReportComputedMeasure,
  ReportDataset,
  ReportDatasetKind,
  ReportDimension,
  ReportFieldPresentation,
  ReportGranularity,
  ReportGroupLevel,
  ReportMatrixShape,
  ReportMeasure,
  ReportPresentation,
  ReportPrompt,
  ReportSchedule,
  ReportShape,
  ReportShapeKind,
  ReportSpec,
  ReportSummaryShape,
  ReportTabularShape,
  ReportValueFormat,
  ReportContributionMetadata,
  ReportGroupKey,
  ReportResult,
  ReportRow,
  ReportTotals,
  ReportSpecIssue,
  ReportValidationContext,
} from '../domain/schema/report';

export {
  REPORT_API_VERSION,
  REPORT_CAPABILITIES,
  REPORT_CHART_KINDS,
  REPORT_DATASET_KINDS,
  REPORT_DEFINITION_POINT,
  REPORT_EXTENSION_POINTS,
  REPORT_GRANULARITIES,
  REPORT_SHAPE_KINDS,
  REPORT_SPEC_VERSION,
  deriveReportRequires,
  hasBlockingReportIssue,
  reportContribution,
  reportOf,
  reportPaths,
  reportSourceCollections,
  unsupportedReportCapabilities,
  validateReportSpec,
  validateReportSpecShape,
} from '../domain/schema/report';

export type { ReportDefinition, ReportModuleTemplate } from '../domain/entities/Report';

// MODELOS DE DOCUMENTO. Um pacote declara o modelo como contribuição de DADO (`document.template`) —
// a mesma forma que o escritório grava —, e o autor precisa do validador e da gramática que a geração
// usa para conferir o texto antes de publicar.
export {
  DOCUMENT_EXTENSION_POINTS,
  DOCUMENT_OUTPUTS_BY_FORMAT,
  DOCUMENT_TEMPLATE_API_VERSION,
  DOCUMENT_TEMPLATE_MAX_BYTES,
  DOCUMENT_TEMPLATE_POINT,
  documentTemplateContribution,
  documentTemplateIssues,
  documentTemplateOf,
  parseTemplate,
  templateOutputs,
} from '../domain/schema/document';

export type {
  DocumentOutputFormat,
  DocumentTemplateDataset,
  DocumentTemplateFormat,
  DocumentTemplateIssue,
  DocumentTemplateSpec,
  TemplateIssue,
  TemplateNode,
} from '../domain/schema/document';

// DIAS ÚTEIS. A extensão diz ONDE moram os calendários (`time.business.calendar`); a conta é do
// kernel. O autor precisa do construtor da contribuição e do contrato do documento que a conta lê.
export {
  BUSINESS_CALENDAR_API_VERSION,
  BUSINESS_CALENDAR_POINT,
  TIME_EXTENSION_POINTS,
  businessCalendarContribution,
} from '../domain/schema/time/extensionPoints';
export { BUSINESS_CALENDAR_FIELDS, BUSINESS_DAYS_FUNCTION_NAMES } from '../domain/schema/time/businessDays';

export type { BusinessCalendarSource } from '../domain/schema/time/extensionPoints';
export type { BusinessCalendar } from '../domain/schema/time/businessDays';

export { KERNEL_EXTENSION_POINTS } from '../domain/schema/extensionPoints';

// ─── Automação: workflows, ações e scripts ────────────────────────────────────

export type {
  Condition,
  EventInputMapping,
  ExpressionInputMapping,
  InputMapping,
  LiteralInputMapping,
  OutputInputMapping,
  StepType,
  VariableInputMapping,
  WorkflowDefinition,
  WorkflowLoopConfig,
  WorkflowParameter,
  WorkflowParameterType,
  WorkflowStep,
  WorkflowStepBranches,
} from '../domain/entities/Workflow';

export type { ActionDefinition, ActionLocalCommand, ActionOutcome } from '../domain/entities/Action';
export type { Script, ScriptOutputParam } from '../domain/entities/Script';
export type { QueryOperator, QueryOrderBy, QueryPredicate, QuerySpec } from '../domain/schema/querySpec';

// Os quatro `*StepConfig` são a forma que os passos `upsert`, `remove`, `map` e `validate-object`
// exigem em `configuration` — e não são `UpsertSpec`/`QuerySpec`. Ficaram anos fora daqui, e o efeito
// era o pior possível: `QuerySpec` ERA publicado (e o passo `query` de fato o recebe), então quem
// aprendia o `query` generalizava para o `upsert` e escrevia a forma errada, sem que nada reprovasse.
export type { MapFieldMapping, MapStepConfig } from '../domain/schema/mapSpec';
export type { RemoveStepConfig, UpsertSpec, UpsertStepConfig } from '../domain/schema/mutationSpec';
export type { ValidateStepConfig } from '../domain/schema/validateSpec';

// O catálogo de passos: a metadata que diz, para cada `stepDefinitionId`, o que ele recebe e o que
// publica. Era a única capacidade grande do kernel que um autor não conseguia enumerar.
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
} from '../domain/schema/workflowStepCatalog';
export {
  CONTROL_STEP_TYPES,
  CORE_STEP_CATALOG,
  CORE_STEP_DEFINITION_IDS,
  UNIMPLEMENTED_STEP_TYPES,
  coreStepMetadata,
  isCoreStepDefinitionId,
} from '../domain/schema/workflowStepCatalog';

// ─── Dados: campos, telas e configuração ──────────────────────────────────────

export type {
  CustomFieldMask,
  CustomFieldOption,
  CustomFieldType,
  CustomFieldValue,
  FieldDefinition,
  FieldOrigin,
  RecordKeyKind,
  RecordKeyNormalization,
  RecordKeyScope,
  RecordKeySpec,
  RecordKeyStatus,
  ScreenListAction,
} from '../domain/entities';

/**
 * O que `FieldDefinition` REFERENCIA — publicado porque a estrutura sem os nomes é um beco: um autor
 * escreve `logic: { compute: '…' }` e o tipo funciona por estrutura, mas ele não tem como nomear a
 * forma, guardá-la numa constante nem pedi-la ao `describe_sdk_type`. `logic` e `aggregation` são
 * justamente o que substitui código numa tela declarada.
 */
export type {
  AggregationOp,
  FieldAggregation,
  NumericAggregationOp,
  FieldFileConfig,
  FieldLogic,
  FieldLookupBinding,
  FieldRules,
  FormatRule,
  ValidateRule,
} from '../domain/schema/fieldRules';

/**
 * O VOCABULÁRIO como array, e não só como união: é o que permite a quem escreve extensão — e ao
 * `AUTHORING.md` — enumerar o que existe em vez de descobrir um tipo por vez pelo erro do `tsc`.
 */
export { CUSTOM_FIELD_TYPES } from '../domain/schema/fieldRules';
export { FIELD_EXPRESSION_FUNCTION_NAMES } from '../domain/schema/fieldExpression';

export type {
  SettingsOptionsSource,
  SettingsOptionsSourceKind,
  SettingsProperty,
  SettingsPropertyOption,
  SettingsPropertyType,
  SettingsScope,
  SettingsSection,
} from '../domain/schema/settings';
export { SETTINGS_OPTIONS_SOURCE_KINDS, SETTINGS_SCOPES } from '../domain/schema/settings';

// ─── Construtores de contribuição ─────────────────────────────────────────────

export {
  authProvider,
  command,
  menuItem,
  nav,
  navGroup,
  notificationCategory,
  page,
  pointContribution,
  portalPageSpec,
  portalView,
  portalWidgetSpec,
  recordAction,
  settingsSection,
  surfaceSlot,
  surfaceSlotSpec,
  surfaceTab,
  surfaceTabSpec,
  surfaceWidget,
  surfaceWidgetSpec,
  widgetPage,
} from './contributions';
export type { PortalViewMetadata, PortalViewSurface } from '../domain/schema/portalExtensionPoints';
export type { PortalPageSpecMetadata, PortalWidgetSpecMetadata } from './contributions';
export type { NotificationCategoryMetadata } from '../domain/schema/notifications';

// ─── Validação e serialização ─────────────────────────────────────────────────

export type { PackageRef, PackageValidationIssue, RefKind } from '../domain/usecases/plugins/pluginReferences';
export {
  packageIssues,
  packageOutRefs,
  packageSizeAdvisory,
  validatePackage,
} from '../domain/usecases/plugins/pluginReferences';

export type { ParsePackageResult } from '../domain/usecases/plugins/packageSerialization';
export {
  packageFingerprint,
  parsePackage,
  serializePackage,
} from '../domain/usecases/plugins/packageSerialization';

export type { AuthoredPlugin, AuthoredView } from './authoring';

/**
 * A fusão de uma view escrita em várias partes. O autor não a chama — ele declara a lista em
 * `sourceFile` e o compilador funde —, mas as extensões de primeira parte declaram a fonte já como
 * TEXTO (`?raw`), e para essas a fusão é a chamada aqui. Sai no barril porque os exemplos que viajam
 * no pacote são exatamente essas.
 */
export { mergeViewSources } from './mergeSources';

export type { SdkIssue } from './validate';
export { validatePluginPackage } from './validate';

// ─── Modelo de domínio — a etapa ANTES de qualquer artefato ───────────────────

/**
 * A camada que impõe a ordem "entidades primeiro, tela depois". Sai no barril porque a regra
 * crítica tem de poder falhar no `npm test` do diretório de autoria, e não só no diálogo com o
 * agente: um `plugin.test.ts` pode guardar o modelo ao lado do pacote e cobrar que ele continue
 * de pé a cada alteração — que é a mesma razão por que `validatePluginPackage` está aqui.
 *
 * Nada disto chega ao pacote INSTALADO: um modelo de domínio não viaja no `.json`, o kernel não o
 * lê e nenhum ponto de extensão mudou de forma. É por isso que o `KERNEL_VERSION` não se move.
 */
export type {
  ArtifactPlan,
  CatalogEntity,
  CatalogField,
  CatalogList,
  CatalogScreenInput,
  DerivedFrom,
  DomainAggregation,
  DomainCatalog,
  DomainDenormalization,
  DomainEntity,
  DomainField,
  DomainIssue,
  DomainIssueCode,
  DomainModel,
  DomainRelationship,
  DomainSeverity,
  DomainValidation,
  EntityKind,
  MappedRelationship,
  Ownership,
  ParentRelation,
  ParseResult,
  PlanOperation,
  PlannedField,
  PlannedLookup,
  PlannedMigration,
  PlannedScreen,
  RelationshipStorage,
  RelationshipType,
  SemanticType,
  StorageMechanism,
} from './domain';

/**
 * O MODELO DE COMPORTAMENTO, publicado pela mesma razão que o de estrutura: o autor testa o
 * `domain-model.json` dele no `npm test` do próprio diretório, e uma regra que só existe no diálogo
 * com o agente não é uma regra. Também NÃO move o `KERNEL_VERSION` — é vocabulário de AUTORIA, e o
 * único artefato que o comportamento produz (as opções semente de uma lista) já é uma propriedade
 * que o manifest tem.
 */
export type {
  BehaviorConcern,
  BehaviorEffect,
  BehaviorGuard,
  BehaviorInvariant,
  BehaviorMechanism,
  BehaviorModel,
  BehaviorState,
  BehaviorStateOption,
  BehaviorTransition,
  BehaviorTrigger,
  BehaviorValidation,
  EffectKind,
  InvariantEnforcement,
  InvariantScope,
  MappedTransition,
  TransitionFromCheck,
  TriggerKind,
} from './domain';

export type {
  ActionPlacement,
  ArtifactPlanOptions,
  BusinessRule,
  CoverageItem,
  CoverageSummary,
  CoverageSurface,
  EntityTab,
  EntityTabKind,
  LedgerIntegrity,
  LedgerProduced,
  LedgerReality,
  NotAScreen,
  ParsedBusinessRule,
  PlanTrace,
  PlannedDeactivation,
  PlannedFormSection,
  PlannedListColumn,
  PlannedReadOnlyField,
  PlannedRecordAction,
  PlannedReferenceField,
  PlannedTab,
  RuleDelta,
  RuleLedger,
  RuleLedgerEntry,
  ScreenLayout,
  ScreenPlan,
  ScreenPlanInput,
  ScreenPlanRule,
  ScreenPresence,
  ScreenSourceIdOrigin,
} from './domain';

export {
  AGGREGATION_OPS,
  DELETE_SEMANTICS,
  DERIVED_FROM,
  DETECTORS,
  DOMAIN_ISSUE_CODES,
  DOMAIN_MODEL_VERSION,
  DOMAIN_SEVERITIES,
  EMBEDDED_STRATEGY,
  ENTITY_KINDS,
  OWNERSHIPS,
  RELATIONSHIP_STORAGES,
  RELATIONSHIP_TYPES,
  SCREEN_IS_NOT_AN_ENTITY_MODEL,
  SEMANTIC_TYPES,
  STORAGE_MECHANISMS,
  applyPlanToCatalog,
  buildArtifactPlan,
  buildDomainCatalog,
  canonicalRelationship,
  catalogEntity,
  collectionOfEntity,
  detectorList,
  domainModelJsonSchema,
  expandEmbedded,
  hasBlockingIssue,
  mapRelationship,
  parseDomainModel,
  relationshipSummary,
  sortIssues,
  validateDomainModel,
} from './domain';

/**
 * O esquema das telas IRMÃS, para um teste de extensão conferir relatório e consulta contra elas.
 *
 * `validateReportSpec` aceita o caminho que não conhece, porque no escritório ele pode ser campo do
 * Form Design. Num teste de extensão as telas estão em mãos, e o caminho que nenhuma declara é erro de
 * digitação — o Painel conferia isso importando `lib/sdk/domain/catalog.js` pelo caminho, com um
 * andador próprio. Daqui sai o mesmo contexto que o `check` monta e a mesma pergunta que ele faz:
 * `packagesSchemaContext` a partir dos `plugin.ts` irmãos, `catalogSchemaContext` a partir de telas
 * já na forma do catálogo.
 */
export type { ScreenSourcePackage, UndeclaredPath } from './domain';
export {
  catalogSchemaContext,
  packagesSchemaContext,
  queryPaths,
  undeclaredQueryPaths,
  undeclaredReportPaths,
} from './domain';

export {
  A_STATE_IS_A_KEY,
  BEHAVIOR_CONCERNS,
  BEHAVIOR_MECHANISMS,
  DESCRIPTION_REQUIRED_BECAUSE,
  DESCRIPTION_REQUIRED_EVENTS,
  EFFECT_KINDS,
  INVARIANT_ENFORCEMENTS,
  INVARIANT_SCOPES,
  SCHEDULE_TRIGGER_SUPPORTED,
  TRIGGER_KINDS,
  enforcementOfScope,
  mapTransition,
  mechanismsFor,
  referenceParameterKey,
  transitionSummary,
  validateBehaviorModel,
} from './domain';

/**
 * O FECHO DO PIPELINE: a regra de negócio como artefato, o plano de TELAS decidido por regra, o vínculo
 * regra -> artefatos, e o relatório de cobertura de mecanismo.
 *
 * Sai no barril pelo mesmo motivo que o resto da camada de modelo: a regra crítica tem de poder ser
 * cobrada no `npm test` do diretório de autoria, e não só no diálogo com o agente. E pelo mesmo motivo
 * NÃO move o `KERNEL_VERSION`: nada disto viaja no `.json` instalado. O vínculo regra -> artefatos, em
 * particular, é uma decisão registrada — ele mora num arquivo de trabalho do workspace, e carimbá-lo
 * dentro do artefato instalado é o que teria movido o contrato. Ver `traceability.ts`.
 */
export {
  COVERAGE_SURFACES,
  ENTITY_TAB_KINDS,
  RULE_LEDGER_FILE,
  RULE_LEDGER_VERSION,
  SCREEN_LIST_COLUMN_BUDGET,
  SCREEN_PLAN_HUMAN_DECISIONS,
  SCREEN_PLAN_RULES,
  SCREEN_SOURCE_ID_PRECEDENCE,
  buildScreenPlan,
  businessRuleSummary,
  checkBusinessRule,
  coverageGaps,
  coverageSummary,
  declaredScreenSourceIds,
  deriveScreenSourceId,
  emptyRuleLedger,
  ledgerEntryOf,
  ledgerFindings,
  mechanismCoverage,
  parseBusinessRule,
  parseRuleLedger,
  registeredScreenSourceIds,
  ruleDelta,
  ruleFingerprint,
  ruleLedgerEntry,
  withRuleEntry,
} from './domain';

/**
 * O RETRATO DA INSTALAÇÃO (`installed-catalog.json`): o único escritor do arquivo que o diretório de
 * autoria lê.
 *
 * Sai no barril para que o Console o carregue do SDK instalado em `extensions/` em vez de trazer uma
 * cópia própria — era a cópia que deixava um Console de outra versão escrever um formato que o kernel
 * instalado não lia. A aplicação usa a mesma função no botão Exportar catálogo da tela de Extensões.
 *
 * NÃO move o `KERNEL_VERSION`: o retrato é arquivo de autoria, e nada dele chega ao pacote instalado.
 */
export {
  INSTALLED_CATALOG_FILE,
  INSTALLED_CATALOG_VERSION,
  buildInstalledCatalog,
  serializeInstalledCatalog,
} from '../domain/usecases/plugins/installedCatalogSnapshot';
export type {
  InstalledCatalogExporter,
  InstalledCatalogSnapshot,
  InstalledCatalogSnapshotInput,
  InstalledCatalogSourceDocument,
  InstalledCatalogSources,
} from '../domain/usecases/plugins/installedCatalogSnapshot';
