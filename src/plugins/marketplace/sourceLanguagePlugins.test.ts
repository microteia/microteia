import { describe, expect, it } from 'vitest';
import { createPluginHost } from '../../kernel';
import { CORE_PLUGINS } from '..';
import { installedPluginRecords } from '../../domain/usecases/plugins/installedPluginRecords';
import { I18N_MESSAGES_POINT, messageBundlesOf } from '../../domain/schema/i18n/extensionPoints';
import { buildMessageCatalog } from '../../domain/schema/i18n/messages';
import { isMessageRef, parseMessageRef, resolveLabel } from '../../domain/schema/i18n/messageRef';
import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import type { PluginInstallation } from '../../domain/entities/PluginInstallation';
import { calendarPlugin } from './calendar';
import { dashboardPlugin } from './dashboard';
import { newsPlugin } from './news';

/**
 * As extensões AGNÓSTICAS de negócio — Calendário, Painel e Notícias. Uma agenda, uma tela de abertura
 * e um mural não pertencem a um ramo: servem a qualquer escritório, e por isso nascem no idioma-fonte
 * com a tradução viajando dentro do próprio pacote.
 *
 * O que este arquivo guarda não é a tradução de hoje — é a REGRA. O gate de mensagens confere que toda
 * chave usada existe; aqui o sentido é o inverso e complementar: nenhum texto de usuário do pacote pode
 * ser uma frase. A varredura é CEGA de propósito. Uma lista de pontos a conferir (o nome, o resumo, os
 * campos…) envelhece na primeira propriedade nova, e é exatamente a propriedade nova que ninguém
 * lembra de traduzir.
 */
const PLUGINS: MarketplacePlugin[] = [calendarPlugin, dashboardPlugin, newsPlugin];

const installation = (pluginId: string): PluginInstallation => ({
  pluginId,
  tenantId: 't1',
  version: '1.0.0',
  enabled: true,
  config: {},
  grantedPermissions: [],
  installedAt: new Date(),
  installedBy: 'u1',
  updatedAt: new Date(),
});

const catalogFor = (locale: string) => {
  const host = createPluginHost();
  host.load([
    ...CORE_PLUGINS,
    ...installedPluginRecords(PLUGINS, PLUGINS.map((plugin) => installation(plugin.manifest.id))),
  ]);
  return buildMessageCatalog(messageBundlesOf(host.contributions.query(I18N_MESSAGES_POINT)), locale);
};

/**
 * As propriedades que CARREGAM texto de usuário, em qualquer lugar do pacote. É a mesma lista do
 * seletor de ESLint que cobra o literal numa propriedade — de propósito: as duas respondem à mesma
 * pergunta ("isto é lido por quem usa o sistema?") e discordar seria ter duas verdades.
 *
 * `category` é a exceção, e a razão é de ESCOPO, não de discordância: dentro de um pacote ela é a
 * categoria que a extensão mostra no Marketplace, mas fora dele a mesma palavra nomeia o
 * agrupamento técnico dos passos de automação (`workflowStepCatalog`), e um seletor de ESLint não
 * distingue os dois. Aqui a varredura é só destes três pacotes, então a pergunta tem uma resposta.
 */
const TEXT_KEYS = new Set([
  'name', 'description', 'summary', 'category', 'title', 'titleSingular', 'titlePlural',
  'label', 'placeholder', 'message', 'content', 'text', 'value', 'emptyMessage', 'hint', 'subtitle',
]);

/** `publisher.name` é MARCA, e marca não traduz. `views[].source` é código, não texto. */
const SKIPPED_SUBTREES = new Set(['publisher', 'source', 'startup']);

const textsOf = (plugin: MarketplacePlugin): Array<{ path: string; value: string }> => {
  const found: Array<{ path: string; value: string }> = [];

  const walk = (node: unknown, path: string): void => {
    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, `${path}[${index}]`));
      return;
    }
    if (node === null || typeof node !== 'object') return;

    const record = node as Record<string, unknown>;
    // O bundle de mensagens é o CATÁLOGO, não uma declaração: as frases dele são o destino das
    // referências, e cobrá-las aqui seria exigir que a tradução fosse ela mesma uma referência.
    if (record.point === I18N_MESSAGES_POINT) return;

    for (const [key, value] of Object.entries(record)) {
      if (SKIPPED_SUBTREES.has(key)) continue;
      if (typeof value === 'string') {
        if (TEXT_KEYS.has(key) && value !== '') found.push({ path: `${path}.${key}`, value });
        continue;
      }
      walk(value, `${path}.${key}`);
    }
  };

  walk(plugin, plugin.manifest.id);
  return found;
};

describe('as extensões agnósticas de negócio nascem no idioma-fonte', () => {
  /**
   * Uma varredura que não achasse nada faria todos os casos abaixo passarem POR NADA — e o dia em que
   * uma propriedade nova saísse da lista de chaves seria indistinguível do dia em que está tudo certo.
   */
  it.each(PLUGINS.map((plugin) => [plugin.manifest.id, plugin] as const))(
    'a varredura de %s encontra texto para conferir',
    (_id, plugin) => {
      expect(textsOf(plugin).length).toBeGreaterThanOrEqual(10);
    },
  );

  it.each(PLUGINS.map((plugin) => [plugin.manifest.id, plugin] as const))(
    '%s não tem uma única frase solta — todo texto de usuário é referência',
    (_id, plugin) => {
      const phrases = textsOf(plugin).filter((entry) => !isMessageRef(entry.value));
      expect(phrases).toEqual([]);
    },
  );

  it.each(PLUGINS.map((plugin) => [plugin.manifest.id, plugin] as const))(
    '%s referencia só o catálogo próprio (ou o do núcleo, de propósito)',
    (id, plugin) => {
      const foreign = textsOf(plugin)
        .map((entry) => ({ ...entry, ref: parseMessageRef(entry.value) }))
        .filter((entry) => entry.ref !== null && entry.ref.namespace !== id && !entry.ref.namespace.startsWith('core.'));
      expect(foreign).toEqual([]);
    },
  );

  /**
   * Referência sem chave não estoura: ela aparece na tela como o texto cru "@com.microteia.news/x".
   * Este caso é o que transforma esse silêncio em falha — nos DOIS idiomas, porque o pacote responde
   * por ambos.
   */
  it.each(['en', 'pt-BR'])('toda referência resolve em %s', (locale) => {
    const catalog = catalogFor(locale);
    const unresolved: string[] = [];
    for (const plugin of PLUGINS) {
      for (const entry of textsOf(plugin)) {
        const ref = parseMessageRef(entry.value);
        if (!ref) continue;
        if (resolveLabel(catalog, entry.value) === ref.full) unresolved.push(`${entry.path} -> ${ref.full}`);
      }
    }
    expect(unresolved).toEqual([]);
  });

  it('o idioma-fonte é o inglês, e a tradução viaja dentro do pacote', () => {
    const en = catalogFor('en');
    const ptBr = catalogFor('pt-BR');

    expect(resolveLabel(en, '@com.microteia.calendar/nav.calendar')).toBe('Calendar');
    expect(resolveLabel(ptBr, '@com.microteia.calendar/nav.calendar')).toBe('Calendário');
    expect(resolveLabel(en, '@com.microteia.dashboard/view.empty')).toContain('No widgets');
    expect(resolveLabel(ptBr, '@com.microteia.dashboard/view.empty')).toContain('Nenhum widget');
    expect(resolveLabel(en, '@com.microteia.news/screen.plural')).toBe('News');
    expect(resolveLabel(ptBr, '@com.microteia.news/screen.plural')).toBe('Notícias');
  });

  /**
   * O pacote de idioma do NÚCLEO não responde por vocabulário de extensão. Se uma destas chaves
   * aparecesse lá, desinstalar o pacote deixaria a extensão sem tradução — e instalar a extensão sozinha
   * num escritório sem ele a deixaria sem tradução do mesmo jeito.
   */
  it('nenhuma destas chaves depende do pacote de idioma do núcleo', () => {
    const host = createPluginHost();
    host.load([
      ...CORE_PLUGINS,
      ...installedPluginRecords(PLUGINS, PLUGINS.map((plugin) => installation(plugin.manifest.id))),
    ]);
    const ownNamespaces = new Set(PLUGINS.map((plugin) => plugin.manifest.id));
    const fromLocalePackage = messageBundlesOf(host.contributions.query(I18N_MESSAGES_POINT))
      .filter((bundle) => ownNamespaces.has(bundle.namespace))
      .map((bundle) => `${bundle.locale}/${bundle.namespace}`);

    // Dois bundles por extensão — o de origem e o pt-BR —, ambos contribuídos por ela mesma.
    expect(fromLocalePackage.sort()).toEqual([
      'en/com.microteia.calendar',
      'en/com.microteia.dashboard',
      'en/com.microteia.news',
      'pt-BR/com.microteia.calendar',
      'pt-BR/com.microteia.dashboard',
      'pt-BR/com.microteia.news',
    ]);
  });
});
