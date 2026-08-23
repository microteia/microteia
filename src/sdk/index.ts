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
  Contribution,
  ImplKind,
  ImplRef,
  ExtensionPointDefinition,
  PluginBackendRequirement,
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
  UiCommandMetadata,
  UiNavBadge,
  UiNavMetadata,
  UiPageMetadata,
  UiRecordActionMetadata,
  UiTabMetadata,
  UiWidgetMetadata,
} from '../domain/schema/ui/uiExtensionPoints';

export {
  UI_API_VERSION,
  UI_COMMAND_POINT,
  UI_EXTENSION_POINTS,
  UI_NAV_POINT,
  UI_PAGE_POINT,
  UI_RECORD_ACTION_POINT,
  UI_SETTINGS_POINT,
  UI_TAB_POINT,
  UI_WIDGET_POINT,
} from '../domain/schema/ui/uiExtensionPoints';

export type { WidgetNodeType, WidgetSpec } from '../domain/schema/ui/widgetSpec';
export { WIDGET_NODE_TYPES, isWidgetSpec, widgetChildren } from '../domain/schema/ui/widgetSpec';

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
  themeTokensContribution,
} from '../domain/schema/theme';

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

// ─── Dados: campos, telas e configuração ──────────────────────────────────────

export type {
  CustomFieldMask,
  CustomFieldOption,
  CustomFieldType,
  FieldDefinition,
  FieldOrigin,
  ScreenListAction,
} from '../domain/entities';

export type {
  SettingsProperty,
  SettingsPropertyOption,
  SettingsPropertyType,
  SettingsScope,
  SettingsSection,
} from '../domain/schema/settings';
export { SETTINGS_SCOPES } from '../domain/schema/settings';

// ─── Construtores de contribuição ─────────────────────────────────────────────

export {
  command,
  nav,
  page,
  pointContribution,
  recordAction,
  settingsSection,
  surfaceTab,
  surfaceTabSpec,
  surfaceWidget,
  surfaceWidgetSpec,
  widgetPage,
} from './contributions';

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

export type { SdkIssue } from './validate';
export { validatePluginPackage } from './validate';
