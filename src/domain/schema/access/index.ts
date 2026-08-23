export type { AccessPermission, CrudAction, ParsedAccessPermission } from './permission';
export {
  CRUD_ACTIONS,
  collectionPermissionId,
  isValidAccessPermissionId,
  parseAccessPermission,
  validateAccessPermission,
} from './permission';

export {
  ACCESS_API_VERSION,
  ACCESS_EXTENSION_POINTS,
  ACCESS_PERMISSION_POINT,
  ACCESS_RESOURCE_POINT,
  accessPermissionContribution,
  accessPermissionOf,
  accessResourceContribution,
  declaredPermissionsOf,
  declaredResourcesOf,
} from './extensionPoints';

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
  PermissionCatalog,
  PermissionResource,
  ResolvedPermissions,
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
  ambientPermissions,
  resetAmbientPermissions,
  setAmbientPermissions,
} from './permissionGate';
