import type { PluginRecord } from '../../kernel';
import { AUTOMATIC_THEME, THEME_EXTENSION_POINTS } from '../../domain/schema/theme';
import { coreMessage, CORE_THEME_MESSAGES } from '../coreMessages';
import { messageBundleContribution } from '../../domain/schema/i18n/extensionPoints';
import { settingsSection } from '../contributionBuilders';

/**
 * O núcleo da aparência. Declara os dois pontos por onde um tema chega e a única preferência que
 * decide qual deles vale — e nada além disso.
 *
 * Ele não traz tema nenhum, pelo mesmo motivo que `core.i18n` não traz idioma: quem tem paleta é
 * quem a escreveu. Os dois temas do sistema são pacotes separados, embutidos no bundle; um terceiro
 * tema é uma extensão instalada. Se este plugin carregasse as paletas, acrescentar uma exigiria um
 * commit no núcleo — que é exatamente o que este desenho desfaz.
 */
export const coreThemePlugin: PluginRecord = {
  trusted: true,
  manifest: {
    id: 'core.theme',
    version: '1.0.0',
    kernel: '^1.0.0',
    // eslint-disable-next-line no-restricted-syntax -- metadado do plugin do NÚCLEO: não é renderizado.
    name: 'Appearance Core',
    description:
      // eslint-disable-next-line no-restricted-syntax -- metadado do plugin do NÚCLEO: não é renderizado.
      'Declares the theme extension points and the organization appearance preference.',
    dependencies: { 'core.ui': '^1.0.0' },
    extensionPoints: THEME_EXTENSION_POINTS,
    contributes: [
      messageBundleContribution(coreMessage('core.theme', CORE_THEME_MESSAGES)),
      settingsSection({
        key: 'theme',
        title: '@core.theme/section.title',
        description: '@core.theme/section.description',
        icon: 'palette',
        order: 6,
        properties: [
          {
            key: 'theme.selected',
            label: '@core.theme/setting.label',
            description: '@core.theme/setting.description',
            type: 'theme',
            default: AUTOMATIC_THEME,
            scopes: ['tenant', 'user'],
          },
        ],
      }),
    ],
  },
};
