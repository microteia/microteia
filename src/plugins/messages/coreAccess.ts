/** Os textos do controle de acesso: o catálogo de permissões, os perfis e os diagnósticos deles. */
export const CORE_ACCESS_MESSAGES: Record<string, string> = {
  'action.create': 'Create',
  'action.delete': 'Delete',
  'action.read': 'View',
  'action.update': 'Edit',
  'diagnostic.permission.cycle':
    'The permissions depend on each other in a loop ({path}), so none of them can be granted.',
  'diagnostic.permission.duplicate':
    'The permission "{id}" was declared more than once. Only the first declaration is used.',
  'diagnostic.permission.id.invalid':
    'The permission identifier "{id}" is invalid. Use the form resource.action, such as finance.read.',
  'diagnostic.permission.name.missing': 'The permission "{id}" has no name.',
  'diagnostic.permission.not-object': 'The permission is not an object.',
  'diagnostic.permission.requires.invalid':
    'The dependencies of the permission "{id}" must be a list of permission identifiers.',
  'diagnostic.permission.requires.malformed':
    'The permission "{id}" depends on "{required}", which is not a valid identifier.',
  'diagnostic.permission.requires.self': 'The permission "{id}" cannot depend on itself.',
  'diagnostic.permission.requires.unknown':
    'The permission "{id}" depends on "{required}", which does not exist.',
  'diagnostic.permission.unknown': 'The permission "{id}" does not exist.',
  'permission.ai.manage': 'Manage AI connections',
  'permission.ai.manage.description':
    'Register, edit and remove the artificial intelligence connections of the organization.',
  'permission.audit.read': 'Read the audit trail',
  'permission.audit.read.description': 'See everything that was created, changed and deleted in the organization.',
  'permission.automation.manage': 'Manage automations',
  'permission.automation.manage.description':
    'Create, edit and delete automations, scripts and the actions shown on the screens.',
  'permission.automation.run': 'Run automations',
  'permission.automation.run.description': 'Trigger an automation, an action or a script by hand.',
  'permission.data-processor.use': 'Use the Data Processor',
  'permission.data-processor.use.description': 'Import and transform data in bulk.',
  'permission.denied': 'You do not have permission to do this ({permission}).',
  'permission.document-types.manage': 'Manage document types',
  'permission.document-types.manage.description':
    'Create, edit and remove the document types that records can attach files under.',
  'permission.extensions.manage': 'Manage extensions',
  'permission.extensions.manage.description':
    'Install, update, activate and remove extensions in the organization.',
  'permission.members.manage': 'Manage members',
  'permission.members.manage.description':
    'Add and remove people from the organization, and choose the access profiles of each one.',
  'permission.roles.manage': 'Manage access profiles',
  'permission.roles.manage.description':
    'Create, edit and delete access profiles, and choose which permissions each one grants.',
  'permission.screens.manage': 'Manage screens',
  'permission.screens.manage.description':
    'Create and change screens, fields and option lists in Form Design.',
  'permission.settings.manage': 'Change the organization settings',
  'permission.settings.manage.description':
    'Set the defaults that apply to everyone in the organization.',
  'permission.tenant.update': 'Change the organization record',
  'permission.tenant.update.description': 'Edit the name, the logo and the other data of the organization.',
  'permission.translations.manage': 'Manage translations',
  'permission.translations.manage.description': 'Change the texts of the interface for the organization.',
  'point.permission.description':
    'A capability of the system, declared by whoever implements it and grouped into access profiles by the organization.',
  'point.permission.title': 'Permission',
  'point.resource.description':
    'The label of a resource that permissions act on, when it is not a screen collection.',
  'point.resource.title': 'Permission resource',
  'resource.ai': 'Artificial intelligence',
  'resource.audit': 'Audit trail',
  'resource.automation': 'Automations',
  'resource.data-processor': 'Data Processor',
  'resource.document-types': 'Document types',
  'resource.extensions': 'Extensions',
  'resource.members': 'Members',
  'resource.roles': 'Access profiles',
  'resource.screens': 'Screens',
  'resource.settings': 'Settings',
  'resource.tenant': 'Organization',
  'resource.translations': 'Translations',
  'role.count': '{count} access profiles',
  'role.delete-failed': 'Could not delete the access profile.',
  'role.delete.message':
    'Delete the access profile "{name}"? Everyone who has it loses what it granted.',
  'role.delete.title': 'Delete access profile',
  'role.deleted': 'Access profile deleted.',
  'role.description': 'Description',
  'role.description.placeholder': 'What this profile is for…',
  'role.empty': 'No access profile yet. Create the first one to start granting access.',
  'role.included-by': 'Included by: {names}',
  'role.includes': 'Includes automatically: {names}',
  'role.manage-only': 'Only who manages access profiles can open this tab.',
  'role.name': 'Name',
  'role.name.placeholder': 'Finance, Reception…',
  'role.name.required': 'The access profile needs a name.',
  'role.new': 'New profile',
  'role.permission-count': '{count} permissions',
  'role.qualified-name': '{action} — {resource}',
  'role.save-failed': 'Could not save the access profile.',
  'role.saved': 'Access profile saved.',
  'role.search.none': 'No permission matches this search.',
  'role.search.placeholder': 'Filter permissions…',
  'role.summary': '{explicit} chosen, {effective} in effect',
  'role.sync': 'Recalculate permissions',
  'role.sync.done': 'Permissions recalculated. {count} members updated.',
  'role.sync.failed': 'Could not recalculate the permissions.',
  'role.sync.hint': 'Reapplies the profiles to every member. Needed after a system update that changes what a permission depends on.',
  'role.sync.running': 'Recalculating…',
  'role.system.locked': 'This profile is controlled by the system and cannot be changed here.',
  'role.system.protected':
    'This access profile is controlled by the system and cannot be changed or deleted.',
};
