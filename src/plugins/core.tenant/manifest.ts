import type { PluginRecord } from '../../kernel';
import { lazyView, nav, page, settingsSection, surfaceTab } from '../contributionBuilders';
import { messageBundleContribution } from '../../domain/schema/i18n/extensionPoints';
import { UI_TAB_POINT } from '../../domain/schema/ui/uiExtensionPoints';
import { coreMessage, CORE_TENANT_MESSAGES } from '../coreMessages';
import { coreTenantPtBrContribution } from './messagesPtBr';
import { TENANT_SETTINGS_SURFACE } from './surface';

/**
 * **O Escritório** — o cadastro da organização, os membros e as conexões de IA.
 *
 * Era tela do `core.admin`, com três abas escritas à mão dentro de um `switch`. Virou plugin pelos
 * mesmos motivos que fizeram Pessoa e Processo saírem do kernel, e ganha três coisas com isso:
 *
 * 1. **O formulário do escritório é dado.** A aba "Dados do Escritório" renderiza a entidade
 *    `tenant` do registro pelo mesmo `CustomFieldsSection` das demais telas — então o escritório
 *    acrescenta campos próprios a ela no Form Design, sem commit no núcleo.
 * 2. **As abas são contribuições.** Uma extensão acrescenta a quarta aba declarando `ui.tab` nesta
 *    superfície; o escritório liga, desliga e reordena todas em Configurações.
 * 3. **O texto é dele.** O catálogo `core.tenant` nasce em inglês aqui, e a tradução pt-BR viaja no
 *    próprio plugin — que é como uma extensão deve chegar: legível sem depender de pacote de
 *    idioma de terceiro.
 *
 * Ele viaja no bundle, em `CORE_PLUGINS`, e não instalado por escritório. Disso decorre o que o
 * torna especial e nada mais: está sempre presente, e **não há como desinstalá-lo, porque não há
 * instalação a desfazer** — o mesmo desenho dos temas Escuro e Claro.
 */
export const coreTenantPlugin: PluginRecord = {
  trusted: true,
  implementations: {
    TenantSettingsView: lazyView(() => import('../../presentation/pages/TenantSettings/TenantSettings.view'), 'TenantSettingsView'),
    OfficeTabView: lazyView(() => import('../../presentation/pages/TenantSettings/OfficeTab/OfficeTab.view'), 'OfficeTabView'),
    MembersTabView: lazyView(() => import('../../presentation/pages/TenantSettings/MembersTab/MembersTab.view'), 'MembersTabView'),
    AITabView: lazyView(() => import('../../presentation/pages/TenantSettings/AITab/AITab.view'), 'AITabView'),
  },
  manifest: {
    id: 'core.tenant',
    version: '1.0.0',
    kernel: '^1.0.0',
    name: 'Organization',
    description:
      // eslint-disable-next-line no-restricted-syntax -- metadado do plugin do NÚCLEO: não é renderizado.
      'The organization record, its members and its AI connections, on a tab surface any extension can join.',
    dependencies: { 'core.ui': '^1.0.0' },
    contributes: [
      messageBundleContribution(coreMessage('core.tenant', CORE_TENANT_MESSAGES)),
      coreTenantPtBrContribution(),
      page({ key: 'tenant-settings', title: '@core.tenant/page.tenant-settings', icon: 'building', fullBleed: true }, 'TenantSettingsView'),
      page({ key: '', keyPrefix: 'tenant-settings:', title: '@core.tenant/page.tenant-settings', icon: 'building', fullBleed: true }, 'TenantSettingsView'),
      nav({ key: 'tenant-settings', label: '@core.tenant/nav.tenant-settings', icon: 'building', order: 110 }),
      surfaceTab({
        surface: TENANT_SETTINGS_SURFACE,
        key: 'office',
        title: '@core.tenant/tenant.tab.office',
        icon: 'building',
        order: 10,
      }, 'OfficeTabView'),
      surfaceTab({
        surface: TENANT_SETTINGS_SURFACE,
        key: 'members',
        title: '@core.tenant/tenant.tab.members',
        icon: 'team',
        order: 20,
        requiresTenantAdmin: true,
      }, 'MembersTabView'),
      surfaceTab({
        surface: TENANT_SETTINGS_SURFACE,
        key: 'ai',
        title: '@core.tenant/tenant.tab.ai',
        icon: 'sparkling',
        order: 30,
        requiresTenantAdmin: true,
      }, 'AITabView'),
      settingsSection({
        key: 'tenant-settings',
        title: '@core.tenant/settings.section.title',
        description: '@core.tenant/settings.section.description',
        icon: 'building',
        order: 7,
        properties: [
          {
            key: 'tenant-settings.tabs',
            label: '@core.tenant/settings.tabs',
            description: '@core.tenant/settings.tabs.description',
            type: 'contributions',
            default: [],
            scopes: ['tenant', 'user'],
            point: UI_TAB_POINT,
            surface: TENANT_SETTINGS_SURFACE,
          },
        ],
      }),
    ],
  },
};
