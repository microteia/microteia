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
  PERMISSION_AGENT_MANAGE,
  PERMISSION_AI_MANAGE,
  PERMISSION_AUDIT_READ,
  PERMISSION_AUDIT_MANAGE,
  PERMISSION_AUTOMATION_MANAGE,
  PERMISSION_AUTOMATION_RUN,
  PERMISSION_DATA_PROCESSOR_USE,
  PERMISSION_DOCUMENT_TYPES_MANAGE,
  PERMISSION_EXTENSIONS_MANAGE,
  PERMISSION_MEMBERS_MANAGE,
  PERMISSION_REPORTS_MANAGE,
  PERMISSION_DOCUMENT_TEMPLATES_MANAGE,
  PERMISSION_DOWNLOADS_MANAGE,
  PERMISSION_DOCUMENTS_GENERATE,
  PERMISSION_PORTAL_MANAGE,
  PERMISSION_PORTAL_ACTIVITY,
  PERMISSION_ROLES_MANAGE,
  PERMISSION_SCREENS_MANAGE,
  PERMISSION_SETTINGS_MANAGE,
  PERMISSION_TENANT_UPDATE,
  PERMISSION_TENANT_PREFIX_MANAGE,
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
export { requiredBySelection, withDependencies } from './permissionSelection';

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
