/** Os textos das extensões: catálogo, instalação e a tela de autoria. */
export const CORE_MARKETPLACE_MESSAGES: Record<string, string> = {
  'page.marketplace': 'Extensions',
  'page.plugin-author': 'Create extension',
  'page.plugin-author-edit': 'Edit extension',
  'nav.pending.one': '{count} extension needs attention',
  'nav.pending.other': '{count} extensions need attention',

  'author.template.view':
    'import { useCasePhases } from \'@microteia/data\';\n\nexport default function View() {\n  const phases = useCasePhases();\n  return (\n    <div style={{ padding: 16 }}>\n      My extension — {phases.length} phase(s) registered.\n    </div>\n  );\n}\n',
  'author.template.startup':
    '// import { Icon } from \'@microteia/ui\';\n\nexport default function startup(host) {\n  /*\n  // Example: register commands in the Command Palette (⌘K)\n  host.commands.register({\n    group: \'My Extension\',\n    getItems(query, ctx) {\n      const q = String(query || \'\').toLowerCase().trim();\n      if (!q) return [];\n      \n      // const icon = <Icon name="star" size={16} />;\n      const items = [];\n      \n      // Fixed command (e.g. "new item")\n      if (\'new extension item\'.indexOf(q) !== -1) {\n        items.push({\n          id: \'my-ext:new\',\n          title: \'New extension item\',\n          group: \'My Extension\',\n          // icon,\n          onSelect: () => {\n            ctx.openTab(\'my-screen:new\');\n            ctx.close();\n          }\n        });\n      }\n      \n      // Search over records (example: custom entities)\n      // for (const r of ctx.customRecords) {\n      //   if (r.screenKey === \'my-screen\' && r.title?.toLowerCase().indexOf(q) !== -1) {\n      //     items.push({\n      //       id: \'my-ext:\' + r.id,\n      //       title: r.title,\n      //       subtitle: \'My Extension\',\n      //       group: \'My Extension\',\n      //       icon,\n      //       onSelect: () => { ctx.openTab(\'my-screen:\' + r.id); ctx.close(); }\n      //     });\n      //   }\n      // }\n      \n      return items.slice(0, 9);\n    },\n  });\n  */\n\n  /*\n  // Example: register an @ mention in the chat\n  host.mentions.register({\n    key: \'my-mention\',\n    label: \'My Mention\',\n    description: \'Insert a link to an item of the extension\',\n    icon: \'star\',\n    search(query, ctx) {\n      const q = String(query || \'\').toLowerCase().trim();\n      \n      // Return the list of options for the user to pick from\n      // return ctx.customRecords\n      //   .filter((r) => r.screenKey === \'my-screen\' && r.title && (!q || r.title.toLowerCase().indexOf(q) !== -1))\n      //   .slice(0, 20)\n      //   .map((r) => ({\n      //     id: r.id,\n      //     title: r.title,\n      //     subtitle: \'My Extension\',\n      //     tabKey: \'my-screen:\' + r.id\n      //   }));\n      \n      return [];\n    },\n  });\n  */\n\n  // Optional: return a cleanup function to unregister when the extension unloads\n  // return () => {\n  //   // Cleanup if needed\n  // };\n}\n',
  'author.subtitle':
    'Package screens, actions, automations and scripts of your organization into an extension. Save it to My Extensions to edit later; publishing happens on the Extensions screen.',
  'author.admin-only': 'Only organization administrators can create extensions.',
  'author.download': 'Download .json',
  'author.saving': 'Saving…',
  'author.save-changes': 'Save changes',
  'author.save-to-mine': 'Save to My Extensions',
  'author.saved': '{name} saved to My Extensions.',
  'author.save-failed': 'Could not save: {detail}',
  'author.exported': 'Extension file generated.',
  'author.identification': 'Identification',
  'author.content': 'Content',
  'author.issues': 'Pending items',
  'author.dependencies':
    'This package points at artifacts of {list}, so it now requires those extensions: an office can '
    + 'only install it after installing them.',
  'author.dependencies.join': ', ',
  'author.id.locked': 'The identifier is fixed after creation.',
  'author.id.hint': 'Reverse DNS, at least two segments.',
  'author.field.name': 'Name',
  'author.field.version': 'Version',
  'author.field.summary': 'Summary',
  'author.field.summary.placeholder': 'What this extension adds to the organization.',
  'author.field.icon': 'Icon (optional)',
  'author.field.icon.placeholder': 'Choose an icon',
  'author.field.image': 'Image (optional)',
  'author.image.choose': 'Choose image',
  'author.image.replace': 'Replace image',
  'author.image.remove': 'Remove image',
  'author.image.hint': 'PNG, JPEG, WebP or SVG, up to {limit} KB. It is shown next to the name on the Extensions screen; without it, the icon is used.',
  'author.image.read-failed': 'Could not read the image: {detail}',
  'author.field.category': 'Category (optional)',
  'author.field.category.placeholder': 'Theme, Integration, Reports…',
  'author.field.description': 'Description (optional)',
  'author.startup': 'Startup code',
  'author.startup.edit': 'Edit the startup code',
  'author.startup.description':
    'Optional. It runs once when the extension is loaded in the organization and receives a host to register services — such as ⌘K commands and @ mentions. Export a (host) => cleanup? function as default.',
  'author.compile-error': 'Does not compile',
  'author.compile-error.detail': 'Does not compile: {error}',
  'author.group.empty': 'Nothing available.',
  'author.group.collapse': 'Collapse group',
  'author.group.expand': 'Expand group',
  'author.group.screen-patches': 'Fields and actions on existing screens',
  'author.option.locked': 'Required by another checked item',
  'author.option.carried': 'Embedded in this extension — click to remove',
  'author.option.required': 'Required',
  'author.option.included': 'Included',
  'author.code-views': 'Code screens',
  'author.code-views.empty': 'No code screen.',
  'author.view.add': 'Add screen',
  'author.view.remove': 'Remove screen',
  'author.view.title': 'Title',
  'author.view.key': 'Key (menu and address)',
  'author.view.untitled': 'Untitled',
  'author.view.fallback': 'code screen',
  'author.view.no-code': 'no code',
  'author.view.modal-title': 'Code screen — {name}',
  'author.preview.show': 'Preview alongside',
  'author.preview.hide': 'Hide preview',
  'author.preview.failed': 'Could not render the preview. Check the code.',
  'author.selected.one': '{count} item selected',
  'author.selected.other': '{count} items selected',
  'author.patch.fields': '{count} field(s)',
  'author.patch.actions': '{count} action(s)',
  'author.patch.join': ' and ',
  'author.patch.summary': '{parts} of yours',
  'author.kind.screen': 'the screen',
  'author.kind.lookup': 'the option list',
  'author.kind.action': 'the action',
  'author.kind.workflow': 'the automation',
  'author.kind.script': 'the script',
  'author.issue.view-key-required': 'The code screen "{label}" needs a key.',
  'author.issue.view-key-invalid': 'The key "{key}" is invalid: use lowercase letters, numbers and "-".',
  'author.issue.view-key-duplicated': 'The key "{key}" is repeated among the code screens.',
  'author.issue.view-title-required': 'A code screen needs a title.',
  'author.issue.view-compile': 'The code screen "{label}" does not compile: {error}.',
  'author.issue.startup-compile': 'The startup code does not compile: {error}.',
  'author.issue.external-ref':
    '{origin} "{source}" references {kind} "{name}", which is not in the package and is not covered by a declared dependency.',

  'author.field.id': 'Identifier',
  'author.field.id.placeholder': 'com.yourfirm.sales',
  'author.field.name.placeholder': 'Sales',
  'author.view.key.placeholder': 'my-screen',
  'extension.load-failed': 'Could not load this extension: {message}',
  'marketplace.subtitle':
    'Create and edit extensions in your private area, install them to use in the organization, and publish them to the catalog to share with other organizations.',
  'marketplace.admin-only':
    'Only organization administrators can create, install or publish extensions.',
  'marketplace.residue':
    '{count} backend artifact(s) in this Firebase project belong to extensions that nobody has '
    + 'installed any more: {functions} Cloud Function(s) and {indexes} database index(es). A callable '
    + 'left behind just sits there; a trigger does not — it keeps running on every change, with the '
    + 'code of an extension nobody has. Whoever maintains the project removes them with '
    + '"microteia provision --prune" in the Microteia Console.',
  'marketplace.residue.scanned':
    'Read from every organization in this project on {date}: {tenants} organization(s), {extensions} '
    + 'installed extension(s).',
  'marketplace.empty':
    'No extension yet. Use "Create extension", import a .json, or install one from the public catalog.',
  'marketplace.empty.filtered': 'No extension in this view.',
  'marketplace.empty.pending':
    'Nothing pending: every active extension is up to date, loaded and running.',
  'filter.all': 'All',
  'filter.installed': 'Installed',
  'filter.pending': 'Pending',
  'filter.mine': 'Mine',
  'filter.catalog': 'Catalog',
  'filter.compose.placeholder': 'Filter the extensions…',
  'filter.search.placeholder': 'Name, summary or identifier…',
  'filter.visibility': 'Visibility',
  'filter.installation': 'Installation',
  'filter.installation.yes': 'Installed',
  'filter.installation.no': 'Not installed',
  'filter.category.none': 'No category',
  'status.published': 'Published',
  'status.pending': 'Under review',
  'status.deprecated': 'Deprecated',
  'status.private': 'Private',
  'status.builtin': 'From the system',
  'status.system': 'Part of the system',
  'extension.details': 'See details',
  'extension.license': 'Licence terms',
  'extension.license.title': 'Licence terms of "{name}"',
  'extension.license.intro':
    'Terms written by whoever authored this extension. They add to the Microteia Terms of Use, and are reproduced in the organization’s Terms page while the extension is installed and active.',
  'extension.badge.active': 'Active',
  'extension.badge.inactive': 'Inactive',
  'extension.badge.failed': 'Did not load',
  'extension.badge.update': 'Update',
  'extension.installs.one': '{formatted} installation',
  'extension.installs.other': '{formatted} installations',
  'extension.rating.one': 'Rated {average} out of {max} by {formatted} person',
  'extension.rating.other': 'Rated {average} out of {max} by {formatted} people',
  'extension.verified.first-party': 'Published by Microteia — authenticity guaranteed by origin',
  'extension.verified.publisher': 'Verified publisher',
  'extension.verify-publisher': 'Mark the publisher as verified',
  'extension.unverify-publisher': 'Remove the publisher verification',
  'extension.publisher-verified': '{name} is now a verified publisher.',
  'extension.publisher-unverified': '{name} is no longer a verified publisher.',
  'extension.my-rating': 'Your rating',
  'extension.my-rating.hint': 'Your rating is shown to every organization that sees this extension. The average may take a few seconds to update.',
  'extension.rate.star.one': '{count} star',
  'extension.rate.star.other': '{count} stars',
  'extension.rated': 'Thank you — your rating was saved.',
  'extension.rating.clear': 'Remove my rating',
  'extension.rating.cleared': 'Your rating was removed.',
  'issue.package.image.invalid': 'The extension image (manifest.image) must be a base64 data: URI of a PNG, JPEG, WebP or SVG image. Web addresses are not accepted: the package must carry everything it shows.',
  'install.collision.screen': 'This extension was not installed: it creates the screen "{name}", and the organization already uses that name for a screen, an option list or a tag set. Nothing was changed.',
  'install.collision.list': 'This extension was not installed: it declares the list "{name}", which belongs to another extension or is the name of a screen. Nothing was changed.',
  'install.prefix-changed': 'This version changes the extension prefix from "{from}" to "{to}", which would rename everything it created. The prefix of an extension never changes: this version was not installed.',
  'issue.prefix.invalid': 'The extension prefix "{prefix}" is not valid. Use 2 to 8 lowercase letters or digits, starting with a letter: acme.',
  'issue.prefix.missing': 'The name "{name}" must start with "{head}": every name this extension creates carries its prefix.',
  'issue.package.image.too-large': 'The extension image is {size} KB; the limit is {limit} KB.',
  'sort.label': 'Sort by',
  'sort.relevance': 'Relevance',
  'sort.installs': 'Most installed',
  'sort.rating': 'Highest rated',
  'sort.name': 'Name',
  'author.imported-locked': 'Extension "{id}" was imported. Imported extensions cannot be edited here: their source belongs to whoever wrote them. Create a new extension with another identifier to package your own artifacts.',
  'author.imported-locked.banner': 'This extension was imported, so it cannot be edited or exported here: its source belongs to whoever wrote it. It can still be activated, installed and published to the catalogue. To change it, ask the author for a new version and import it again.',
  'import.authored-here': 'An extension with the identifier "{id}" was created in this organization. Importing would replace it with a copy that can no longer be edited — change the identifier of the package or remove the existing extension first.',
  'extension.badge.imported': 'Imported',
  'extension.badge.imported.hint': 'Brought in from a file. It can be activated, installed and published, but not edited or downloaded: its source belongs to whoever wrote it.',
  'extension.badge.has-code': 'With code',
  'extension.badge.unreviewed': 'Code not reviewed',
  'extension.badge.server-code': 'Server code',
  'extension.badge.server-code.hint':
    'Brings the code of its own Cloud Functions. It runs on the server, with access to every organization '
    + 'of the project, and goes live only after whoever maintains the project approves that exact code.',
  'extension.badge.backend-pending': 'Backend pending',
  'extension.backend-pending.detail':
    'This extension needs Cloud Functions or database indexes that this Firebase project does not have '
    + 'yet, so it is installed but not running. Whoever maintains the project applies them with '
    + '"microteia provision" in the Microteia Console.',
  'extension.backend-pending.reason.function-source-missing':
    'The Microteia Console did not find the source of {functions} in this installation, so it could not '
    + 'deploy them. This version of the extension does not bring it: install one built with its '
    + 'functions/ folder, or have whoever maintains the project put that folder in '
    + 'extensions/<folder>/functions/, next to microteia.yaml, and run "microteia provision" again.',
  'extension.backend-pending.reason.function-claim-refused':
    'The Microteia Console refused this extension\'s claim on {functions}: the name belongs to the '
    + 'platform or to a function shared by the whole installation, or its trigger guards another '
    + 'extension. The output of "microteia provision" says which, and the fix is in the extension.',
  'extension.backend-pending.reason.gate-missing':
    'The Microteia Console did not deploy {functions}: they act without checking that this extension is '
    + 'installed in the organization, and would act on every organization of the project. The fix is in '
    + 'the extension; then run "microteia provision" again.',
  'extension.backend-pending.reason.deploy-failed':
    'The deploy of {functions} failed the last time "microteia provision" ran. Its output says why; '
    + 'whoever maintains the project runs it again once that is fixed.',
  'extension.backend-pending.reason.awaiting-approval':
    'This extension brings the code of {functions}, which run on the server with access to every '
    + 'organization of the project. They go live only after whoever maintains the project reviews that '
    + 'exact code and approves it when running "microteia provision" in the Microteia Console.',
  'extension.backend-pending.reason.source-invalid':
    'The code of {functions} that came with this extension does not match its own checksum, or names a '
    + 'file outside its folder, so the Microteia Console refused it. Install the extension again from a '
    + 'file built by its author.',
  'issue.backend-source.shape':
    'The server code bundled in this package is malformed: it needs a list of files and a SHA-256 '
    + 'checksum. Build the package again with "microteia-plugin build".',
  'issue.backend-source.path':
    'The server code bundled in this package includes "{path}", which cannot travel: only .ts and .json '
    + 'files inside the functions/ folder, without tests or hidden files.',
  'issue.backend-source.no-index':
    'The server code bundled in this package has no index.ts. The Cloud Functions are read through it — '
    + 'export from there what should be deployed.',
  'issue.backend-source.undeclared':
    'This package bundles server code but declares no Cloud Function in manifest.backend.functions, so '
    + 'nothing would ever deploy it. Declare the functions it exports, or remove the functions/ folder.',
  'extension.badge.migration-pending': 'Data update pending',
  'extension.migration-pending.detail':
    'This extension needs to update data written by an earlier version of it, so it is installed but '
    + 'not running. Only an administrator runs it, from "Update data" on this card.',
  'extension.run-migrations': 'Update data',
  'extension.badge.connection-pending': 'Credential pending',
  'extension.connection.missing': 'Needs the integration credential "{name}" ({key}), which the organization does not have.',
  'extension.connection.scheme': 'The integration credential {key} sends the secret differently from what this extension expects.',
  'extension.connection.hosts': 'The integration credential {key} does not allow every domain this extension calls: {hosts}.',
  'extension.connection.no-secret': 'The integration credential {key} has no secret stored.',
  'extension.connection.office-hosts': 'The organization does not allow calls to {hosts}, which the credential {key} needs. Add them to "Domains allowed for API calls" in Settings.',
  'extension.connection.configure': 'Configure',
  'extension.install': 'Install in the organization',
  'extension.update': 'Update',
  'extension.uninstall': 'Uninstall from the organization',
  'extension.activate': 'Activate in the organization',
  'extension.deactivate': 'Deactivate in the organization',
  'extension.publish': 'Publish to the catalog',
  'extension.republish': 'Update the catalog to version {version}',
  'extension.publish.needs-version':
    'Raise the version of this extension to send the changes to the catalog: organizations that already '
    + 'installed it only receive an update when the version rises.',
  'extension.approve': 'Approve publication',
  'extension.reject': 'Reject publication',
  'extension.deprecate': 'Mark as deprecated',
  'extension.remove': 'Delete from the private area',
  'extension.range.title': 'Apply this version anyway?',
  'extension.range.message':
    '{detail} Applying it now leaves that extension installed but not loading until the other one is updated too.',
  'extension.range.confirm': 'Apply anyway',
  'extension.remove.title': 'Delete extension',
  'extension.remove.message':
    'Delete "{name}" from your private area? Copies already installed (here or in other organizations) and the published version are not affected.',
  'extension.import': 'Import .json',
  'extension.imported': '{name} imported into My Extensions.',
  'extension.import-failed': 'Could not import: {detail}',
  'extension.export-catalog': 'Export catalog',
  'extension.export-catalog.hint':
    'Download a snapshot of the screens, lists and installed extensions of this organization, for the '
    + 'extension authoring tools. It carries their shape, never the records.',
  'extension.catalog-exported':
    'Catalog exported: {screens} screen(s) and {extensions} extension(s). Save it as {file} in your extensions folder.',
  'extension.catalog-export-failed': 'Could not export the catalog: {detail}',
  'import.title': 'Import {name}',
  'import.intro': 'Version {version} of this extension was recognized. Choose where it will be available.',
  'import.scope.private': 'Only in this organization',
  'import.scope.public': 'In the catalog, for every organization',
  'import.scope.private.hint':
    'It goes to My Extensions, ready to be installed here. No other organization sees it, and you can '
    + 'publish it to the catalog later.',
  'import.scope.public.hint':
    'It goes to My Extensions and, at the same time, to the catalog every organization browses, where '
    + 'anyone can install it. Only a system administrator takes it out of the catalog afterwards.',
  'import.code-requires-system':
    'This extension brings a screen in code, and code runs in the browser of every member of every '
    + 'organization that installs it — only a system administrator publishes it to the catalog. '
    + 'Importing keeps it in this organization.',
  'import.install': 'Install in this organization',
  'import.install.update': 'Update the copy installed here (version {version})',
  'import.confirm': 'Import',
  'extension.review': 'Review and trust the code',
  'extension.trust.title': 'Trust this extension?',
  'extension.trust.question': 'Do you trust the author of this extension?',
  'extension.trust.lead': '"{name}" brings its own code. It only runs in this organization after an administrator decides to trust whoever wrote it.',
  'extension.trust.unknown-author': 'Unknown author',
  'extension.trust.unverified': 'Unverified publisher',
  'extension.trust.unverified.hint': 'Microteia could not confirm who published this extension. Trust it only if you know where it came from.',
  'extension.trust.verified.hint': 'The identity of whoever published this extension has been confirmed.',
  'extension.trust.effects.title': 'If you trust it, its code will:',
  'extension.trust.effect.every-member': 'Run in the browser of every member of the organization',
  'extension.trust.effect.data': 'Have access to the data each member can see',
  'extension.trust.effect.revocable': 'Keep running until you deactivate or uninstall it',
  'extension.trust.catalog-note': 'Extensions installed from the public catalog do not ask this — they were already reviewed when published.',
  'extension.trust.decline': 'No, I don’t trust it',
  'extension.trust.confirm': 'Yes, I trust the author',
  'extension.trusted': 'Code reviewed and released to run in this organization.',
  'extension.installed': 'Installed in the organization.',
  'extension.uninstalled': 'Extension uninstalled.',
  'extension.not-installed':
    'The extension "{extension}" is not installed in this organization, so its server functions do not '
    + 'answer here.',
  'extension.activated': 'Extension activated.',
  'extension.deactivated': 'Extension deactivated.',
  'extension.updated': 'Extension updated.',
  'extension.removed': 'Extension deleted from your private area.',
  'extension.published': 'Published to the catalog.',
  'extension.publish-failed': 'Could not publish: {detail}',
  'extension.approved': 'Extension approved.',
  'extension.deprecated': 'Extension marked as deprecated.',
  'extension.rejected': 'Publication rejected and removed from the catalog.',
  'extension.operation-failed': 'Could not complete the operation: {detail}',
  'author.group.screens': 'Screens',
  'author.view.default-title': 'Screen {number}',
  'diagnostic.capability.id.invalid':
    'Capability "{id}" is invalid. Use the "group.name" format (e.g. "ai.completion").',
  'diagnostic.capability.range.invalid': 'Range "{range}" of capability "{id}" is invalid.',
  'diagnostic.capability.unsatisfied':
    'Plugin "{id}" needs "{capability}" {range}, and no installed plugin provides that capability.',
  'diagnostic.capability.version.invalid': 'Version "{version}" of capability "{id}" is not a valid semver.',
  'diagnostic.contribution.api-version.missing': 'Contribution "{id}" must declare apiVersion in semver.',
  'diagnostic.contribution.conflict':
    'Point "{point}" accepts a single contribution, but {count} were registered. "{winner}" prevailed.',
  'diagnostic.contribution.duplicate':
    'Contribution "{id}" was already declared for point "{point}" in this plugin.',
  'diagnostic.contribution.id.invalid':
    'Contribution id "{id}" is invalid. Use lowercase letters, numbers, "-" and ".".',
  'diagnostic.contribution.impl.kind-forbidden':
    'Point "{point}" does not accept an implementation of kind "{kind}". It accepts: {allowed}.',
  'diagnostic.contribution.impl.malformed':
    'The implementation of contribution "{id}" is malformed for kind "{kind}".',
  'diagnostic.contribution.impl.missing':
    'Point "{point}" requires an implementation and contribution "{id}" declared none.',
  'diagnostic.contribution.impl.trusted-only':
    'An implementation of kind "{kind}" is exclusive to internal plugins. Use "script", "widget" or "workflow".',
  'diagnostic.contribution.impl.unresolved':
    'Contribution "{id}" points to implementation "{key}", which plugin "{plugin}" did not provide.',
  'diagnostic.contribution.metadata.invalid': 'The metadata of contribution "{id}" must be an object.',
  'diagnostic.contribution.point.incompatible':
    'Contribution "{id}" expects contract {expected} of "{point}", which is on version {actual}.',
  'diagnostic.contribution.point.invalid': 'Extension point "{point}" is invalid.',
  'diagnostic.contribution.point.unknown':
    'Extension point "{point}" is not registered. Contribution "{id}" was ignored.',
  'diagnostic.dependency.cycle': 'Plugin "{id}" is part of a dependency cycle and could not be loaded.',
  'diagnostic.dependency.disabled': 'Plugin "{id}" depends on "{dependency}", which could not be loaded.',
  'diagnostic.dependency.missing': 'Plugin "{id}" depends on "{dependency}", which is not installed.',
  'diagnostic.dependency.unsatisfied':
    'Plugin "{id}" requires "{dependency}" {range}, but the installed version is {installed}.',
  'diagnostic.backend.not-object': 'The backend requirement must be an object.',
  'diagnostic.backend.functions-invalid': 'backend.functions must be a list of Cloud Function names.',
  'diagnostic.backend.function-name-invalid': 'A Cloud Function name must start with a letter and hold only letters, digits and underscore.',
  'diagnostic.backend.parameters-invalid': 'backend.parameters must be a list of setting names.',
  'diagnostic.backend.parameter-name-invalid': 'A backend setting name must be upper case, with digits and underscore.',
  'diagnostic.backend.indexes-invalid': 'backend.indexes must be a list of composite index definitions.',
  'diagnostic.backend.index.collection-missing': 'A composite index must name the collection it indexes.',
  'diagnostic.backend.index.scope-invalid': 'A composite index scope must be COLLECTION or COLLECTION_GROUP.',
  'diagnostic.backend.index.fields-missing': 'A composite index needs at least two fields — a single field is indexed automatically.',
  'diagnostic.backend.index.field-invalid': 'Every field of a composite index needs a field path.',
  'diagnostic.manifest.dependencies.invalid': 'Dependencies must be an object { pluginId: range }.',
  'diagnostic.manifest.dependency.id.invalid': 'Dependency "{id}" is not a valid plugin id.',
  'diagnostic.manifest.dependency.range.invalid': 'Range "{range}" of dependency "{id}" is invalid.',
  'diagnostic.manifest.export.duplicated': 'Export "{id}" is declared twice.',
  'diagnostic.manifest.export.id.invalid': 'Export "{id}" is not a valid artifact id.',
  'diagnostic.manifest.exports.invalid': 'Exports must be a list of artifact ids.',
  'diagnostic.manifest.id.invalid':
    'Plugin id "{id}" is invalid. Use reverse DNS with at least two segments (e.g. "com.acme.contracts").',
  'diagnostic.manifest.kernel.invalid': 'Kernel range "{range}" is invalid. Use something like "^1.0.0".',
  'diagnostic.manifest.kernel.unsatisfied':
    'Plugin "{name}" requires Microteia {required}, but this installation is on version {installed}.',
  'diagnostic.manifest.name.missing': 'The plugin needs a readable name.',
  'diagnostic.manifest.not-object': 'The manifest must be an object.',
  'diagnostic.manifest.point.duplicated': 'Extension point "{id}" was declared more than once in this plugin.',
  'diagnostic.manifest.version.invalid': 'Version "{version}" is not a valid semver.',
  'diagnostic.permission.invalid':
    'Permission "{permission}" is invalid. Use "domain:action" or "domain:resource:action" with one of the domains: {domains}.',
  'diagnostic.plugin.code-ignored':
    'Plugin "{id}" is not internal, so its code implementations were ignored.',
  'diagnostic.plugin.duplicate':
    'Plugin "{id}" was declared more than once. The second declaration was ignored.',
  'diagnostic.point.api-version.invalid': 'Point "{id}" needs an apiVersion in semver.',
  'diagnostic.point.id.invalid':
    'Extension point "{id}" is invalid. Use the "group.name" format (e.g. "ui.page").',
  'diagnostic.point.impl-kind.unknown': 'Implementation kind "{kind}" does not exist. Use one of: {allowed}.',
  'diagnostic.point.impl-kinds.missing': 'Point "{id}" must declare allowedImplKinds.',
  'diagnostic.point.impl-required-none-allowed': 'Point "{id}" requires an implementation but allows no kind.',
  'diagnostic.point.owned':
    'Extension point "{id}" already belongs to plugin "{owner}" and cannot be redeclared by "{claimant}".',
  'diagnostic.point.title.missing': 'Point "{id}" needs a title.',
  'issue.migration.id-duplicated': 'Two data migrations share the identifier "{id}" — the identifier is what records that it already ran.',
  'issue.migration.id-invalid': 'Data migration identifier "{id}" is invalid: lower-case letters, digits and hyphen, starting with a letter.',
  'issue.migration.name-missing': 'Data migration "{id}" needs a name — it is what the organization reads before running it.',
  'issue.migration.not-list': 'The data migrations must be a list.',
  'issue.migration.out-of-order': 'Data migration "{id}" comes after "{previous}", of a later version — the declared order is the execution order.',
  'issue.migration.phase-invalid': 'Data migration "{id}" declares phase "{phase}": it runs "before" or "after" the package artifacts.',
  'issue.migration.rounds-invalid': 'Data migration "{id}" declares {rounds} rounds — the ceiling must be a whole number of 1 or more.',
  'issue.migration.source-missing': 'Data migration "{id}" has no code.',
  'issue.migration.source-modules': 'Data migration "{id}" uses import/export/require, which the sandbox does not resolve.',
  'issue.migration.version-invalid': 'Data migration "{id}" declares version "{version}", which is not a valid semver.',
  'issue.package.action.no-target':
    'The action "{key}" ({where}) runs nothing: declare workflowId (a workflow templateId) or command (a platform record gesture).',
  'issue.package.field.lookup.map-kernel':
    'Field "{field}" of "{screen}" sends the external lookup to fields with onChangeLookup.map, which requires kernel: "^{minimum}". An older kernel ignores map and writes the raw provider keys into the record.',
  'issue.package.field.lookup.map-output':
    'Field "{field}" of "{screen}" maps "{output}", which the provider "{provider}" does not return. It returns: {outputs}.',
  'issue.package.field.lookup.map-prefix':
    'Field "{field}" of "{screen}" declares both map and targetPrefix in onChangeLookup. With map, each value goes to the field it names and targetPrefix is never applied: remove one of them.',
  'issue.package.field.lookup.map-readonly':
    'Field "{field}" of "{screen}" sends "{output}" to "{target}", whose value the platform writes itself (compute, derive or aggregation). The lookup would be overwritten: map it to a field the person edits.',
  'issue.package.field.lookup.map-self':
    'Field "{field}" of "{screen}" sends "{output}" back to itself. The field that triggers the lookup is never rewritten, so that the reply does not fight with typing: map it to another field.',
  'issue.package.field.lookup.map-shape':
    'Field "{field}" of "{screen}" declares an onChangeLookup.map that is not a non-empty object of { "<provider key>": "<field key>" }, both as text.',
  'issue.package.field.lookup.map-target':
    'Field "{field}" of "{screen}" sends "{output}" to "{target}", which is not a field of that screen. map takes the key of a field declared in the same screen — flat, such as "addressStreet", never "address.street".',
  'issue.package.field.preset.absent':
    'Field "{field}" of "{screen}" names the preset "{preset}" in {path}, which neither the kernel, this package nor its dependencies ({dependencies}) declare. At run time an unknown preset does nothing, so the field would silently lose it.',
  'issue.package.field.preset.absent.suggest':
    'Field "{field}" of "{screen}" names the preset "{preset}" in {path}, which neither the kernel, this package nor its dependencies ({dependencies}) declare, so the field would silently lose it. Did you mean "{suggestion}"?',
  'issue.package.field.preset.slot':
    'Field "{field}" of "{screen}" names the preset "{preset}" in {path}, but "{preset}" (declared by {owner}) declares no {part} section, so {path} would do nothing on that field.',
  'issue.package.field.reserved-key':
    'Field "{field}" of "{screen}" uses the key "{field}", which the platform reserves for the terms records are searched by. Rename the field.',
  'issue.package.field.searchable.type':
    'Field "{field}" of "{screen}" is declared searchable, but it is a {type} field. Search reads only {types}: a date, a number or a checkbox is filtered on the list, not searched.',
  'issue.package.icon.unknown':
    'Icon "{icon}" ({where}) is not in the platform catalogue. The installation would draw the generic marker instead. Ask the microteia-plugin MCP server for list_icons to see every key.',
  'issue.package.message.key':
    'The message key "{key}" ({where}) is discarded on install: a key takes only letters, digits, dot and hyphen, starting with a letter or digit. Write "a-b", not "a_b".',
  'issue.package.message.reference':
    'The text "{reference}" ({where}) looks like a message reference but is not one, so the screen would show it as written: the namespace and the key take only letters, digits, dot and hyphen, starting with a letter or digit. Write "a-b", not "a_b".',
  'issue.package.nav.dangling':
    'The menu item "{key}" opens a tab no page draws; to open the list of a screen, use screen: "<screen key>".',
  'issue.package.nav.dangling.screen':
    'The menu item "{key}" opens a tab no page draws; to open the list of the screen "{screen}", use screen: "{screen}".',
  'issue.package.nav.filter.not-filterable':
    'Menu item "{id}" opens the list filtered by "{key}", which is not a filterable field of the screen "{screen}". filter: takes the key of a field declared with filterable: true (a date also as "<key>:ate", the end of the range); { key, empty } takes the field itself.',
  'issue.package.nav.filter.shape':
    'Menu item "{id}" ({where}) declares a filter that is not a list of { key, values }, each with at least one value, or { key, empty: true | false } — never both in one term.',
  'issue.package.nav.filter.presence':
    'Menu item "{id}" filters "{key}" by whether it is empty, but a checkbox is never empty: unchecked is "false". Filter it with { key: "{key}", values: ["false"] }.',
  'issue.package.nav.filter.kernel':
    'Menu item "{id}" opens the list filtered by an empty or filled field ({ key, empty }), which only exists from kernel {minimum} on — declare `kernel: "^{minimum}"` (or later) in the manifest. An older kernel refuses the filter.',
  'issue.package.nav.filter.target':
    'Menu item "{id}" ({where}) declares a filter, but opens no screen list: a filter only applies to screen or screenSourceId.',
  'issue.package.nav.filter.value':
    'Menu item "{id}" filters "{key}" by "{value}", which the field does not accept. An option list compares by the option KEY; a checkbox takes "true" or "false"; a date, YYYY-MM-DD.',
  'issue.package.nav.screen-unknown':
    'Menu item "{id}" opens the screen "{screen}", which this package does not declare. screen: takes the key of one of the package\'s own screens.',
  'issue.package.nav.source-id-unknown':
    'Menu item "{id}" opens the screen with sourceId "{sourceId}", which neither this package nor a declared dependency declares.',
  'issue.package.nav.target':
    'Menu item "{id}" ({where}) must name exactly one target: key (tabKey, in a ui.menu action), screen or screenSourceId.',
  'issue.package.near-limit':
    'The package is {size}. Above {limit} it stops fitting in the installation document — it is worth splitting it before it grows further.',
  'issue.package.no-manifest': 'The extension has no manifest with an "id".',
  'issue.package.no-summary': 'The extension needs a short description (summary).',
  'issue.package.no-workflows': 'The extension needs the "workflows" list (it may be empty).',
  'issue.package.not-json': 'The file is not valid JSON.',
  'issue.package.not-object': 'The content is not an extension object.',
  'issue.package.record-surface.no-source-id':
    'Contribution "{id}" ({where}) is addressed to "record:" without naming the screen, so no record detail would ever show it. Write recordSurface(<screen sourceId>).',
  'issue.package.settings.default':
    'The `default` of setting "{key}" in contribution "{id}" ({where}) is not a value the setting accepts: {detail}',
  'issue.package.settings.multi-type':
    'Setting "{key}" in contribution "{id}" ({where}) declares `multi`, which only a `select` reads.',
  'issue.package.settings.options-conflict':
    'Setting "{key}" in contribution "{id}" ({where}) declares both `options` and `optionsFrom`. Keep one: a closed list, or the options of a collection of the organization.',
  'issue.package.settings.options-from-invalid':
    'Setting "{key}" in contribution "{id}" ({where}) has an `optionsFrom` that does not say where the options come from. Write { kind: \'lookup\' | \'entity\', collection }.',
  'issue.package.settings.options-from-type':
    'Setting "{key}" in contribution "{id}" ({where}) declares `optionsFrom`, which only a `select` reads.',
  'issue.package.too-large':
    'The package is {size} and would not fit in the installation document (the practical limit is {limit}). Split it — one package per language, or one per set of screens.',
  'issue.step.control-incomplete':
    'step "{step}" is a {type} control node but has no `{missing}` — the flow has nothing to branch on.',
  'issue.step.parallel-branches': 'step "{step}" has more parallel branches than the maximum of {max}.',
  'issue.step.loop-concurrency-query': 'step "{step}" pages through a query and declares `concurrency` — a paged loop runs one page at a time; remove `concurrency`.',
  'issue.step.input-invalid':
    'step "{step}" ({definition}) gives input "{input}" a value the step refuses: {reason}',
  'issue.step.input-not-mapping':
    'step "{step}" ({definition}) sets input "{input}" to a bare value — every step input is an InputMapping, one of Literal, Event, Expression, Output or Variable.',
  'issue.step.mapping-kind':
    'step "{step}" ({definition}) maps input "{input}" as {kind}, which that input does not accept. It takes: {allowed}.',
  'issue.step.missing-input':
    'step "{step}" ({definition}) is missing required input "{input}".',
  'issue.step.no-definition':
    'step "{step}" is of type {type} and names no step of the catalog — only Condition and Loop may leave `stepDefinitionId` empty.',
  'issue.step.output-unknown-id':
    'step "{step}" reads output "{output}" of step "{target}" through input "{input}", and that step does not publish it. It publishes: {expected}.',
  'issue.step.output-unknown-step':
    'step "{step}" reads, through input "{input}", the output of step "{target}", which does not exist in this workflow.',
  'issue.step.type-unimplemented':
    'step "{step}" is of type {type}, which this platform version does not run — the flow would stop there.',
  'issue.step.unknown-definition':
    'step "{step}" names step "{definition}", which is not in the catalog. The package declares no dependency, so it cannot come from another extension either.',
  'issue.workflow.schedule-invalid':
    'the workflow runs on a schedule, and the clock cannot run it: {detail} It would install switched on and never fire.',
  'issue.workflow.date-reached-invalid':
    'the workflow runs when a date arrives, and the clock cannot run it: {detail} It would install switched on and never fire.',
  'issue.workflow.trigger-kernel':
    'the workflow is triggered by "{event}", which only exists from kernel {minimum} on — declare `kernel: "^{minimum}"` (or later) in the manifest, so that an older kernel refuses the package instead of installing a workflow that never fires.',
  'issue.workflow.portal-viewed.untracked':
    'the workflow is triggered by "{event}", but the screen "{screen}" does not record portal openings — declare `portal: { ..., trackViews: true }` on it. Without that the event is never published, and the workflow would install switched on and never fire.',
  'issue.step.excluded-trigger':
    'step "{step}" ({definition}) cannot be part of a workflow triggered by "{event}" — the step itself declares that it would feed back into that trigger. Remove it, or fire the workflow from another event.',
  'issue.step.extension-dependency':
    'step "{step}" uses "{definition}", a step of the extension "{extension}" — declare it in `dependencies`, or the automation installs where the step does not exist and fails at its first run.',
  'issue.extension-step.kernel':
    'declares its own automation steps, which only exist from kernel {minimum} on — declare `kernel: "^{minimum}"` (or later) in the manifest.',
  'issue.extension-step.key': 'the step "{step}" needs a `key` of lowercase letters, digits and hyphens — it becomes part of the step id.',
  'issue.extension-step.duplicate': 'the step key "{step}" is declared twice.',
  'issue.extension-step.name': 'the step "{step}" has no `name` — it is what the editor shows in the step list.',
  'issue.extension-step.icon': 'the step "{step}" uses the icon "{icon}", which is not in the icon catalog.',
  'issue.extension-step.impl':
    'the step "{step}" must run an automation (`impl.kind: "workflow"`) or a script (`impl.kind: "script"`) of the package, not "{kind}".',
  'issue.extension-step.body-missing': 'the step "{step}" runs "{body}", which is not in this package.',
  'issue.extension-step.body-not-called':
    'the step "{step}" runs the automation "{body}", which is not triggered as a called workflow — only a called workflow receives parameters and returns a result.',
  'issue.extension-step.body-pauses':
    'the step "{step}" runs the automation "{body}", whose step "{pausing}" pauses. The step waits for its body in the same run, and a pause there would fail with the flow running.',
  'issue.http-connection.kernel':
    'declares the integration credentials it needs, which kernels before {minimum} ignore — declare `kernel: "^{minimum}"` (or later) in the manifest.',
  'issue.http-connection.duplicate': 'the credential "{connection}" is declared twice.',
  'issue.http-connection.invalid': 'the declared credential "{connection}" is invalid: {detail}',
  'issue.http-connection.undeclared':
    'step "{step}" of "{workflow}" sends the credential "{connection}", which the package does not declare — declare it with `httpConnection(...)`, or the organization only finds out it is missing at the first run.',
  'issue.http-connection.host':
    'step "{step}" of "{workflow}" sends the credential "{connection}" to "{host}", which is not among the domains declared for it — the call would be refused for sending the secret elsewhere.',
  'issue.step.delay-nested':
    'step "{step}" waits inside a condition branch or a loop body. A wait only pauses at the top level of the workflow — there the flow would stop with an error.',
  'issue.step.delay-in-action':
    'step "{step}" waits, and the action "{action}" runs this workflow. A button waits for the answer and cannot wait for a pause — the flow would stop with an error. Fire it from an event, or have the action call a workflow that does not wait.',
  'issue.step.delay-kernel':
    'step "{step}" waits, and the wait step only exists from kernel {minimum} on — declare `kernel: "^{minimum}"` (or later) in the manifest, so that an older kernel refuses the package instead of failing at the step.',
  'issue.step.definition-kernel':
    'step "{step}" is a "{definition}" step, which only exists from kernel {minimum} on — declare `kernel: "^{minimum}"` (or later) in the manifest, so that an older kernel refuses the package instead of failing at the step.',
  'issue.step.input-kernel':
    'step "{step}" sets "{input}", which only exists from kernel {minimum} on — declare `kernel: "^{minimum}"` (or later) in the manifest, so that an older kernel refuses the package instead of ignoring it.',
  'issue.step.portal-invite.closed':
    'step "{step}" invites to the screen "{screen}", which does not accept invitations by automation — every run would fail. Declare `portal: { subject: \'self\', ..., invites: { automation: true } }` on it.',
  'issue.step.unknown-input':
    'step "{step}" ({definition}) sets input "{input}", which that step does not have. It takes: {expected}.',
  'issue.step.document.record-only':
    'step "{step}" sets "{input}", which only a template about a record takes — the document template "{template}" reads data instead, and generating it would be refused.',
  'issue.step.document.payload-only':
    'step "{step}" sets "{input}", which only a template that reads data takes — the document template "{template}" is about a record, and the value would never reach it.',
  'issue.step.document.input-required':
    'step "{step}" generates the document template "{template}" and leaves "{input}" empty, which that template needs — generating it would be refused.',
  'issue.step.document.unknown-parameter':
    'step "{step}" fills "{input}", and the document template "{template}" has no parameter "{parameter}" — the value would be ignored and the field would come out blank. Its parameters: {expected}.',
  'issue.step.document.belongs-to-invalid':
    'step "{step}" says the document belongs to "{parameter}", which is not a single-record parameter of the document template "{template}" — generating it would be refused. It can name: {expected}.',
  'issue.step.document.parameter-required':
    'step "{step}" generates the document template "{template}" without its required parameter "{parameter}" — fill "param.{parameter}", or pass the data in bulk through "payload".',
  'issue.step.document.destination-without-owner':
    'step "{step}" saves the document template "{template}" to the record\'s Documents tab without saying which record owns it — set "belongsTo", or save it to Downloads.',
  'install.dependency-missing':
    'This extension references {kind} "{id}" of extension "{plugin}", which is not installed — install it first.',
  'install.dependency-out-of-range':
    'Extension "{plugin}" accepts "{dependency}" {range}, and the installed "{dependency}" is version {installed} — '
    + '"{plugin}" does not load until "{dependency}" is updated to a version in that range.',
  'install.dependent-out-of-range':
    'Extension "{dependent}" accepts "{plugin}" {range}, and this version is {version} — "{dependent}" stops loading '
    + 'until it is updated to a version that accepts it.',
  'install.dependent-breaks':
    '{origin} "{name}" of extension "{dependent}" references {kind} "{id}", which this version no longer '
    + 'brings — update or remove that extension first.',
  'install.dependent-event-breaks':
    '{origin} "{name}" of extension "{dependent}" listens to the event prefix "{prefix}", which this version no longer '
    + 'emits — update or remove that extension first.',
  'issue.patch.own-screen':
    'the patch points to "{target}", which is a screen of the package itself — declare the fields on the screen, not on a patch.',
  'issue.patch.unknown-target':
    'the patch points to "{target}", which is not a fixed system collection — to extend the screen of another extension, use its `sourceId`.',
  'issue.screen.duplicate-prefix':
    'screen "{screen}" would emit "{prefix}.saved", a name that "{taken}" already uses in this package — two collections cannot publish the same event.',
  'issue.screen.kernel-prefix':
    'screen "{screen}" declares prefix "{prefix}", which belongs to {entity} — the {entity} automations would start firing with "{collection}".',
  'issue.screen.reserved-prefix':
    'screen "{screen}" would emit "{prefix}.saved", a name reserved by the automation engine — declare another `eventPrefix`.',
  'issue.report.invalid': 'The report "{name}" cannot be run as it is — {field}: {detail}',
  'issue.report.snapshot': 'The report "{name}" reads a snapshot series, which is data of the organization — a package cannot carry one.',
  'issue.report.requires': 'The report "{name}" declares a `requires` that omits what it uses: {capability}. The list is derived from the spec — leave it out.',
  'issue.aggregation.invalid': 'The field "{field}" of screen "{screen}" cannot aggregate as declared — {detail}',
  'issue.aggregation.kernel': 'The field "{field}" of screen "{screen}" uses the "{op}" aggregation, which only exists from kernel {minimum} on — declare `kernel: "^{minimum}"` (or later) in the manifest, so that an older kernel refuses the package instead of leaving the field empty.',
  'issue.document.order.invalid': 'The list "{list}" of the document template "{template}" cannot be ordered as declared — {detail}',
  'issue.document.order.unknown': 'The list "{list}" of the document template "{template}" is ordered by "{path}", which is not a field of its screen.',
  'issue.document.order.kernel': 'The list "{list}" of the document template "{template}" is ordered by a list of keys, which only exists from kernel {minimum} on — declare `kernel: "^{minimum}"` (or later) in the manifest, so that an older kernel refuses the package instead of failing to generate the document.',
  'issue.portal.field.derived': 'The screen "{screen}" takes the derived field "{field}" (`logic.derive`) to the portal. A derived field is computed when read and never stored, so guests would always see it empty — remove it from `portal.fields` and `portal.create.fields`.',
  'issue.portal.visible-when.invalid': 'The portal condition (`visibleWhen`) of the screen "{screen}" is not a valid expression — no record of it would reach the portal.',
  'issue.portal.visible-when.unknown': 'The portal condition (`visibleWhen`) of the screen "{screen}" uses "{field}", which is not a field of that screen.',
  'issue.portal.visible-when.kernel': 'The screen "{screen}" limits which records reach the portal (`visibleWhen`), which only exists from kernel {minimum} on — declare `kernel: "^{minimum}"` (or later) in the manifest. An older kernel ignores the condition and would show every record.',
  'issue.portal.create-when.invalid': 'The condition for creating in the portal (`create.when`) of the screen "{screen}" is not a valid expression — no guest could create there.',
  'issue.portal.create-when.kernel': 'The screen "{screen}" limits who creates in the portal (`create.when`), which only exists from kernel {minimum} on — declare `kernel: "^{minimum}"` (or later) in the manifest. An older kernel ignores the condition and would let every guest create.',
  'issue.portal.document-links.kernel': 'The screen "{screen}" gives portal guests short-lived document links (`documentLinks`), which only exist from kernel {minimum} on — declare `kernel: "^{minimum}"` (or later) in the manifest. An older kernel ignores the declaration and would hand guests the permanent link.',
  'issue.portal.document-links.minutes': 'The screen "{screen}" declares `documentLinks.expiresInMinutes` outside 1 to {maximum}. Write a whole number of minutes in that range.',
  'issue.portal.public.unsupported': 'The screen "{screen}" is read by every portal guest (`subject: \'public\'`) and declares `{option}`, which needs records that belong to a guest — remove it. A screen for every guest is read-only.',
  'issue.portal.public.kernel': 'The screen "{screen}" is read by every portal guest (`subject: \'public\'`), which only exists from kernel {minimum} on — declare `kernel: "^{minimum}"` (or later) in the manifest. An older kernel discards the declaration: the screen would leave the portal, and nothing would say so.',
  'issue.portal.track-views.kernel': 'The screen "{screen}" records when portal guests open its records (`trackViews`), which only exists from kernel {minimum} on — declare `kernel: "^{minimum}"` (or later) in the manifest. An older kernel ignores the declaration: nothing would be recorded, and nothing would say so.',
  'issue.portal.actions.kernel': 'The screen "{screen}" lets portal guests run actions (`portal.actions`), which only exists from kernel {minimum} on — declare `kernel: "^{minimum}"` (or later) in the manifest. An older kernel ignores the declaration: the buttons would simply not appear.',
  'issue.portal.action.unknown': 'The screen "{screen}" offers the action "{action}" in the portal, but no action of the package with that `key` is in the screen\'s `viewActionIds`. `portal.actions` lists action KEYS, taken from the actions the screen places on the record.',
  'issue.portal.action.disabled': 'The screen "{screen}" offers the action "{action}" in the portal, but the action is declared with `enabled: false` — guests would never see it.',
  'issue.portal.action.not-runnable': 'The screen "{screen}" offers the action "{action}" in the portal, but it runs a `command` instead of a workflow. Only actions that run a workflow can run in the portal.',
  'issue.portal.action.prompts': 'The screen "{screen}" offers the action "{action}" in the portal, but it declares `promptParameters` — the portal has no form for them. Give the workflow what it needs from the record (`context`) instead.',
  'issue.portal.reference-titles.kernel': 'The screen "{screen}" shows the name of linked records outside the portal (`portal.referenceTitles`), which only exists from kernel {minimum} on — declare `kernel: "^{minimum}"` (or later) in the manifest. An older kernel ignores the declaration: those links would reach guests without a name.',
  'issue.portal.reference-titles.field': 'The screen "{screen}" lists "{field}" in `portal.referenceTitles`, but it is not an exposed `reference` field. Only a field that is in `portal.fields` and points to another screen (`refEntity`) has a name to show.',
  'issue.portal.widget.surface': 'The contribution "{id}" declares a portal view without code (`impl.kind: "widget"`) on a surface other than `widget` or `page`. A declaration is a card on the portal home (`portalWidgetSpec`) or a page in the portal menu (`portalPageSpec`).',
  'issue.portal.widget.kernel': 'The contribution "{id}" declares a portal card or page without code, which only exists from kernel {minimum} on — declare `kernel: "^{minimum}"` (or later) in the manifest. An older kernel discards the contribution: the card or page would simply not appear.',
  'issue.edit-window.shape': 'The edit window (`editWindow`) of the screen "{screen}" must be an object: `{ minutes, delete? }`.',
  'issue.edit-window.minutes': 'The edit window (`editWindow`) of the screen "{screen}" needs `minutes` as a whole number greater than zero.',
  'issue.edit-window.delete': 'The edit window (`editWindow`) of the screen "{screen}" has a `delete` that is not true or false.',
  'issue.member-visibility.shape': 'The record visibility (`memberVisibility`) of the screen "{screen}" must be an object: `{ userFields, bypassPermission? }`, with `userFields` a list of field keys.',
  'issue.member-visibility.fields-empty': 'The record visibility (`memberVisibility`) of the screen "{screen}" names no field in `userFields`. Nobody would be named on any record, and only whoever supervises would read them — name at least one field.',
  'issue.member-visibility.fields-too-many': 'The record visibility (`memberVisibility`) of the screen "{screen}" names more than {max} fields in `userFields`. The security rules read {max} positions, and a field beyond them would never be checked.',
  'issue.member-visibility.field-duplicate': 'The record visibility (`memberVisibility`) of the screen "{screen}" names the field "{subject}" more than once.',
  'issue.member-visibility.field-unknown': 'The record visibility (`memberVisibility`) of the screen "{screen}" names "{subject}" in `userFields`, but the screen has no field with that key.',
  'issue.member-visibility.field-not-member': 'The record visibility (`memberVisibility`) of the screen "{screen}" names "{subject}" in `userFields`, but it is not a reference to a member (`type: "reference"`, `refEntity: "members"`). Only a member reference holds the identifier the security rules compare.',
  'issue.member-visibility.bypass-invalid': 'The record visibility (`memberVisibility`) of the screen "{screen}" has a `bypassPermission` ("{subject}") that is not a permission identifier in the form resource.action.',
  'issue.member-visibility.kernel': 'The screen "{screen}" declares record visibility (`memberVisibility`), which only exists from kernel {minimum} on — declare `kernel: "^{minimum}"` (or later) in the manifest. An older kernel ignores it, and every member who reads the collection would read every record.',
  'issue.options-filter.type': 'The field "{field}" of the screen "{screen}" declares `optionsFilter`, which only reference and select fields accept.',
  'issue.options-filter.shape': 'The field "{field}" of the screen "{screen}" declares `optionsFilter` with an invalid shape: `where` must be a non-empty list, and each condition needs a `path`, an `op` ({operators}) and a `value` of `{ field }` or `{ literal }`.',
  'issue.options-filter.lookup-path': 'The field "{field}" of the screen "{screen}" filters its options by "{path}", but a list option only has `key` and `label`.',
  'issue.options-filter.reference-path': 'The field "{field}" of the screen "{screen}" filters its options by "{path}", which is not a field of the screen "{target}".',
  'issue.options-filter.source': 'The field "{field}" of the screen "{screen}" compares its options with "{source}", which is not a field of that screen.',
  'issue.options-filter.self': 'The field "{field}" of the screen "{screen}" filters its options by its own value.',
  'issue.record-sequence.shape': 'The field "{field}" of the screen "{screen}" declares `autoValue.sequence`, which must be an object: `{ scope?, resetBy? }`.',
  'issue.record-sequence.scope': 'The sequence of the field "{field}" of the screen "{screen}" has an unknown `scope`. Use "tenant" (one counter for the office) or "parent" (one counter per parent record).',
  'issue.record-sequence.reset': 'The sequence of the field "{field}" of the screen "{screen}" has an unknown `resetBy`. Use "never" or "year".',
  'issue.record-sequence.nested': 'The field "{field}" of the screen "{screen}" is nested, and only top-level fields can be numbered by a sequence.',
  'issue.record-sequence.field-type': 'The field "{field}" of the screen "{screen}" declares a sequence, which only a `text` field (the formatted number) or a `number` field (the integer) can hold.',
  'issue.record-sequence.pattern-slot': 'The `pattern` of the sequence of the field "{field}" of the screen "{screen}" must have exactly one run of `0` — that is where the number goes, with the zeros as its minimum width.',
  'issue.record-sequence.pattern-numeric': 'The field "{field}" of the screen "{screen}" is a `number` field: it stores the integer, so its sequence takes no `pattern`.',
  'issue.record-sequence.pattern-year': 'The sequence of the field "{field}" of the screen "{screen}" starts over every year, so its `pattern` must contain `YYYY` — otherwise the number of one year repeats the number of the year before. A `number` field cannot start over by year.',
  'issue.record-sequence.scope-needs-parent': 'The sequence of the field "{field}" of the screen "{screen}" is counted per parent (`scope: "parent"`), but the screen declares no `parentFieldKey`.',
  'issue.record-sequence.kernel': 'The screen "{screen}" declares a numbered field (`autoValue.sequence`), which only exists from kernel {minimum} on — declare `kernel: "^{minimum}"` (or later) in the manifest. An older kernel would treat the pattern as a random code, and numbers could repeat.',
  'issue.edit-window.kernel': 'The screen "{screen}" declares an edit window (`editWindow`), which only exists from kernel {minimum} on — declare `kernel: "^{minimum}"` (or later) in the manifest. An older kernel ignores the window and the records would stay editable forever.',
  'issue.widget.data-kernel': 'The widget contribution "{contribution}" uses `{feature}`, which binds data and only exists from kernel {minimum} on — declare `kernel: "^{minimum}"` (or later) in the manifest. An older kernel ignores the node, and a `filters` bar would take the whole dashboard inside it with it.',
  'issue.lookup.seed-mode': 'The list "{collection}" declares `seed: "{seed}"`; use one of: {expected}.',
  'issue.lookup.seed-kernel': 'The list "{collection}" seeds options that are required, or seeds a list of the platform, which only exists from kernel {minimum} on — declare `kernel: "^{minimum}"` (or later) in the manifest. An older kernel would install the extension without those options.',
  'issue.screen-seed.shape': 'The screen "{screen}" declares `seed` without a `records` list.',
  'issue.screen-seed.mode': 'The screen "{screen}" declares `seed.mode: "{mode}"`; use one of: {expected}.',
  'issue.screen-seed.too-many': 'The screen "{screen}" seeds {count} records; the limit is {max}. A larger load is an import, not a starting catalog.',
  'issue.screen-seed.key': 'The screen "{screen}" has a seed record with the key "{key}" — every seed needs a `key` of letters, digits, dots, hyphens or underscores, starting with a letter or digit.',
  'issue.screen-seed.duplicate': 'The screen "{screen}" seeds the key "{key}" twice. The key is what tells the platform which records it has already delivered.',
  'issue.screen-seed.data': 'The seed "{key}" of the screen "{screen}" needs a `data` object with the fields of the record.',
  'issue.screen-seed.field-unknown': 'The seed "{key}" of the screen "{screen}" fills "{field}", which the screen does not declare.',
  'issue.screen-seed.field-unsupported': 'The seed "{key}" of the screen "{screen}" fills "{field}", a `{type}` field — seeds cannot fill reference or file fields yet.',
  'issue.screen-seed.field-unwritable': 'The seed "{key}" of the screen "{screen}" fills "{field}", which no one writes (aggregated, derived, computed or sequential).',
  'issue.screen-seed.field-type': 'The seed "{key}" of the screen "{screen}" gives "{field}" a value of the wrong shape; expected {expected}.',
  'issue.screen-seed.option': 'The seed "{key}" of the screen "{screen}" gives "{field}" the option "{value}", which the field does not offer.',
  'issue.screen-seed.required': 'The seed "{key}" of the screen "{screen}" leaves the required field "{field}" empty, and it has no default value.',
  'issue.screen-seed.message-field': 'The seed "{key}" of the screen "{screen}" puts the message reference "{ref}" in "{field}"; references are only translated in text fields.',
  'issue.screen-seed.message-missing': 'The seed "{key}" of the screen "{screen}" cites "{ref}", which the package does not declare in its `i18n.messages`.',
  'issue.screen-seed.key-repeated': 'The seeds "{other}" and "{key}" of the screen "{screen}" have the same value for the key "{name}"; the second would never be created.',
  'issue.screen-seed.kernel': 'The screen "{screen}" seeds records, which only exists from kernel {minimum} on — declare `kernel: "^{minimum}"` (or later) in the manifest. An older kernel would install the extension without them.',
  'issue.ref.event-undeclared':
    '{origin} "{name}" listens to the event prefix "{prefix}", which a screen of extension "{plugin}" emits — declare it in `dependencies`.',
  'issue.ref.event-unresolved':
    '{origin} "{name}" listens to the event prefix "{prefix}", which no screen of the package, of the kernel or of a declared dependency emits.',
  'issue.ref.external':
    '{origin} "{name}" references {kind} "{id}", which is neither in the package nor covered by a declared dependency.',
  'issue.ref.malformed':
    '{origin} "{name}" references {kind} "{id}", which is not a valid reference — use <extension-id>/<artifact-id>.',
  'issue.ref.not-exported':
    '{origin} "{name}" references {kind} "{id}", which extension "{plugin}" does not declare in `exports`.',
  'issue.ref.screen-qualified':
    '{origin} "{name}" references screen "{id}" in qualified form — a screen is named by its collection, or by the `sourceId` of the extension that brings it.',
  'issue.ref.lookup-qualified':
    '{origin} "{name}" references option list "{id}" in qualified form — a list is named by its collection.',
  'issue.ref.self':
    '{origin} "{name}" references {kind} "{id}" through the package\'s own id — inside the package, name the artifact directly.',
  'issue.ref.undeclared':
    '{origin} "{name}" references {kind} "{id}", which belongs to extension "{plugin}" — declare it in `dependencies`.',
  'permission.domain.capability': 'Integrations',
  'permission.domain.data': 'Organization data',
  'permission.domain.net': 'External network',
  'permission.domain.script': 'Scripts',
  'permission.domain.ui': 'Interface',
  'permission.domain.workflow': 'Automations',
  'ref.kind.action': 'the action',
  'ref.kind.screen': 'the screen',
  'ref.kind.lookup': 'the option list',
  'ref.kind.script': 'the script',
  'ref.kind.workflow': 'the automation',
  'ref.origin.action': 'action',
  'ref.origin.patch': 'patch of',
  'ref.origin.report': 'report',
  'ref.origin.screen': 'screen',
  'ref.origin.setting': 'setting',
  'ref.origin.workflow': 'automation',
  'ref.origin.workflow-step': 'step "{step}" of automation',
  'extension.code-pending-review':
    'This extension brings a screen in code, which will only run after a system administrator publishes it in the catalog. The data was installed normally.',
  'publish.id-taken': 'This identifier was already published by another organization.',
  'publish.invalid-version': 'Version "{version}" is not valid.',
  'publish.code-requires-system':
    'An extension that brings code is published to the catalog only by a system administrator.',
  'publish.version-not-greater':
    'Version {version} is not greater than the published one ({published}). Raise it: organizations that '
    + 'already installed this extension only receive an update when the version rises.',
  'publish.no-tenant': 'No organization or user.',
  'lifecycle.already-installed': 'Plugin "{id}" is already installed (version {version}). Use update.',
  'lifecycle.invalid-version': 'Version "{version}" is not a valid semver.',
  'lifecycle.not-installed': 'The plugin is not installed in this organization.',
  'lifecycle.not-newer': 'Version {version} is not newer than the installed one ({installed}).',
  'migration.error.failed': 'Data update "{name}" failed: {detail}',
  'migration.error.locked': 'Another data update of this extension is already running in this organization. Wait for it to finish.',
  'migration.error.max-rounds': 'Data update "{name}" did not finish within {rounds} rounds. Run it again to continue where it stopped.',
  'migration.error.no-progress': 'Data update "{name}" stopped with {remaining} records left and made no progress — it needs a fix from whoever wrote it.',
  'migration.ran': 'Data of {name} updated.',
  'migration.up-to-date': 'The data of {name} is already up to date.',
  'extension.history': 'Version history',
  'history.title': 'Version history — {name}',
  'history.intro': 'Every version this organization has applied of this extension. Going back to one reapplies its package exactly as it was, keeping the history as it is.',
  'history.empty': 'This extension has no applied version recorded yet.',
  'history.current': 'Applied now',
  'history.applied-by': 'Applied by {name} on {date}',
  'history.limit': 'The last {count} applied versions are kept; older ones are dropped as new ones arrive.',
  'history.uninstalled': 'The extension is not installed in this organization. Applying a version from the history brings it back.',
  'history.apply': 'Apply this version',
  'history.applied': 'Version {version} applied.',
  'history.error.missing': 'The package of this version is no longer in the history.',
  'capability.ai-completion': 'AI text generation',
  'capability.ai-chat': 'AI conversation with tools',
  'plugin.capabilities.description':
    'Declares the extension point where plugins provide Capability implementations.',
  'point.capability.description':
    'Provides the implementation of a Capability (AI, messaging, payments). Several plugins may provide the same one, and the organization chooses which to use.',
  'point.capability.title': 'Capability provider',
  'author.patch.field-count': '{name} ({count} field(s))',
  'issue.step.http-invalid': 'step "{step}" calls an API with an invalid request: {detail}',
  'issue.step.http-literal-secret': 'step "{step}" sends the header "{name}" with a fixed value. It looks like a secret, and in a package it would leave the office inside the extension file — take it from a variable or an earlier step.',
  'issue.workflow.feature-kernel':
    'uses {feature}, which only exists from kernel {minimum} on — declare `kernel: "^{minimum}"` (or later) in the manifest. An older kernel does not refuse it: it ignores it, and the automation runs differently from what you wrote.',
};
