/** Os textos do próprio motor de idioma: preferências e a tela de Traduções. */
export const CORE_I18N_MESSAGES: Record<string, string> = {
  'section.title': 'Language and region',
  'section.description':
    'How this organization reads text, dates and amounts. A personal preference, when set, wins over the organization default.',
  'category.language': 'Language',
  'category.localization': 'Localization',

  'locale.label': 'Language',
  'locale.description':
    'Available languages come from the installed translation packages. Text without a translation appears in its original language.',
  'timezone.label': 'Time zone',
  'timezone.description':
    'Used to decide which day an instant belongs to. Left empty, the time zone of whoever has the screen open applies.',
  'page.translations': 'Translations',
  'nav.translations': 'Translations',
  'translations.admin-only': 'Only organization administrators can install languages.',
  'translations.badge.disabled': 'Disabled',
  'translations.badge.in-use': 'In use',
  'translations.badge.shadowed': 'No effect',
  'translations.download': 'Download extension (.json)',
  'translations.download.hint':
    'Enter the language as pt-BR, es or de-DE. The file comes with the texts filled in: the translation that already exists for that language, or the original text for you to overwrite. Translate the values inside messages and leave the keys alone.',
  'translations.import': 'Import language extension',
  'translations.import.hint':
    'A shortcut to install the language extension. The same file can be imported from the Extensions screen — it is the same format and the same installation.',
  'translations.installed': 'Installed languages',
  'translations.installed.hint':
    'To disable or remove a language, use the Extensions screen — a language is an extension.',
  'translations.installed.success.one':
    'Language "{name}" installed with {count} text. Choose it in Settings → Language and region.',
  'translations.installed.success.other':
    'Language "{name}" installed with {count} texts. Choose it in Settings → Language and region.',
  'translations.installing': 'Installing…',
  'translations.locale': 'Language',
  'translations.locale.placeholder': 'es',
  'translations.none-installed': 'No language installed. The system is in its original language (English).',
  'translations.not-a-language-package':
    'This file is not a language package. To install an ordinary extension, use the Extensions screen.',
  'translations.shadowed.notice':
    'There is more than one package for the language in use. Only the first one counts; the ones marked "No effect" change nothing. Remove the extras on the Extensions screen.',
  'translations.step.download': '1. Download the language extension',
  'translations.step.import': '2. Import it back',
  'translations.subtitle':
    'A language is an extension like any other. Download the language extension with every text of the system — the ones from the core and the ones from the installed extensions —, translate the texts inside the file and import it back.',
  'translations.summary.one': '{name} — {count} text',
  'translations.summary.other': '{name} — {count} texts',
  'point.messages.description':
    'Declares the texts of a plugin in one language. A translation-only package is an extension that contributes here alone — including for texts of the core and of other extensions.',
  'point.messages.title': 'Message catalog',
  'package.id-taken-by-extension':
    'The identifier "{id}" already belongs to the extension "{name}", which is not a language package. Change the "id" of the file before importing — installing over it would erase its screens and automations.',
  'package.id-taken-by-language':
    'The identifier "{id}" already belongs to the language "{name}". An extension with screens or automations cannot take the place of a language package: change the "id" of the file.',
  'package.summary':
    'Puts the system in the language of this package. It can be uninstalled at any time, returning the interface to the original language.',
  'package.description':
    'The system texts in the language of this package.',
};
