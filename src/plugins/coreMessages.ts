import type { MessageBundle } from '../domain/schema/i18n/messages';
import { DEFAULT_LOCALE } from '../domain/schema/i18n/localeNegotiation';

/**
 * Os textos do NÚCLEO no idioma-fonte.
 *
 * Ficam num arquivo só, e não espalhados pelo manifest de cada `core.*`, porque é este arquivo que o
 * modelo de tradução exporta: quem for traduzir a Microteia quer UMA lista, não oito. Cada bundle
 * continua carimbado com o `namespace` do plugin DONO do texto — quem responde por
 * `core.admin/nav.audit-logs` é o `core.admin`, mesmo que a frase esteja escrita aqui.
 *
 * Toda chave aqui é texto do PRODUTO. O que o escritório digita — nome de tela criada no Form
 * Design, rótulo de campo, opção de lista — não entra e nunca entrará: é dado dele.
 */
export const coreMessage = (namespace: string, messages: Record<string, string>): MessageBundle => ({
  locale: DEFAULT_LOCALE,
  namespace,
  messages,
});

export const CORE_UI_MESSAGES: Record<string, string> = {
  'action.save': 'Save',
  'action.cancel': 'Cancel',
  'action.delete': 'Delete',
  'action.close': 'Close',
  'select.placeholder': 'Select…',
};

export const CORE_ADMIN_MESSAGES: Record<string, string> = {
  'page.tenant-settings': 'Organization',
  'page.access-management': 'Access Management',
  'page.audit-logs': 'Audit Log',
  'page.data-processor': 'Data Processor',
  'nav.tenant-settings': 'Organization',
  'nav.audit-logs': 'Audit Log',
};

export const CORE_MARKETPLACE_MESSAGES: Record<string, string> = {
  'page.marketplace': 'Extensions',
  'page.plugin-author': 'Create extension',
  'page.plugin-author-edit': 'Edit extension',
};

export const CORE_RECORDS_MESSAGES: Record<string, string> = {
  'page.screen-builder': 'Form Design',
  'page.dynamic-list': 'Custom screen',
  'page.dynamic-new': 'New record',
  'page.dynamic-record': 'Record',
};

export const CORE_WORKSPACE_MESSAGES: Record<string, string> = {
  'page.profile': 'My Profile',
};

export const CORE_SETTINGS_MESSAGES: Record<string, string> = {
  'page.settings': 'Settings',
  'nav.settings': 'Settings',
};

export const CORE_I18N_MESSAGES: Record<string, string> = {
  'section.title': 'Language and region',
  'section.description':
    'How this organization reads text, dates and amounts. A personal preference, when set, wins over the organization default.',
  'locale.label': 'Language',
  'locale.description':
    'Available languages come from the installed translation packages. Text without a translation appears in its original language.',
  'timezone.label': 'Time zone',
  'timezone.description':
    'Used to decide which day an instant belongs to. Left empty, the time zone of whoever has the screen open applies.',
  'page.translations': 'Translations',
  'nav.translations': 'Translations',
};
