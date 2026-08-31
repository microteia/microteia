// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/plugin/index.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

export type { ArtifactRef } from './artifactRef';
export {
  ARTIFACT_REF_SEPARATOR,
  MAX_ARTIFACT_ID_LENGTH,
  artifactRef,
  hasRefSeparator,
  isArtifactId,
  isArtifactRef,
  parseArtifactRef,
} from './artifactRef';

export type {
  BackendPrerequisite,
  FirestoreIndexField,
  FirestoreIndexSpec,
  PluginBackendRequirement,
} from './backendRequirement';
export {
  backendFingerprint,
  hasBackendRequirement,
  validateBackendRequirement,
} from './backendRequirement';

export type {
  CapabilityProvision,
  CapabilityRequirement,
  ResolvedProvider,
} from './capability';
export {
  DEFAULT_CAPABILITY_PRIORITY,
  isValidCapabilityId,
  provisionPriority,
  selectProvider,
  validateProvisions,
  validateRequirements,
} from './capability';

export type {
  Contribution,
  ImplRef,
  QualifiedContribution,
  ValidateContributionOptions,
} from './contribution';
export {
  DEFAULT_CONTRIBUTION_PRIORITY,
  compareContributions,
  contributionKey,
  contributionPriority,
  findDuplicateContributions,
  implKindOf,
  isValidContributionId,
  sortContributions,
  validateContribution,
} from './contribution';

export type {
  DiagnosticCode,
  DiagnosticInput,
  DiagnosticSeverity,
  PluginDiagnostic,
} from './diagnostics';
export { error, errorsOf, hasErrors, warning, withPlugin } from './diagnostics';

export type { ExtensionPointDefinition, ImplKind } from './extensionPoint';
export {
  IMPL_KINDS,
  THIRD_PARTY_IMPL_KINDS,
  isApiVersionCompatible,
  isTrustedOnlyImplKind,
  isValidExtensionPointId,
  validateExtensionPoint,
} from './extensionPoint';

export { KERNEL_PLUGIN_ID, KERNEL_VERSION } from './kernelVersion';

export type { MigrationPhase, PluginMigration } from './migration';
export {
  DEFAULT_MIGRATION_MAX_ROUNDS,
  MIGRATION_ID_MAX_LENGTH,
  MIGRATION_ID_PATTERN,
  MIGRATION_PHASES,
  isMigrationRequired,
  migrationMaxRounds,
  migrationPhaseOf,
  migrationRunsOnInstall,
  sortMigrations,
  validateMigrations,
} from './migration';

export type { ParsedPermission, PermissionDomain } from './permission';
export {
  PERMISSION_DOMAINS,
  PERMISSION_DOMAIN_LABELS,
  isPermitted,
  isValidPermission,
  parsePermission,
  permissionCovers,
  validatePermissions,
} from './permission';

export type {
  PluginDependency,
  PluginLifecycle,
  PluginLifecycleHook,
  PluginManifest,
  PluginPublisher,
  ValidateManifestOptions,
} from './pluginManifest';
export {
  dependencyCollections,
  dependencyRange,
  isKernelCompatible,
  isValidPluginId,
  validatePluginManifest,
} from './pluginManifest';

export type { RangeComparator, RangeOperator, SemVer } from './semver';
export {
  compareSemVer,
  isValidRange,
  isValidSemVer,
  maxSatisfying,
  parseComparator,
  parseRange,
  parseSemVer,
  satisfiesRange,
} from './semver';
