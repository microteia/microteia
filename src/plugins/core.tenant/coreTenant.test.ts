import { describe, expect, it } from 'vitest';
import { createPluginHost } from '../../kernel';
import { hasErrors } from '../../domain/schema/plugin/diagnostics';
import { CORE_PLUGINS } from '../index';
import { UI_TAB_POINT, type UiTabMetadata } from '../../domain/schema/ui/uiExtensionPoints';
import { I18N_MESSAGES_POINT, messageBundlesOf } from '../../domain/schema/i18n/extensionPoints';
import { buildMessageCatalog } from '../../domain/schema/i18n/messages';
import { resolveLabel } from '../../domain/schema/i18n/messageRef';
import { RESERVED_COLLECTIONS } from '../../domain/schema/screenEntity';
import { ENTITY_REGISTRY } from '../../domain/schema/entityRegistry';
import { createSchemaContext } from '../../domain/schema/pathResolver';
import { deriveFormFields } from '../../presentation/shared/deriveEntitySchema';
import { TENANT_SETTINGS_SURFACE } from './surface';

const loadedHost = () => {
  const host = createPluginHost();
  const result = host.load(CORE_PLUGINS);
  return { host, result };
};

const tabsOf = (surface: string): UiTabMetadata[] => {
  const { host } = loadedHost();
  return host.contributions
    .query(UI_TAB_POINT)
    .map((contribution) => contribution.metadata as unknown as UiTabMetadata)
    .filter((metadata) => metadata.surface === surface);
};

describe('core.tenant — o escritório como plugin', () => {
  it('carrega junto dos demais plugins do núcleo, sem diagnóstico', () => {
    const { result } = loadedHost();
    expect(hasErrors(result.diagnostics)).toBe(false);
    expect(result.loaded).toContain('core.tenant');
  });

  /**
   * As três abas que a tela tinha escritas à mão passaram a ser contribuições. O teste não afirma
   * que são TRÊS — afirma que são contribuições, e que a quarta cabe pelo mesmo caminho.
   */
  it('entrega as abas como contribuição, não como código da tela', () => {
    const tabs = tabsOf(TENANT_SETTINGS_SURFACE);
    expect(tabs.map((tab) => tab.key).sort()).toEqual(['agent', 'ai', 'email', 'members', 'office', 'roles']);
  });

  it('deixa a aba de dados aberta a todo membro e as de gestão atrás de uma permissão', () => {
    const byKey = new Map(tabsOf(TENANT_SETTINGS_SURFACE).map((tab) => [tab.key, tab]));
    expect(byKey.get('office')?.requiredPermissions).toBeUndefined();
    expect(byKey.get('members')?.requiredPermissions).toEqual(['members.manage']);
    expect(byKey.get('roles')?.requiredPermissions).toEqual(['roles.manage']);
    expect(byKey.get('ai')?.requiredPermissions).toEqual(['ai.manage']);
    // A dos agentes de IA é a segunda aberta a todo membro, e por um motivo próprio: emitir um
    // acesso para si mesmo não concede nada — a interseção garante que ele nunca exceda quem o
    // emitiu. `agent.manage` governa ver e revogar o de OUTRA pessoa, o que a aba decide por linha.
    expect(byKey.get('agent')?.requiredPermissions).toBeUndefined();
    // A do e-mail de saída vem de OUTRO plugin — o dono do passo Notificar —, e entra pela mesma
    // superfície que qualquer extensão usaria. É credencial do escritório: só quem grava Configurações.
    expect(byKey.get('email')?.requiredPermissions).toEqual(['settings.manage']);
  });

  it('toda aba resolve o componente que declara', () => {
    const { host } = loadedHost();
    const unresolved = host.contributions.query(UI_TAB_POINT).filter((contribution) => {
      if (contribution.impl?.kind !== 'code') return true;
      return !host.implementations.has(contribution.pluginId, contribution.impl.key);
    });
    expect(unresolved).toEqual([]);
  });
});

describe('core.tenant — o texto é dele', () => {
  const catalogFor = (locale: string) => {
    const { host } = loadedHost();
    return buildMessageCatalog(messageBundlesOf(host.contributions.query(I18N_MESSAGES_POINT)), locale);
  };

  it('publica o idioma-fonte no namespace próprio', () => {
    expect(resolveLabel(catalogFor('en'), '@core.tenant/page.tenant-settings')).toBe('Organization');
  });

  /**
   * A tradução viaja DENTRO do plugin, e é isso que a faz valer sem nenhum pacote de idioma
   * instalado — o desenho que qualquer extensão vai seguir.
   */
  it('traduz a si mesmo sem depender de pacote de idioma instalado', () => {
    expect(resolveLabel(catalogFor('pt-BR'), '@core.tenant/page.tenant-settings')).toBe('Escritório');
  });

  it('não deixou chave sua para trás no catálogo da administração', () => {
    const catalog = catalogFor('en');
    expect(resolveLabel(catalog, '@core.admin/page.audit-logs')).toBe('Audit Log');
    expect(resolveLabel(catalog, '@core.admin/office.name')).toBe('core.admin/office.name');
  });
});

describe('core.tenant — o formulário do escritório é dado', () => {
  /**
   * A prova de que a aba "Dados do Escritório" passou a ser customizável: os campos dela saem do
   * MESMO `deriveFormFields` das demais telas, e a entidade aceita campo do tenant.
   */
  it('deriva os campos do escritório pelo caminho comum a todas as telas', () => {
    const fields = deriveFormFields(createSchemaContext(), 'tenant');
    expect(fields.map((field) => field.key)).toEqual(['name', 'email', 'phone', 'address']);
    expect(fields.every((field) => field.origin === 'builtin')).toBe(true);
  });

  it('aceita campo acrescentado pelo escritório, como qualquer tela fixa', () => {
    expect(ENTITY_REGISTRY.tenant.supportsCustomFields).toBe(true);
  });

  /**
   * O nome está reservado porque a entidade descreve o DOCUMENTO do escritório, não uma subcoleção:
   * uma tela do Form Design que reivindicasse `tenant` criaria registros que ninguém lê.
   */
  it('reserva o nome da coleção contra uma tela de mesmo nome', () => {
    expect(RESERVED_COLLECTIONS.has('tenant')).toBe(true);
  });
});
