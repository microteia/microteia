import { describe, expect, it } from 'vitest';
import * as sdk from './index';
import { KERNEL_VERSION } from '../domain/schema/plugin/kernelVersion';

/**
 * A superfície do SDK é CONTRATO: a partir do momento em que ela sai daqui, alguém de fora escreve
 * contra ela, e removê-la ou renomeá-la quebra código que não está neste repositório.
 *
 * Este teste não impede a mudança — impede a mudança DISTRAÍDA. Acrescentar um símbolo é aditivo e só
 * pede o minor do `KERNEL_VERSION`; remover ou renomear é quebra e pede o major. As duas coisas
 * passam por atualizar a lista abaixo, que é onde a decisão fica registrada.
 *
 * É a mesma mecânica de `PT_BR_MESSAGES_FINGERPRINT` e de `backendFingerprint`, pelo mesmo motivo: o
 * defeito que ela pega não tem sintoma local nenhum.
 */
const PUBLISHED = [
  'ACCESS_API_VERSION', 'ACCESS_EXTENSION_POINTS', 'ACCESS_PERMISSION_POINT', 'ACCESS_REQUIREMENT_POINT', 'ACCESS_RESOURCE_POINT', 'CRUD_ACTIONS', 'accessPermissionContribution', 'accessRequirementContribution', 'accessPermissionOf', 'accessResourceContribution', 'buildPermissionCatalog', 'collectionPermissionId', 'declaredPermissionsOf', 'declaredRequirementsOf', 'declaredResourcesOf', 'dependenciesOf', 'isValidAccessPermissionId', 'parseAccessPermission', 'resolveEffective', 'validateAccessPermission', 'validateAccessRequirement',
  'DATA_API_VERSION', 'DATA_ENTITY_POINT', 'DATA_EXTENSION_POINTS', 'DATA_EXTERNAL_LOOKUP_POINT',
  'DATA_FIELD_RULE_PRESET_POINT', 'DATA_LOOKUP_POINT', 'DATA_SERVICE_POINT',
  'AUTH_API_VERSION', 'AUTH_EXTENSION_POINTS', 'AUTH_PROVIDER_KINDS',
  'AUTH_PROVIDER_KINDS_REQUIRING_ID', 'AUTH_PROVIDER_POINT', 'asAuthProviderMetadata',
  'authProvider', 'authProviderSpecOf',
  'DEFAULT_CONTRIBUTION_PRIORITY', 'DEFAULT_LOCALE', 'I18N_API_VERSION', 'I18N_EXTENSION_POINTS',
  'I18N_MESSAGES_POINT', 'IMPL_KINDS', 'KERNEL_PLUGIN_ID', 'KERNEL_VERSION', 'MESSAGE_REF_SIGIL',
  'MIGRATION_ID_MAX_LENGTH', 'MIGRATION_ID_PATTERN', 'MIGRATION_PHASES', 'PERMISSION_DOMAINS',
  'SETTINGS_OPTIONS_SOURCE_KINDS', 'SETTINGS_SCOPES', 'THEME_API_VERSION', 'THEME_DEFINITION_POINT', 'THEME_EXTENSION_POINTS',
  'THEME_TOKENS_POINT', 'THIRD_PARTY_IMPL_KINDS', 'UI_API_VERSION', 'UI_COMMAND_POINT',
  'UI_EXTENSION_POINTS', 'UI_NAV_POINT', 'UI_PAGE_POINT', 'UI_RECORD_ACTION_POINT',
  // O GRUPO da barra lateral. MOVE o `KERNEL_VERSION`: um ponto novo e um `group` no `ui.nav` são
  // forma nova de pacote instalado — um kernel antigo os aceitaria e desenharia o menu sem grupos.
  'UI_NAV_GROUP_POINT', 'ADMIN_NAV_GROUP', 'navGroup',
  // Os outros dois grupos que o núcleo declara. Só AUTORIA: uma chave de grupo que o kernel não
  // declara deixa o item solto, então não mudam a forma do pacote instalado.
  'AUTOMATION_NAV_GROUP', 'CUSTOMIZATION_NAV_GROUP',
  'LOGIN_SLOT_SURFACES',
  'UI_MENU_POINT', 'UI_SETTINGS_POINT', 'UI_SLOT_POINT', 'UI_TAB_POINT', 'UI_WIDGET_POINT',
  'USER_MENU_SURFACE', 'WORKSPACE_SLOT_SURFACES', 'WIDGET_NODE_TYPES',
  // A faixa de abas do DETALHE de um registro, endereçada pelo `sourceId` da tela. MOVE o
  // `KERNEL_VERSION`: uma aba em `record:<sourceId>` é forma nova de pacote instalado — um kernel
  // antigo a aceitaria e nunca a desenharia.
  'RECORD_SURFACE_PREFIX', 'recordSurface', 'recordSurfaceSourceId',
  'CUSTOM_FIELD_TYPES', 'FIELD_EXPRESSION_FUNCTION_NAMES', 'STEP_TYPES',
  'CONTROL_STEP_TYPES', 'CORE_STEP_CATALOG', 'CORE_STEP_DEFINITION_IDS',
  'UNIMPLEMENTED_STEP_TYPES', 'coreStepMetadata', 'isCoreStepDefinitionId',
  // A REFERÊNCIA a um artefato de OUTRA extensão, e os dois identificadores de que ela é feita. Sai
  // no barril porque o autor escreve a referência à mão nos dois lados — o `exports` de quem é
  // dependido e o literal do passo de quem depende. MOVE o `KERNEL_VERSION`: um literal qualificado
  // dentro do `.json` instalado é forma nova de pacote, e um kernel antigo o procuraria por id.
  'ARTIFACT_REF_SEPARATOR', 'MAX_ARTIFACT_ID_LENGTH', 'artifactRef', 'hasRefSeparator',
  'isArtifactId', 'isArtifactRef', 'parseArtifactRef',
  'backendFingerprint', 'command', 'compareSemVer', 'contributionKey', 'fieldRulePresetContribution',
  'isApiVersionCompatible', 'isKernelCompatible', 'isMessageRef', 'isTrustedOnlyImplKind',
  'isValidContributionId', 'isValidExtensionPointId', 'isValidMessageKey', 'isValidPermission',
  'isValidPluginId', 'isValidRange', 'isValidSemVer', 'isWidgetSpec', 'lookupProviderContribution',
  'menuItem', 'messageBundleContribution', 'nav', 'notificationCategory', 'packageFingerprint', 'packageIssues', 'packageOutRefs',
  'packageSizeAdvisory', 'page', 'parsePackage', 'parseSemVer', 'pointContribution', 'portalView', 'qualifyKey',
  'recordAction', 'satisfiesRange', 'serializePackage', 'settingsSection', 'sortContributions',
  'surfaceSlot', 'surfaceSlotSpec', 'surfaceTab', 'surfaceTabSpec', 'surfaceWidget',
  'surfaceWidgetSpec', 'themeContribution', 'themeTokensContribution',
  'validateBackendRequirement', 'validateContribution', 'validateExtensionPoint',
  'validateMigrations', 'validatePackage', 'validatePermissions', 'validatePluginManifest',
  'validatePluginPackage', 'widgetChildren', 'widgetPage', 'mergeViewSources',
  // RELATÓRIOS. Sai no barril inteiro porque o autor escreve o `ReportSpec` à mão e precisa do
  // vocabulário fechado (as dobras, os baldes, as marcas de gráfico) e do validador — o mesmo que o
  // portão do pacote roda. MOVE o `KERNEL_VERSION`: um ponto de extensão novo e um artefato novo no
  // `.json` são forma nova de pacote instalado, e um kernel antigo não os entende.
  'KERNEL_EXTENSION_POINTS', 'REPORT_API_VERSION', 'REPORT_CAPABILITIES', 'REPORT_CHART_KINDS',
  'REPORT_DATASET_KINDS', 'REPORT_DEFINITION_POINT', 'REPORT_EXTENSION_POINTS',
  'REPORT_GRANULARITIES', 'REPORT_SHAPE_KINDS', 'REPORT_SPEC_VERSION', 'deriveReportRequires',
  'hasBlockingReportIssue', 'reportContribution', 'reportOf', 'reportPaths',
  'reportSourceCollections', 'unsupportedReportCapabilities', 'validateReportSpec',
  'validateReportSpecShape',
  // A camada de MODELO DE DOMÍNIO. Sai no barril para que a regra crítica possa ser cobrada no
  // `npm test` do diretório de autoria, e não só no diálogo com o agente. NÃO move o
  // `KERNEL_VERSION`: um modelo de domínio nunca viaja no `.json` instalado — é vocabulário de
  // AUTORIA, como `AuthoredPlugin` e `sourceFile`.
  'AGGREGATION_OPS', 'DELETE_SEMANTICS', 'DERIVED_FROM', 'DETECTORS', 'DOMAIN_ISSUE_CODES',
  'DOMAIN_MODEL_VERSION', 'DOMAIN_SEVERITIES', 'EMBEDDED_STRATEGY', 'ENTITY_KINDS',
  'OWNERSHIPS', 'RELATIONSHIP_STORAGES', 'RELATIONSHIP_TYPES', 'SCREEN_IS_NOT_AN_ENTITY_MODEL',
  'SEMANTIC_TYPES', 'STORAGE_MECHANISMS', 'applyPlanToCatalog', 'buildArtifactPlan',
  'buildDomainCatalog', 'canonicalRelationship', 'catalogEntity', 'collectionOfEntity',
  'detectorList', 'domainModelJsonSchema', 'expandEmbedded', 'hasBlockingIssue',
  'mapRelationship', 'parseDomainModel', 'relationshipSummary', 'sortIssues', 'validateDomainModel',
  // O MODELO DE COMPORTAMENTO, pela mesma razão e com a mesma consequência: nada aqui viaja no
  // `.json` instalado, então o `KERNEL_VERSION` não se move.
  'A_STATE_IS_A_KEY', 'BEHAVIOR_CONCERNS', 'BEHAVIOR_MECHANISMS', 'EFFECT_KINDS', 'INVARIANT_ENFORCEMENTS',
  'INVARIANT_SCOPES', 'enforcementOfScope', 'referenceParameterKey',
  'SCHEDULE_TRIGGER_SUPPORTED', 'TRIGGER_KINDS', 'mapTransition', 'mechanismsFor',
  'transitionSummary', 'validateBehaviorModel',
  'DESCRIPTION_REQUIRED_BECAUSE', 'DESCRIPTION_REQUIRED_EVENTS',
  // O FECHO DO PIPELINE: a regra como artefato, o plano de telas, a rastreabilidade e a cobertura de
  // mecanismo. Mesma nota das duas listas acima — nada disto viaja no `.json` instalado, então o
  // `KERNEL_VERSION` não se move. A rastreabilidade é o caso em que essa escolha foi DECIDIDA e não
  // herdada: carimbar o `ruleId` dentro do artefato instalado teria mudado a forma do pacote, e o
  // vínculo mora num arquivo de trabalho do workspace justamente para não fazer isso.
  'COVERAGE_SURFACES', 'ENTITY_TAB_KINDS', 'RULE_LEDGER_FILE', 'RULE_LEDGER_VERSION',
  'SCREEN_LIST_COLUMN_BUDGET', 'SCREEN_PLAN_HUMAN_DECISIONS', 'SCREEN_PLAN_RULES',
  'buildScreenPlan', 'businessRuleSummary', 'checkBusinessRule', 'coverageGaps', 'coverageSummary',
  'emptyRuleLedger', 'ledgerEntryOf', 'mechanismCoverage', 'parseBusinessRule', 'parseRuleLedger',
  'ruleDelta', 'ruleFingerprint', 'ruleLedgerEntry', 'withRuleEntry',
  // A IDENTIDADE UNIVERSAL DA TELA. Sai no barril porque é a regra que mais custa errar e a única
  // defesa contra ela é poder cobrá-la no `npm test` do diretório de autoria: um `sourceId` trocado
  // entre duas versões instala uma SEGUNDA tela em todo escritório, sem sintoma nenhum. Também não
  // move o `KERNEL_VERSION` — o campo já existe no pacote instalado; o que é novo é quem o decide.
  'SCREEN_SOURCE_ID_PRECEDENCE', 'declaredScreenSourceIds', 'deriveScreenSourceId', 'ledgerFindings',
  'registeredScreenSourceIds',
  // O ESQUEMA DAS IRMÃS para o teste de extensão: o contexto que o `check` monta e a pergunta pelo
  // caminho que nenhum campo declara. Vocabulário de AUTORIA — nada aqui chega ao pacote instalado,
  // então o `KERNEL_VERSION` não se move.
  'catalogSchemaContext', 'packagesSchemaContext', 'queryPaths', 'undeclaredQueryPaths',
  'undeclaredReportPaths',
  // MODELOS DE DOCUMENTO. MOVE o `KERNEL_VERSION`: o ponto `document.template` é forma nova de pacote
  // instalado, e um kernel que não o declara descartaria a contribuição.
  'DOCUMENT_EXTENSION_POINTS', 'DOCUMENT_OUTPUTS_BY_FORMAT', 'DOCUMENT_TEMPLATE_API_VERSION',
  'DOCUMENT_TEMPLATE_MAX_BYTES', 'DOCUMENT_TEMPLATE_POINT', 'documentTemplateContribution',
  'documentTemplateIssues', 'documentTemplateOf', 'parseTemplate', 'templateOutputs',
  // DIAS ÚTEIS. MOVE o `KERNEL_VERSION` (2.37.0): o ponto `time.business.calendar` é forma nova de
  // pacote instalado, e um kernel que não o declara descartaria a contribuição.
  'BUSINESS_CALENDAR_API_VERSION', 'BUSINESS_CALENDAR_FIELDS', 'BUSINESS_CALENDAR_POINT',
  'BUSINESS_DAYS_FUNCTION_NAMES', 'TIME_EXTENSION_POINTS', 'businessCalendarContribution',
  // O CARTÃO declarado da listagem (`ScreenModuleTemplate.cardTemplate`): o vocabulário dos nós, o
  // cartão padrão como ponto de partida, a leitura tolerante e o mesmo portão do `check`. MOVE o
  // `KERNEL_VERSION`: a chave nova na tela é forma nova de pacote instalado.
  'CARD_NODE_TYPES', 'DEFAULT_CARD_BODY', 'cardTemplateIssues', 'readCardTemplate',
].sort();

/**
 * Os TIPOS são a maior parte do que sai daqui, e `Object.keys` não os vê — eles não existem em tempo de
 * execução. Sem esta lista, remover um tipo do barril não quebraria teste nenhum e quebraria o
 * `plugin.ts` de quem já escreveu contra ele.
 */
const PUBLISHED_TYPES = [
  'BusinessCalendar', 'BusinessCalendarSource',
  'CardNode', 'CardNodeType', 'CardTemplate', 'CardTemplateIssue',
  'DocumentOutputFormat', 'DocumentTemplateDataset', 'DocumentTemplateFormat', 'DocumentTemplateIssue',
  'DocumentTemplateSpec', 'TemplateIssue', 'TemplateNode',
  'ReportAccess', 'ReportAggregateMeasure', 'ReportChart', 'ReportChartKind',
  'ReportComputedMeasure', 'ReportContributionMetadata', 'ReportDataset', 'ReportDatasetKind',
  'ReportDefinition', 'ReportDimension', 'ReportFieldPresentation', 'ReportGranularity',
  'ReportGroupKey', 'ReportGroupLevel', 'ReportMatrixShape', 'ReportMeasure',
  'ReportModuleTemplate', 'ReportPresentation', 'ReportPrompt', 'ReportResult', 'ReportRow',
  'ReportSchedule', 'ReportShape', 'ReportShapeKind', 'ReportSpec', 'ReportSpecIssue',
  'ReportSummaryShape', 'ReportTabularShape', 'ReportTotals', 'ReportValidationContext',
  'ReportValueFormat',
  'AuthProviderFlow', 'AuthProviderKind', 'AuthProviderMetadata', 'AuthProviderSpec',
  'AccessPermission', 'AccessRequirement', 'CatalogPermission', 'CrudAction', 'DeclaredPermission', 'DeclaredRequirement', 'ParsedAccessPermission', 'PermissionCatalog', 'PermissionResource', 'ResolvedPermissions', 'ResourceLabel',
  'ActionDefinition', 'ActionLocalCommand', 'ActionModuleTemplate', 'ActionOutcome', 'AggregationOp',
  'ArtifactRef',
  'AuthoredPlugin',
  'AuthoredView', 'BackendPrerequisite', 'CapabilityProvision', 'CapabilityRequirement', 'Condition',
  'Contribution', 'CustomFieldMask', 'CustomFieldOption', 'CustomFieldType', 'CustomFieldValue',
  'DiagnosticCode',
  'DiagnosticSeverity', 'EventInputMapping', 'ExpressionInputMapping', 'ExtensionPointDefinition',
  'FieldAggregation', 'FieldDefinition', 'FieldFileConfig', 'FieldLogic', 'FieldLookupBinding',
  'FieldOrigin', 'FieldRulePreset', 'FieldRulePresetMask', 'FieldRulePresetValidate', 'FieldRules',
  'FirestoreIndexField', 'FirestoreIndexSpec', 'FormatOp', 'FormatRule', 'ImplKind', 'ImplRef',
  'InputMapping',
  'LiteralInputMapping', 'LocaleCode', 'LookupModuleTemplate', 'LookupProviderFailure',
  'LookupProviderRequest', 'LookupProviderSpec', 'MarketplacePlugin', 'MessageBundle', 'MessageParams',
  'MigrationPhase', 'NotificationCategoryMetadata', 'NumericAggregationOp', 'OutputInputMapping', 'PackageRef', 'PackageValidationIssue', 'ParsePackageResult',
  'ParsedPermission', 'PermissionDomain', 'PluginBackendRequirement', 'PluginDiagnostic',
  'PluginDependency',
  'PluginLifecycle', 'PluginLifecycleHook', 'PluginManifest', 'PluginMigration', 'PluginPublisher', 'PortalViewMetadata', 'PortalViewSurface',
  'QueryOperator', 'QueryOrderBy', 'QueryPredicate', 'QuerySpec', 'RecordKeyKind', 'RecordTabProps', 'RecordKeyNormalization',
  'RecordKeyScope', 'RecordKeySpec', 'RecordKeyStatus', 'RefKind', 'ScreenListAction',
  'ScreenModuleTemplate', 'ScreenPatchTemplate', 'Script', 'ScriptModuleTemplate', 'ScriptOutputParam',
  'SdkIssue', 'SemVer', 'SettingsOptionsSource', 'SettingsOptionsSourceKind', 'SettingsProperty', 'SettingsPropertyOption', 'SettingsPropertyType',
  'SettingsScope', 'SettingsSection', 'StepType', 'TemplateField', 'ThemeBase', 'ThemeSpec',
  'CatalogStepType', 'DynamicInputsMetadata', 'DynamicOutputsMetadata', 'InputDefinition',
  'InputMappingKind', 'InputOptionsSource', 'InputType', 'OutputDefinition', 'StepCategory',
  'WorkflowStepMetadata', 'MapFieldMapping', 'MapStepConfig', 'RemoveStepConfig', 'UpsertSpec',
  'UpsertStepConfig', 'ValidateStepConfig',
  'ThemeTagColor', 'ThemeTokenBundle', 'TranslateFn', 'UiCommandMetadata', 'UiMenuAction',
  'UiMenuItemMetadata', 'UiNavBadge', 'UiNavGroupMetadata',
  'UiNavMetadata', 'UiNavTarget', 'UiPageMetadata', 'UiRecordActionMetadata', 'UiSlotMetadata', 'UiTabMetadata',
  'UiWidgetMetadata',
  'ValidateManifestOptions', 'ValidateRule', 'VariableInputMapping', 'ViewModuleTemplate',
  'WidgetNodeType',
  'WidgetSpec', 'WorkflowDefinition', 'WorkflowLoopConfig', 'WorkflowModuleTemplate',
  'WorkflowParameter', 'WorkflowParameterType', 'WorkflowStep', 'WorkflowStepBranches',
  // Modelo de domínio — ver a nota na lista de runtime.
  'ArtifactPlan', 'CatalogEntity', 'CatalogField', 'CatalogList', 'CatalogScreenInput', 'DerivedFrom',
  'DomainAggregation', 'DomainCatalog', 'DomainDenormalization', 'DomainEntity', 'DomainField',
  'DomainIssue', 'DomainIssueCode', 'DomainModel', 'DomainRelationship', 'DomainSeverity',
  'DomainValidation', 'EntityKind', 'MappedRelationship', 'Ownership', 'ParentRelation', 'ParseResult',
  'PlanOperation', 'PlannedField', 'PlannedLookup', 'PlannedMigration', 'PlannedScreen',
  'RelationshipStorage', 'RelationshipType', 'SemanticType', 'StorageMechanism',
  // Modelo de comportamento — ver a nota na lista de runtime.
  'BehaviorConcern', 'BehaviorEffect', 'BehaviorGuard', 'BehaviorInvariant', 'BehaviorMechanism',
  'BehaviorModel', 'BehaviorState', 'BehaviorStateOption', 'BehaviorTransition', 'BehaviorTrigger',
  'BehaviorValidation', 'EffectKind', 'InvariantEnforcement', 'InvariantScope', 'MappedTransition',
  'TransitionFromCheck', 'TriggerKind',
  // O fecho do pipeline — ver a nota na lista de runtime.
  'ActionPlacement', 'ArtifactPlanOptions', 'BusinessRule', 'CoverageItem', 'CoverageSummary',
  'CoverageSurface', 'EntityTab', 'EntityTabKind', 'LedgerProduced', 'NotAScreen',
  'ParsedBusinessRule', 'PlanTrace', 'PlannedDeactivation', 'PlannedFormSection', 'PlannedListColumn',
  'PlannedReadOnlyField', 'PlannedRecordAction', 'PlannedReferenceField', 'PlannedTab', 'RuleDelta',
  'RuleLedger', 'RuleLedgerEntry', 'ScreenLayout', 'ScreenPlan', 'ScreenPlanInput', 'ScreenPlanRule',
  'ScreenPresence',
  // A identidade universal da tela — ver a nota na lista de runtime.
  'LedgerIntegrity', 'LedgerReality', 'ScreenSourceIdOrigin',
  // O esquema das irmãs — ver a nota na lista de runtime.
  'ScreenSourcePackage', 'UndeclaredPath',
].sort();

const BARREL = import.meta.glob('/src/sdk/index.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
})['/src/sdk/index.ts'] as string;

describe('a superfície publicada do SDK', () => {
  it('é exatamente a lista declarada — nem um símbolo a mais, nem a menos', () => {
    expect(Object.keys(sdk).sort()).toEqual(PUBLISHED);
  });

  /**
   * O SDK viaja junto com o pacote do kernel, e é o `KERNEL_VERSION` que amarra os dois: um autor que
   * escreveu contra `^1.4.0` precisa saber se o que ele usa continua valendo.
   */
  it('publica a versão do contrato Kernel↔plugins', () => {
    expect(sdk.KERNEL_VERSION).toBe(KERNEL_VERSION);
    expect(sdk.KERNEL_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('exporta exatamente os tipos declarados', () => {
    const exported = [...BARREL.matchAll(/export type \{([^}]*)\}/gs)]
      .flatMap((match) => match[1].split(','))
      .map((name) => name.trim())
      .filter((name) => name !== '')
      .sort();
    expect([...new Set(exported)]).toEqual(PUBLISHED_TYPES);
  });

  it('o barril é uma LISTA, nunca um `export *` — é ele que decide o que sai daqui', () => {
    const statements = BARREL.split('\n').filter((line) => line.startsWith('export'));
    expect(statements.filter((line) => /^export\s+\*/.test(line))).toEqual([]);
    expect(statements.length).toBeGreaterThan(10);
  });

  /** Um construtor de contribuição que não existisse tornaria o barril uma promessa vazia. */
  it('todo construtor de contribuição é chamável', () => {
    for (const name of ['page', 'nav', 'command', 'recordAction', 'settingsSection', 'widgetPage',
      'surfaceTab', 'surfaceTabSpec', 'surfaceWidget', 'surfaceWidgetSpec', 'surfaceSlot',
      'surfaceSlotSpec', 'menuItem', 'navGroup', 'authProvider', 'pointContribution', 'portalView', 'notificationCategory']) {
      expect(typeof (sdk as unknown as Record<string, unknown>)[name], name).toBe('function');
    }
  });
});
