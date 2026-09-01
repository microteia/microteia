// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/access/index.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

export type {
  AccessPermission,
  AccessRequirement,
  CrudAction,
  ParsedAccessPermission,
} from './permission';
export {
  CRUD_ACTIONS,
  collectionPermissionId,
  isValidAccessPermissionId,
  parseAccessPermission,
  validateAccessPermission,
  validateAccessRequirement,
} from './permission';

export {
  ACCESS_API_VERSION,
  ACCESS_EXTENSION_POINTS,
  ACCESS_PERMISSION_POINT,
  ACCESS_REQUIREMENT_POINT,
  ACCESS_RESOURCE_POINT,
  accessPermissionContribution,
  accessPermissionOf,
  accessRequirementContribution,
  accessResourceContribution,
  declaredPermissionsOf,
  declaredRequirementsOf,
  declaredResourcesOf,
} from './extensionPoints';

export { KERNEL_CATALOG_FINGERPRINT } from './catalogFingerprint';

export {
  KERNEL_PERMISSIONS,
  KERNEL_PERMISSION_RESOURCES,
  PERMISSION_AI_MANAGE,
  PERMISSION_AUDIT_READ,
  PERMISSION_AUTOMATION_MANAGE,
  PERMISSION_AUTOMATION_RUN,
  PERMISSION_DATA_PROCESSOR_USE,
  PERMISSION_DOCUMENT_TYPES_MANAGE,
  PERMISSION_EXTENSIONS_MANAGE,
  PERMISSION_MEMBERS_MANAGE,
  PERMISSION_ROLES_MANAGE,
  PERMISSION_SCREENS_MANAGE,
  PERMISSION_SETTINGS_MANAGE,
  PERMISSION_TENANT_UPDATE,
  PERMISSION_TRANSLATIONS_MANAGE,
} from './kernelPermissions';

export type {
  CatalogPermission,
  DeclaredPermission,
  DeclaredRequirement,
  PermissionCatalog,
  PermissionResource,
  ResolvedPermissions,
  ResourceLabel,
} from './resolvePermissions';
export { buildPermissionCatalog, dependenciesOf, resolveEffective } from './resolvePermissions';

export type { AssignedRole, MemberPermissions } from './memberPermissions';
export {
  UNRESTRICTED_PERMISSION,
  explicitPermissionsOf,
  grants,
  grantsAll,
  grantsAny,
  isUnrestricted,
  memberPermissions,
} from './memberPermissions';

export {
  ambientEntity,
  ambientPermissions,
  resetAmbientPermissions,
  setAmbientEntity,
  setAmbientPermissions,
} from './permissionGate';

export { ENTITY_PLACEHOLDER, matchesPermission } from './permissionPattern';
