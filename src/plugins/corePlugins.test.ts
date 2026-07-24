import { describe, it, expect } from 'vitest';
import { createPluginHost } from '../kernel';
import type { PluginRecord } from '../kernel';
import {
  navMetadataOf,
  pageMetadataOf,
  resolvePageContribution,
  visibleNavItems,
} from '../presentation/shared/resolveUiContributions';
import { UI_COMMAND_POINT, UI_NAV_POINT, UI_PAGE_POINT } from '../presentation/shared/uiExtensionPoints';
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
  'access-management', 'actions', 'add-news', 'audit-logs', 'calendar', 'cases', 'contracts',
  'dashboard', 'dashboard-pushes', 'data-function-reference', 'data-processor', 'deadlines',
  'dyn:', 'edit-news:', 'edit-workflow-step:', 'financial-dashboard', 'financials',
  'function-reference', 'new-action', 'new-case', 'new-case:clone:', 'new-contract',
  'new-contract:clone:', 'new-deadline', 'new-dyn:', 'new-financial', 'new-financial:clone:',
  'new-person', 'new-person:clone:', 'new-script', 'new-workflow', 'new-workflow:clone:', 'news',
  'persons', 'profile', 'pushes', 'screen-builder', 'scripts', 'tenant-settings',
  'tenant-settings:', 'view-action:', 'view-case:', 'view-contract:', 'view-deadline:',
  'view-dyn:', 'view-financial:', 'view-news:', 'view-person:', 'view-script:', 'view-workflow:',
  'workflows',
  // Adicionadas depois da migração (a lista é o guarda de "nenhuma tela some", não um congelamento):
  'marketplace', 'plugin-author', 'plugin-author:',
].sort();

describe('core plugins — carga', () => {
  it('carrega os 12 plugins internos sem nenhum diagnóstico', () => {
    const { result } = hostWith(CORE_PLUGINS);
    expect(result.diagnostics).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(result.loaded).toHaveLength(CORE_PLUGINS.length);
  });

  it('carrega core.ui antes de quem depende dele', () => {
    const { result } = hostWith(CORE_PLUGINS);
    const posicao = (id: string) => result.loaded.indexOf(id);
    expect(posicao('core.ui')).toBeLessThan(posicao('core.persons'));
    expect(posicao('core.ui')).toBeLessThan(posicao('core.workspace'));
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
      expect(resolvePageContribution(pages, target), `menu "${target}" sem tela`).toBeDefined();
    }
  });

  it('o menu preserva a ordem que tinha antes da migração', () => {
    const { host } = hostWith(CORE_PLUGINS);
    const items = visibleNavItems(host.contributions.query(UI_NAV_POINT), {
      isSystemAdmin: true,
      isTenantAdmin: true,
    });

    expect(items.map((item) => item.key)).toEqual([
      'dashboard', 'calendar', 'persons', 'cases', 'contracts', 'deadlines',
      'financials', 'pushes', 'news', 'tenant-settings', 'audit-logs',
    ]);
  });

  it('esconde Auditoria de quem não é admin', () => {
    const { host } = hostWith(CORE_PLUGINS);
    const items = visibleNavItems(host.contributions.query(UI_NAV_POINT), {
      isSystemAdmin: false,
      isTenantAdmin: false,
    });
    expect(items.map((item) => item.key)).not.toContain('audit-logs');
  });
});

describe('core plugins — resolução de aba', () => {
  const { host } = hostWith(CORE_PLUGINS);
  const pages = () => host.contributions.query(UI_PAGE_POINT);

  it.each([
    ['persons', 'PersonsView'],
    ['view-person:abc123', 'ViewPersonView'],
    ['new-person:clone:abc123', 'ViewPersonView'],
    ['view-case:xyz', 'ViewCaseView'],
    ['dyn:minha-tela', 'DynamicRecordListView'],
    ['view-dyn:minha-tela:reg1', 'ViewDynamicRecordView'],
    ['tenant-settings', 'TenantSettingsView'],
    ['tenant-settings:membros', 'TenantSettingsView'],
  ])('resolve "%s" para %s', (tabKey, implKey) => {
    const contribution = resolvePageContribution(pages(), tabKey);
    expect(contribution?.impl).toMatchObject({ kind: 'code', key: implKey });
  });

  it('prefere o prefixo mais longo quando dois casam', () => {
    const contribution = resolvePageContribution(pages(), 'new-person:clone:abc');
    expect(pageMetadataOf(contribution!).keyPrefix).toBe('new-person:clone:');
  });

  it('devolve undefined para aba desconhecida', () => {
    expect(resolvePageContribution(pages(), 'nao-existe')).toBeUndefined();
  });
});

describe('core plugins — remoção limpa (critério de aceite da Etapa 2)', () => {
  it('remover core.persons some com a tela, o item de menu e o comando ⌘K', () => {
    const { host, result } = hostWith(without('core.persons'));

    expect(result.diagnostics).toEqual([]);
    expect(host.isLoaded('core.persons')).toBe(false);

    const pages = host.contributions.query(UI_PAGE_POINT);
    expect(resolvePageContribution(pages, 'persons')).toBeUndefined();
    expect(resolvePageContribution(pages, 'view-person:abc')).toBeUndefined();

    const navKeys = host.contributions.query(UI_NAV_POINT).map((c) => navMetadataOf(c).key);
    expect(navKeys).not.toContain('persons');

    const commandIds = host.contributions.query(UI_COMMAND_POINT).map((c) => c.id);
    expect(commandIds).not.toContain('person');

    expect(host.implementations.keysOf('core.persons')).toEqual([]);
  });

  it('os demais módulos continuam intactos após a remoção', () => {
    const { host } = hostWith(without('core.persons'));
    const pages = host.contributions.query(UI_PAGE_POINT);

    expect(resolvePageContribution(pages, 'cases')).toBeDefined();
    expect(resolvePageContribution(pages, 'financials')).toBeDefined();
    expect(host.contributions.query(UI_NAV_POINT).length).toBe(10);
  });

  it('remover core.ui derruba todos os módulos de UI, porque ninguém declara os pontos', () => {
    const { host, result } = hostWith(without('core.ui'));

    // Só core.data sobrevive: declara os próprios pontos e não depende de core.ui.
    expect(result.loaded).toEqual(['core.data']);
    expect(host.contributions.query(UI_PAGE_POINT)).toEqual([]);
    expect(
      result.diagnostics.filter((d) => d.pluginId !== 'core.data').every((d) => d.code === 'dependency.missing'),
    ).toBe(true);
  });
});
