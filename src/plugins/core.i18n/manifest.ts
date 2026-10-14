import type { PluginRecord } from '../../kernel';
import { I18N_EXTENSION_POINTS, messageBundleContribution } from '../../domain/schema/i18n/extensionPoints';
import { coreMessage, CORE_I18N_MESSAGES } from '../coreMessages';
import { DEFAULT_LOCALE } from '../../domain/schema/i18n/localeNegotiation';
import { lazyView, nav, page, settingsSection } from '../contributionBuilders';
import { PERMISSION_TRANSLATIONS_MANAGE } from '../../domain/schema/access';
import { ADMIN_NAV_GROUP } from '../../domain/schema/ui/uiExtensionPoints';

/**
 * O núcleo do idioma. Declara o ponto onde as traduções chegam e as duas preferências que decidem
 * como o escritório lê números, datas e texto — e nada além disso.
 *
 * Ele não traz tradução nenhuma, de propósito: quem tem texto é quem o escreveu. `core.ui` publica os
 * textos de `core.ui`, e um pacote de tradução publica as versões deles em outro idioma. Se este
 * plugin carregasse os idiomas, acrescentar um exigiria um commit no núcleo.
 */
export const coreI18nPlugin: PluginRecord = {
  trusted: true,
  implementations: {
    TranslationsView: lazyView(
      () => import('../../presentation/pages/Translations/Translations.view'),
      'TranslationsView',
    ),
  },
  manifest: {
    id: 'core.i18n',
    version: '1.0.0',
    kernel: '^2.0.0',
    // eslint-disable-next-line no-restricted-syntax -- metadado do plugin do NÚCLEO: não é renderizado.
    name: 'Language Core',
    description:
      // eslint-disable-next-line no-restricted-syntax -- metadado do plugin do NÚCLEO: não é renderizado.
      'Declares the translation extension point and the organization language and time zone preferences.',
    dependencies: { 'core.ui': '^1.0.0', 'core.access': '^1.0.0' },
    extensionPoints: I18N_EXTENSION_POINTS,
    contributes: [
      messageBundleContribution(coreMessage('core.i18n', CORE_I18N_MESSAGES)),
      page({ key: 'translations', title: '@core.i18n/page.translations', icon: 'globe' }, 'TranslationsView'),
      nav({ key: 'translations', label: '@core.i18n/nav.translations', icon: 'globe', order: 116, group: ADMIN_NAV_GROUP, requiredPermissions: [PERMISSION_TRANSLATIONS_MANAGE] }),
      settingsSection({
        key: 'i18n',
        title: '@core.i18n/section.title',
        description: '@core.i18n/section.description',
        icon: 'globe',
        order: 5,
        properties: [
          {
            key: 'i18n.locale',
            label: '@core.i18n/locale.label',
            description: '@core.i18n/locale.description',
            type: 'locale',
            default: DEFAULT_LOCALE,
            scopes: ['tenant', 'user'],
          },
          {
            key: 'i18n.timezone',
            label: '@core.i18n/timezone.label',
            description: '@core.i18n/timezone.description',
            type: 'timezone',
            default: '',
            scopes: ['tenant', 'user'],
          },
        ],
      }),
    ],
  },
};
