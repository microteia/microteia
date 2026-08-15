/** Os textos da tela de Configurações e do catálogo declarativo que a monta. */
export const CORE_SETTINGS_MESSAGES: Record<string, string> = {
  'page.settings': 'Settings',
  'nav.settings': 'Settings',
  'settings.contributions.empty': 'No option available. Install an extension that offers one.',
  'settings.empty': 'No setting registered. Extensions that accept configuration show up here.',
  'settings.json.discard': 'Discard',
  'settings.json.invalid': 'Invalid JSON: {detail}',
  'settings.json.lead.tenant':
    'The whole document of organization settings. A key of a disabled extension is preserved; a value outside what the setting accepts is refused.',
  'settings.json.lead.user':
    'The whole document of your preferences. A key of a disabled extension is preserved; a value outside what the setting accepts is refused.',
  'settings.list.hint': 'Press Enter to add. Click the × to remove.',
  'settings.mode.json': 'Edit as JSON',
  'settings.mode.visual': 'Visual editing',
  'settings.none-found': 'No setting found.',
  'settings.reset': 'Restore default',
  'settings.reset-failed': 'Could not restore the default.',
  'settings.save-all-failed': 'Could not save the settings.',
  'settings.save-failed': 'Could not save the setting.',
  'settings.saved': 'Settings saved.',
  'settings.scope.tenant': 'Organization',
  'settings.scope.user': 'User',
  'settings.search.placeholder': 'Search setting',
  'settings.tag.from-tenant': 'Defined by the organization',
  'settings.tag.modified': 'Modified',
  'settings.tag.overridden': 'Overridden by your preference',
  'settings.tenant.read-only':
    'The organization settings are defined by the administrator. Your personal preferences remain editable on the User tab.',
  'settings.widgets.empty': 'No widget available. Install an extension that offers widgets.',
};
