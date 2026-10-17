// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/plugins/messages/coreAccess.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

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
  'diagnostic.requirement.cycle':
    'The added dependency of "{id}" on "{required}" was ignored, because "{required}" already depends on "{id}".',
  'diagnostic.requirement.id.invalid':
    'The added dependency points at "{id}", which is not a valid permission identifier.',
  'diagnostic.requirement.not-object': 'The added dependency is not an object.',
  'diagnostic.requirement.requires.invalid':
    'The dependencies added to the permission "{id}" must be a non-empty list of permission identifiers.',
  'diagnostic.requirement.requires.malformed':
    'The dependency "{required}" added to the permission "{id}" is not a valid identifier.',
  'diagnostic.requirement.requires.self':
    'The permission "{id}" cannot be given a dependency on itself.',
  'diagnostic.requirement.target.unknown':
    'A dependency was added to the permission "{id}", which does not exist. The addition was ignored.',
  'diagnostic.requirement.unknown':
    'The dependency "{required}" added to the permission "{id}" does not exist, so it was ignored — "{id}" keeps working as it did before.',
  'agent.tab': 'AI agents',
  'agent.title': 'AI agent access',
  'agent.description':
    'An access lets an AI agent work in this organization on your behalf — search records, register '
    + 'them, change them, run a report. It can never do more than you can, and you can revoke it at '
    + 'any time.',
  'agent.banner.disabled':
    'AI agent access is not enabled in this organization. Install "AI Agent Access" from the '
    + 'Marketplace to turn it on.',
  'agent.banner.pending':
    'The extension is installed, but the Firebase project has not been provisioned yet, so the '
    + 'endpoint is not in the air. Whoever administers the project has to run "microteia provision".',
  'agent.endpoint.label': 'Connection address',
  'agent.endpoint.hint':
    'This is the address the AI client connects to. Clients that can sign in — Claude on the web '
    + 'among them — ask only for this address, and each person signs in with their own account. A '
    + 'client that takes a fixed token instead sends it in the Authorization header, and you get '
    + 'that token when you issue an access below.',
  'agent.meta.signed-in-as': 'signed in from {client}',
  'agent.empty': 'No access issued yet.',
  'agent.action.issue': 'Issue access',
  'agent.action.revoke': 'Revoke',
  'agent.state.active': 'Active',
  'agent.state.revoked': 'Revoked',
  'agent.state.expired': 'Expired',
  'agent.meta.expires': 'expires on',
  'agent.meta.last-used': 'last used on',
  'agent.meta.never-used': 'never used',
  'agent.meta.of-another': 'of another member',
  'agent.form.title': 'Issue an AI agent access',
  'agent.form.name': 'Name',
  'agent.form.name.placeholder': 'Claude on my laptop',
  'agent.form.name.hint': 'It is how you recognise this access later, to revoke the right one.',
  'agent.form.permissions': 'Permissions this access may use',
  'agent.form.permissions.placeholder': 'Choose the permissions...',
  'agent.form.permissions.hint':
    'Only the permissions you hold are offered. Choose the fewest that get the job done: the access '
    + 'can do everything you release to it, and nothing else.',
  'agent.form.expiry': 'Validity',
  'agent.form.cancel': 'Cancel',
  'agent.form.confirm': 'Issue',
  'agent.form.issuing': 'Issuing...',
  'agent.expiry.30': '30 days',
  'agent.expiry.90': '90 days',
  'agent.expiry.365': '1 year',
  'agent.expiry.never': 'No expiry',
  'agent.issued.title': 'Access issued',
  'agent.issued.once':
    'Copy the token now: it is shown this one time and cannot be recovered. If you lose it, issue '
    + 'another one and revoke this.',
  'agent.issued.token': 'Access token',
  'agent.issued.copy': 'Copy token',
  'agent.issued.done': 'Done',
  'agent.issued.command': 'To connect Claude Code',
  'agent.issued.command.hint': 'Run this in a terminal. Other AI clients ask for the address and the token separately.',
  'agent.token.copied': 'Token copied to the clipboard.',
  'agent.revoke.title': 'Revoke this access?',
  'agent.revoke.message':
    'The access "{name}" stops working immediately, and no AI agent using it can reach this '
    + 'organization any more. This cannot be undone — issue a new access if you need one again.',
  'agent.revoke.failed': 'The access could not be revoked. Try again.',
  'agent.expiry.invalid': 'The validity has to be between 1 and 366 days.',
  'agent.grant.required': 'Say which access is to be revoked.',
  'agent.name.required': 'Give the access a name, so it can be recognised later.',
  'agent.nothing-to-grant':
    'You hold no permissions in this organization, so an access issued here would grant nothing.',
  'agent.not-enabled': 'AI agent access is not enabled for this organization.',
  'agent.permission.unknown': 'The permission "{permission}" does not exist in this organization.',
  'agent.permissions.required': 'Choose at least one permission for the access.',
  'agent.permissions.unrestricted':
    'An access cannot be granted everything: list the permissions it may use, so they can be reviewed later.',
  'agent.token.failed': 'The access could not be issued. Try again.',
  'permission.picker.search': 'Search a screen or a permission...',
  'permission.picker.selected': '{selected} of {total} chosen',
  'permission.picker.group-count': '{selected}/{total}',
  'permission.picker.select-all': 'Select all',
  'permission.picker.select-matches': 'Select matches',
  'permission.picker.clear': 'Clear',
  'permission.picker.no-matches': 'Nothing matches that search.',
  'permission.picker.nothing-to-offer':
    'You hold no permissions in this organization, so there is nothing to allow here.',
  'permission.picker.included-by': 'Included because you chose {by}.',
  'permission.picker.missing-for':
    '{by} needs this one to work fully. Leave it off only if you meant the narrower access.',
  'agent.oauth.title': 'Authorize {client}',
  'agent.oauth.intro':
    '{client} is asking to work inside {tenant} on your behalf. It will be able to do only what you '
    + 'allow below, and never more than you can do yourself.',
  'agent.oauth.returns-to': 'It returns to {host} when you are done.',
  'agent.oauth.loopback':
    'This client runs on your own computer. Any program on this machine could claim to be it, so '
    + 'only continue if you started the connection yourself.',
  'agent.oauth.tenant': 'Organization',
  'agent.oauth.tenant.hint':
    'The access is for this organization only. Switch organizations first if you meant another one.',
  'agent.oauth.allow': 'Authorize',
  'agent.oauth.deny': 'Cancel',
  'agent.oauth.working': 'Authorizing...',
  'agent.oauth.denied': 'Authorization cancelled. You can close this page.',
  'agent.oauth.request.missing': 'This page was opened without an authorization request.',
  'agent.oauth.request.unknown': 'This authorization request no longer exists. Start again from the client.',
  'agent.oauth.request.expired': 'This authorization request has expired. Start again from the client.',
  'agent.oauth.request.used': 'This authorization request has already been answered.',
  'agent.input.unknown': 'Unknown argument "{path}". Accepted here: {accepted}.',
  'agent.input.unknown-none': 'Unknown argument "{path}". Nothing else is accepted here.',
  'agent.input.missing': 'Missing required argument "{path}".',
  'agent.input.type': '"{path}" must be of type {expected}.',
  'agent.input.enum': '"{path}" must be one of: {allowed}.',
  'agent.input.minimum': '"{path}" must be at least {limit}.',
  'agent.input.maximum': '"{path}" must be at most {limit}.',
  'agent.query.in-needs-list': 'The "in" operator needs a list of values at "{path}".',
  'agent.params.unknown': 'Unknown parameters: {unknown}. This automation accepts: {accepted}.',
  'agent.params.unknown-none': 'Unknown parameters: {unknown}. This automation declares no parameters.',
  'agent.prompts.unknown': 'Unknown report filters: {unknown}. This report accepts: {accepted}.',
  'agent.prompts.unknown-none': 'Unknown report filters: {unknown}. This report declares no filters.',
  'agent.prompts.required': 'The report filter "{label}" ({key}) is required.',
  'agent.run.not-found': 'No automation was started with the event id "{eventId}".',
  'agent.audit.date-invalid': '"{path}" is not a date: send "YYYY-MM-DD" or an ISO-8601 timestamp.',
  'agent.document.not-enabled':
    'The screen "{collection}" has no Documents tab, so its records do not take attachments.',
  'agent.document.name-invalid': 'Give the file a name with its extension, for example "contract.pdf".',
  'agent.document.content-invalid': '"content" is not valid base64.',
  'agent.document.empty': 'The file is empty.',
  'agent.document.too-large': 'The file has {size} MB, and files must be smaller than {limit} MB.',
  'agent.document.type-unknown': 'Unknown document type "{type}". Accepted: {accepted}.',
  'agent.document.upload-failed': 'The file could not be stored. Try again.',
  'permission.agent.manage': 'Manage AI agent access',
  'permission.agent.manage.description':
    'See and revoke the AI agent access of every member. Issuing an access for oneself does not need this.',
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
  /**
   * As duas recusas que a superfície de servidor de uma extensão faz antes de qualquer coisa: quem
   * chamou não entrou, ou entrou e não é deste escritório. A segunda é a que fecha o buraco de verdade —
   * uma callable no ar aceita o token de QUALQUER usuário do projeto, e o escritório vem no payload.
   */
  'office.unauthenticated': 'Authentication required.',
  'office.not-member': 'You are not a member of this organization.',
  'permission.document-types.manage': 'Manage document types',
  'permission.document-types.manage.description':
    'Create, edit and remove the document types that records can attach files under.',
  'permission.extensions.manage': 'Manage extensions',
  'permission.extensions.manage.description':
    'Install, update, activate and remove extensions in the organization.',
  'permission.document-templates.manage': 'Manage document templates',
  'permission.document-templates.manage.description':
    'Create, edit and remove the document templates of the organization, and customize or turn off the ones extensions bring. Generating a document from a record still requires being able to edit that record to attach it, or to read it to save it to Downloads.',
  'permission.downloads.manage': 'Manage downloads',
  'permission.documents.generate': 'Generate documents from data',
  'permission.documents.generate.description':
    'Generate documents from templates that take their data from whoever generates them — an automation, an AI agent — instead of from a record. The file goes to Downloads; records the data points to still require permission to read them.',
  'permission.downloads.manage.description':
    'See and delete every file in Downloads, including the ones other people generated and the ones automations generated for managers only.',
  'permission.members.manage': 'Manage members',
  'permission.members.manage.description':
    'Add and remove people from the organization, and choose the access profiles of each one.',
  'permission.reports.manage': 'Manage reports',
  'permission.reports.manage.description':
    'Create, edit and remove the reports of the organization. Reading each collection a report covers is still required to run it.',
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
  'point.requirement.description':
    'A dependency added to a permission declared elsewhere, or derived from a screen, so that reading it also grants what a complementary extension needs.',
  'point.requirement.title': 'Added permission dependency',
  'point.resource.title': 'Permission resource',
  'resource.agent': 'AI agents',
  'resource.ai': 'Artificial intelligence',
  'resource.audit': 'Audit trail',
  'resource.automation': 'Automations',
  'resource.data-processor': 'Data Processor',
  'resource.document-types': 'Document types',
  'resource.extensions': 'Extensions',
  'resource.members': 'Members',
  'resource.reports': 'Reports',
  'resource.document-templates': 'Document templates',
  'resource.downloads': 'Downloads',
  'resource.documents': 'Documents',
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
  'role.identifier.hint': 'The identifier to use in hasPermission(\'…\') inside an expression',
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
  'role.system.locked': 'This profile is controlled by the system and cannot be changed here.',
  'role.system.protected':
    'This access profile is controlled by the system and cannot be changed or deleted.',
  'role.edit': 'Edit access profile',
  'role.granted.more': '+{count}',
  'role.granted.none': 'No profile',
  'role.panel.manage': 'Access profiles',
  'role.panel.roles': 'Profiles that grant it',
  'role.permissions.hint': 'The permissions of a profile are chosen in the list, by clicking a permission.',
};
