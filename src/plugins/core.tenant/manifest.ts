import type { PluginRecord } from '../../kernel';
import { lazyView, nav, page, settingsSection, surfaceTab } from '../contributionBuilders';
import { messageBundleContribution } from '../../domain/schema/i18n/extensionPoints';
import { ADMIN_NAV_GROUP, UI_TAB_POINT } from '../../domain/schema/ui/uiExtensionPoints';
import { coreMessage, CORE_TENANT_MESSAGES } from '../coreMessages';
import { coreTenantPtBrContribution } from './messagesPtBr';
import { TENANT_SETTINGS_SURFACE } from './surface';
import { PORTAL_EXTENSION_POINTS } from '../../domain/schema/portalExtensionPoints';
import {
  PERMISSION_AI_MANAGE,
  PERMISSION_MEMBERS_MANAGE,
  PERMISSION_MFA_MANAGE,
  PERMISSION_PORTAL_MANAGE,
  PERMISSION_ROLES_MANAGE,
  PERMISSION_TENANT_PREFIX_MANAGE,
} from '../../domain/schema/access';
import { ARTIFACT_PREFIX_PATTERN, ARTIFACT_PREFIX_SETTING } from '../../domain/schema/plugin/artifactPrefix';

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
    RolesTabView: lazyView(() => import('../../presentation/pages/TenantSettings/RolesTab/RolesTab.view'), 'RolesTabView'),
    AITabView: lazyView(() => import('../../presentation/pages/TenantSettings/AITab/AITab.view'), 'AITabView'),
    AgentTabView: lazyView(() => import('../../presentation/pages/TenantSettings/AgentTab/AgentTab.view'), 'AgentTabView'),
    PortalTabView: lazyView(() => import('../../presentation/pages/TenantSettings/PortalTab/PortalTab.view'), 'PortalTabView'),
    SecurityTabView: lazyView(() => import('../../presentation/pages/TenantSettings/SecurityTab/SecurityTab.view'), 'SecurityTabView'),
  },
  manifest: {
    id: 'core.tenant',
    version: '1.0.0',
    kernel: '^2.0.0',
    // eslint-disable-next-line no-restricted-syntax -- metadado do plugin do NÚCLEO: não é renderizado.
    name: 'Organization',
    description:
      // eslint-disable-next-line no-restricted-syntax -- metadado do plugin do NÚCLEO: não é renderizado.
      'The organization record, its members and its AI connections, on a tab surface any extension can join.',
    dependencies: { 'core.ui': '^1.0.0', 'core.access': '^1.0.0' },
    extensionPoints: PORTAL_EXTENSION_POINTS,
    contributes: [
      messageBundleContribution(coreMessage('core.tenant', CORE_TENANT_MESSAGES)),
      coreTenantPtBrContribution(),
      page({ key: 'tenant-settings', title: '@core.tenant/page.tenant-settings', icon: 'building', fullBleed: true }, 'TenantSettingsView'),
      page({ key: '', keyPrefix: 'tenant-settings:', title: '@core.tenant/page.tenant-settings', icon: 'building', fullBleed: true }, 'TenantSettingsView'),
      nav({ key: 'tenant-settings', label: '@core.tenant/nav.tenant-settings', icon: 'building', order: 110, group: ADMIN_NAV_GROUP }),
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
        requiredPermissions: [PERMISSION_MEMBERS_MANAGE],
      }, 'MembersTabView'),
      // O segundo fator: quem precisa dele para entrar, e o de quem perdeu o celular. Ao lado de Membros
      // porque é a mesma pergunta — quem entra aqui —, e com permissão própria porque afrouxá-la é tirar
      // uma barreira de todo mundo.
      surfaceTab({
        surface: TENANT_SETTINGS_SURFACE,
        key: 'security',
        title: '@core.access/mfa.tab.label',
        icon: 'shieldUser',
        order: 21,
        requiredPermissions: [PERMISSION_MFA_MANAGE],
      }, 'SecurityTabView'),
      // Quem é de FORA do escritório. Ao lado de Membros porque é a mesma pergunta — quem entra aqui —
      // com a resposta oposta: o convidado não é membro, e só vê o que é dele.
      surfaceTab({
        surface: TENANT_SETTINGS_SURFACE,
        key: 'portal',
        title: '@core.tenant/tenant.tab.portal',
        icon: 'team',
        order: 22,
        requiredPermissions: [PERMISSION_PORTAL_MANAGE],
      }, 'PortalTabView'),
      surfaceTab({
        surface: TENANT_SETTINGS_SURFACE,
        key: 'roles',
        title: '@core.access/resource.roles',
        icon: 'shieldUser',
        order: 25,
        requiredPermissions: [PERMISSION_ROLES_MANAGE],
      }, 'RolesTabView'),
      surfaceTab({
        surface: TENANT_SETTINGS_SURFACE,
        key: 'ai',
        title: '@core.tenant/tenant.tab.ai',
        icon: 'sparkling',
        order: 30,
        requiredPermissions: [PERMISSION_AI_MANAGE],
      }, 'AITabView'),
      // A aba dos acessos de agente de IA.
      //
      // Ela mora aqui, e não na extensão que liga o recurso, porque o que ela manipula é do KERNEL:
      // a coleção `agentGrants` é reservada, as callables validam contra o catálogo de permissões do
      // escritório, e o seletor de permissões precisa desse catálogo — que a API curada das
      // extensões não expõe, e não deveria expor por causa de uma tela.
      //
      // O que a extensão decide é se o recurso está NO AR (`manifest.backend.functions`), e a aba
      // pergunta isso pelo nome da function em vez do id do pacote: `agentAvailability` responde
      // `disabled`, `pending` ou `ready`, e a aba diz qual é.
      //
      // Sem `requiredPermissions`: emitir um acesso para si mesmo não concede nada de novo — a
      // interseção garante que ele nunca exceda quem o emitiu. `agent.manage` governa VER e REVOGAR
      // o de outra pessoa, o que a própria aba decide por linha.
      surfaceTab({
        surface: TENANT_SETTINGS_SURFACE,
        key: 'agent',
        title: '@core.access/agent.tab',
        icon: 'sparkling',
        order: 35,
      }, 'AgentTabView'),
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
      // O prefixo de tudo o que o escritório cria. Sorteado na criação do escritório; trocá-lo vale só
      // para o que for criado depois. A regra do Firestore cobra a permissão própria quando ESTA chave
      // muda — `settings.manage` sozinha não basta.
      settingsSection({
        key: 'customization',
        title: '@core.tenant/settings.prefix.section.title',
        description: '@core.tenant/settings.prefix.section.description',
        icon: 'codeBox',
        order: 8,
        requiredPermissions: [PERMISSION_TENANT_PREFIX_MANAGE],
        properties: [
          {
            key: ARTIFACT_PREFIX_SETTING,
            label: '@core.tenant/settings.prefix.label',
            description: '@core.tenant/settings.prefix.description',
            type: 'text',
            default: '',
            pattern: ARTIFACT_PREFIX_PATTERN.source,
            scopes: ['tenant'],
          },
        ],
      }),
    ],
  },
};
