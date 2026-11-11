import { describe, it, expect } from 'vitest';
import { createPluginHost } from '../kernel';
import type { PluginRecord } from '../kernel';
import {
  declaredNavGroups,
  groupNavSections,
  navMetadataOf,
  pageMetadataOf,
  resolvePageContribution,
  visibleNavItems,
} from '../presentation/shared/resolveUiContributions';
import { ADMIN_NAV_GROUP, AUTOMATION_NAV_GROUP, CUSTOMIZATION_NAV_GROUP, UI_COMMAND_POINT, UI_NAV_GROUP_POINT, UI_NAV_POINT, UI_PAGE_POINT } from '../domain/schema/ui/uiExtensionPoints';
import { CORE_PLUGINS } from './index';

const hostWith = (records: PluginRecord[]) => {
  const host = createPluginHost();
  const result = host.load(records);
  return { host, result };
};

const without = (pluginId: string): PluginRecord[] =>
  CORE_PLUGINS.filter((record) => record.manifest.id !== pluginId);

/**
 * Lista extraída do PAGE_REGISTRY que existia antes da migração para contribuições. É o guarda
 * de regressão da Etapa 2: se uma tela se perder no caminho, este teste acusa.
 */
const PAGE_KEYS_ANTES_DA_MIGRACAO = [
  'access-management', 'actions', 'audit-logs',
  'data-function-reference', 'data-processor',
  'dyn:', 'edit-workflow-step:',
  'function-reference', 'new-action',
  'new-dyn:',
  'new-script', 'new-workflow', 'new-workflow:clone:',
  'profile', 'screen-builder', 'scripts', 'tenant-settings',
  'tenant-settings:', 'view-action:',
  'view-dyn:', 'view-script:', 'view-workflow:',
  'workflows',
  // Adicionadas depois da migração (a lista é o guarda de "nenhuma tela some", não um congelamento):
  'marketplace', 'plugin-author', 'plugin-author:', 'rep:', 'report-design', 'report-design:',
  'reports', 'settings', 'translations',
  'license', 'document-templates', 'downloads', 'settings:', 'notifications',
  'workflow-tasks',
].sort();

describe('core plugins — carga', () => {
  it('carrega os plugins internos sem nenhum diagnóstico', () => {
    const { result } = hostWith(CORE_PLUGINS);
    expect(result.diagnostics).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(result.loaded).toHaveLength(CORE_PLUGINS.length);
  });

  it('carrega core.ui antes de quem depende dele', () => {
    const { result } = hostWith(CORE_PLUGINS);
    const posicao = (id: string) => result.loaded.indexOf(id);
    expect(posicao('core.ui')).toBeLessThan(posicao('core.workspace'));
    expect(posicao('core.ui')).toBeLessThan(posicao('core.records'));
  });

  it('toda contribuição de tela resolve um componente', () => {
    const { host } = hostWith(CORE_PLUGINS);
    const unresolved = host.contributions.query(UI_PAGE_POINT).filter((contribution) => {
      if (contribution.impl?.kind !== 'code') return true;
      return !host.implementations.has(contribution.pluginId, contribution.impl.key);
    });
    expect(unresolved).toEqual([]);
  });

  it('todo provedor de ⌘K resolve uma implementação', () => {
    const { host } = hostWith(CORE_PLUGINS);
    const providers = host.contributions.query(UI_COMMAND_POINT);
    expect(providers.length).toBeGreaterThan(0);
    for (const contribution of providers) {
      expect(contribution.impl?.kind).toBe('code');
    }
  });
});

describe('core plugins — paridade com o registro anterior', () => {
  it('nenhuma tela se perdeu na migração', () => {
    const { host } = hostWith(CORE_PLUGINS);
    const keys = host.contributions
      .query(UI_PAGE_POINT)
      .map((contribution) => {
        const metadata = pageMetadataOf(contribution);
        return metadata.key || metadata.keyPrefix || '';
      })
      .sort();

    expect(keys).toEqual(PAGE_KEYS_ANTES_DA_MIGRACAO);
  });

  it('nenhuma chave de tela é declarada por dois plugins', () => {
    const { host } = hostWith(CORE_PLUGINS);
    const keys = host.contributions.query(UI_PAGE_POINT).map((contribution) => {
      const metadata = pageMetadataOf(contribution);
      return metadata.key || metadata.keyPrefix;
    });
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('todo item de menu aponta para uma tela que existe', () => {
    const { host } = hostWith(CORE_PLUGINS);
    const pages = host.contributions.query(UI_PAGE_POINT);

    for (const contribution of host.contributions.query(UI_NAV_POINT)) {
      const target = navMetadataOf(contribution).key;
      expect(resolvePageContribution(pages, target ?? ''), `menu "${target}" sem tela`).toBeDefined();
    }
  });

  /**
   * As ferramentas que moravam no menu do usuário vieram para a barra lateral, cada uma no grupo do
   * objetivo dela. O menu do usuário ficou com o que é da PESSOA — o perfil e a aparência.
   */
  it('o menu do núcleo se reparte em Personalização, Automação e Administração, abaixo de Relatórios e Downloads', () => {
    const { host } = hostWith(CORE_PLUGINS);
    const items = visibleNavItems(host.contributions.query(UI_NAV_POINT), () => true, true);
    const sections = groupNavSections(items, declaredNavGroups(host.contributions.query(UI_NAV_GROUP_POINT)));

    expect(sections.map((section) => [section.group?.key ?? null, section.items.map((item) => item.key)])).toEqual([
      // A caixa de tarefas é de todo membro, e fica no alto: é o que está esperando a pessoa.
      [null, ['workflow-tasks', 'reports', 'downloads']],
      [CUSTOMIZATION_NAV_GROUP, ['screen-builder', 'document-templates', 'marketplace']],
      [AUTOMATION_NAV_GROUP, ['workflows', 'scripts', 'actions', 'data-processor']],
      [ADMIN_NAV_GROUP, ['tenant-settings', 'settings', 'translations', 'audit-logs', 'access-management']],
    ]);
  });

  it('a gestão de acessos só aparece para o administrador global', () => {
    const { host } = hostWith(CORE_PLUGINS);
    const keys = visibleNavItems(host.contributions.query(UI_NAV_POINT), () => true, false).map((item) => item.key);
    expect(keys).not.toContain('access-management');
  });

  it('esconde Auditoria de quem não tem a permissão de leitura dela', () => {
    const { host } = hostWith(CORE_PLUGINS);
    const items = visibleNavItems(host.contributions.query(UI_NAV_POINT), () => false, false);
    expect(items.map((item) => item.key)).not.toContain('audit-logs');
  });
});

describe('core plugins — resolução de aba', () => {
  const { host } = hostWith(CORE_PLUGINS);
  const pages = () => host.contributions.query(UI_PAGE_POINT);

  it.each([
    ['dyn:minha-tela', 'DynamicRecordListView'],
    ['view-dyn:minha-tela:reg1', 'ViewDynamicRecordView'],
    ['tenant-settings', 'TenantSettingsView'],
    ['tenant-settings:membros', 'TenantSettingsView'],
    ['reports', 'ReportsView'],
    ['rep:faturamento', 'ViewReportView'],
    ['report-design', 'ReportDesignView'],
    ['report-design:faturamento', 'ReportDesignView'],
  ])('resolve "%s" para %s', (tabKey, implKey) => {
    const contribution = resolvePageContribution(pages(), tabKey);
    expect(contribution?.impl).toMatchObject({ kind: 'code', key: implKey });
  });

  it('prefere o prefixo mais longo quando dois casam', () => {
    const contribution = resolvePageContribution(pages(), 'new-workflow:clone:abc');
    expect(pageMetadataOf(contribution!).keyPrefix).toBe('new-workflow:clone:');
  });

  it('devolve undefined para aba desconhecida', () => {
    expect(resolvePageContribution(pages(), 'nao-existe')).toBeUndefined();
  });
});

describe('core plugins — remoção limpa (critério de aceite da Etapa 2)', () => {
  it('remover core.workspace some com as telas, os itens de menu e os comandos ⌘K', () => {
    const { host, result } = hostWith(without('core.workspace'));

    expect(result.diagnostics).toEqual([]);
    expect(host.isLoaded('core.workspace')).toBe(false);

    const pages = host.contributions.query(UI_PAGE_POINT);
    expect(resolvePageContribution(pages, 'profile')).toBeUndefined();

    const commandIds = host.contributions.query(UI_COMMAND_POINT).map((c) => c.id);
    expect(commandIds).not.toContain('navigation');

    expect(host.implementations.keysOf('core.workspace')).toEqual([]);
  });

  it('os demais módulos continuam intactos após a remoção', () => {
    const { host } = hostWith(without('core.workspace'));
    const pages = host.contributions.query(UI_PAGE_POINT);

    expect(resolvePageContribution(pages, 'audit-logs')).toBeDefined();
    expect(host.contributions.query(UI_NAV_POINT).length).toBe(15);
  });

  it('remover core.ui derruba todos os módulos de UI, porque ninguém declara os pontos', () => {
    const { host, result } = hostWith(without('core.ui'));

    // Sobrevivem os que declaram os PRÓPRIOS pontos e não dependem de core.ui: o controle de acesso,
    // os dados e a entrada no sistema. É a lista de quem não é interface — a tela de entrada é
    // desenhada pela interface, mas o ponto que declara COMO se entra não depende dela.
    //
    // `core.reports` NÃO está aqui, e é correto que não esteja: o ponto `report.definition` é dele,
    // mas ele também contribui o menu e as abas onde o relatório aparece. Um relatório que não tem
    // onde ser mostrado não é meio relatório — é nenhum.
    expect(result.loaded).toEqual(['core.access', 'core.auth', 'core.data']);
    expect(host.contributions.query(UI_PAGE_POINT)).toEqual([]);
    // A cascata tem DOIS níveis desde que core.license passou a depender de core.i18n: quem depende
    // direto de core.ui cai com `dependency.missing`, e quem depende de um caído cai com
    // `dependency.disabled`. Aceitar os dois é o que prova que a queda é transitiva.
    expect(
      result.diagnostics
        .filter((d) => !['core.access', 'core.auth', 'core.data'].includes(d.pluginId ?? ''))
        .every((d) => d.code === 'dependency.missing' || d.code === 'dependency.disabled'),
    ).toBe(true);
  });
});
