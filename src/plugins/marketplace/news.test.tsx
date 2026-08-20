// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createPluginHost } from '../../kernel';
import { CORE_PLUGINS } from '..';
import { installedPluginRecords } from '../../domain/usecases/plugins/installedPluginRecords';
import { materializePluginScreens } from '../../domain/usecases/plugins/screenModule';
import { evaluateExtensionView } from '../../presentation/shared/extensions/evaluateExtensionView';
import { navMetadataOf } from '../../presentation/shared/resolveUiContributions';
import { UI_NAV_POINT, UI_PAGE_POINT } from '../../domain/schema/ui/uiExtensionPoints';
import { RESERVED_COLLECTIONS } from '../../domain/schema/screenEntity';
import { countBadgeRecords } from '../../presentation/shared/useNavBadgeCount';
import type { PluginInstallation } from '../../domain/entities/PluginInstallation';
import type { EntityRecord } from '../../domain/entities';
import { newsPlugin } from './news';

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

const screens = () => materializePluginScreens(newsPlugin, 'u1');
const newsScreen = () => screens()[0].input;
const commentScreen = () => screens()[1].input;

const record = (values: Record<string, unknown>): EntityRecord => ({
  id: 'r1',
  tenantId: 't1',
  collection: 'news',
  createdAt: new Date(),
  createdBy: 'autor',
  updatedAt: new Date(),
  ...values,
} as EntityRecord);

const navBadge = () => {
  const contribution = (newsPlugin.manifest.contributes ?? [])
    .filter((item) => item.point === UI_NAV_POINT)
    .map((item) => navMetadataOf({ ...item, pluginId: newsPlugin.manifest.id }))[0];
  return contribution.badge;
};

describe('newsPlugin', () => {
  it('carrega no host como extensão trusted, com a listagem e a leitura', () => {
    const host = createPluginHost();
    const result = host.load([
      ...CORE_PLUGINS,
      ...installedPluginRecords([newsPlugin], [installation(newsPlugin.manifest.id)]),
    ]);

    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(host.isLoaded(newsPlugin.manifest.id)).toBe(true);

    const pageKeys = host.contributions
      .query(UI_PAGE_POINT)
      .map((c) => (c.impl as { key?: string } | undefined)?.key);
    expect(pageKeys).toEqual(expect.arrayContaining(['news', 'news-read']));
  });

  it('aponta para a coleção de notícias e mantém o nome dos eventos', () => {
    const input = newsScreen();

    expect(input.dataCollection).toBe('news');
    expect(input.eventPrefix).toBe('news');
    expect(input.titleFieldKey).toBe('title');
    expect(input.subtitleFieldKey).toBe('summary');
    expect(input.fields.map((field) => field.key))
      .toEqual(['title', 'category', 'sourceURL', 'summary', 'content']);
  });

  /**
   * Curtir, marcar como lida e guardar para depois são gestos, não digitação: declarados como campo,
   * apareceriam no formulário e nos filtros, onde só atrapalhariam.
   */
  it('o estado de leitura NÃO é campo declarado', () => {
    const keys = newsScreen().fields.map((field) => field.key);
    for (const key of ['readBy', 'savedBy', 'likedBy', 'viewCount']) {
      expect(keys).not.toContain(key);
    }
  });

  /**
   * A leitura é onde uma notícia se abre. Sem o prefixo declarado, a auditoria e as menções cairiam no
   * formulário de edição.
   */
  it('quem abre de fora cai na leitura, não no formulário', () => {
    expect(newsScreen().recordTabPrefix).toBe('news-read:');
  });

  /**
   * Um membro convidado nasce com o papel `user`, que é somente leitura no resto do sistema. Sem a
   * declaração, ele não conseguia sequer marcar uma notícia como lida — e o selo do menu ficava
   * preso para sempre. É o que as regras nomeadas de `news` diziam à mão.
   */
  it('qualquer membro grava o que é "por usuário", e só isso', () => {
    expect(newsScreen().memberWritableFields)
      .toEqual(['readBy', 'savedBy', 'likedBy', 'viewCount']);
    // O CONTEÚDO segue a permissão padrão do escritório: a lista não abre a edição da notícia.
    expect(newsScreen().writeRoles).toBeNull();
  });

  /** Num mural, comentar é de todo mundo — a lista declarada ALARGA a permissão padrão. */
  it('comentar é de todo mundo, inclusive de quem só lê', () => {
    expect(commentScreen().writeRoles).toContain('user');
  });

  it('quem publica apaga o que publicou — nas duas telas', () => {
    expect(newsScreen().authorCanDelete).toBe(true);
    expect(commentScreen().authorCanDelete).toBe(true);
    expect(newsScreen().listActions).toContain('delete');
  });

  it('o comentário é uma tela filha da notícia, fora do menu', () => {
    const input = commentScreen();

    expect(input.parentEntity).toBe(screens()[0].screenKey);
    expect(input.parentFieldKey).toBe('newsId');
    expect(input.parentRelation).toBe('owned');
    expect(input.hideFromSidebar).toBe(true);
    expect(input.fields.map((field) => field.key)).toEqual(['newsId', 'content']);
  });

  /**
   * A conversa se lê embaixo da notícia, na tela de leitura. Como aba do formulário de edição seria a
   * mesma coisa duas vezes — e no lugar em que ninguém a procura.
   */
  it('a conversa não vira aba do formulário da notícia', () => {
    expect(commentScreen().hideFromParentTabs).toBe(true);
  });

  /**
   * A lista em si é do escritório — ela pode encolher ou crescer sem que nada quebre. O que NÃO pode
   * mudar é a forma da chave: ela é o valor em inglês que os documentos já guardam, e traduzi-la
   * deixaria toda notícia existente com uma categoria que opção nenhuma responde.
   */
  it('as categorias descrevem o que está gravado, não um esquema novo', () => {
    const categorias = newsPlugin.lookups?.find((lookup) => lookup.collection === 'newsCategories');
    const opcoes = categorias?.options ?? [];

    expect(opcoes.length).toBeGreaterThan(0);
    expect(opcoes.find((option) => option.key === 'GENERAL')?.label).toBe('@com.microteia.news/category.general');
    for (const option of opcoes) expect(option.key).toMatch(/^[A-Z_]+$/);
  });

  /**
   * O selo é PESSOAL: conta o que este usuário não leu, e não o que o escritório não leu. É o que a
   * coleção de interações fazia com um documento por usuário e por notícia.
   */
  it('o selo do menu conta o não lido DE QUEM ESTÁ OLHANDO', () => {
    const badge = navBadge();
    expect(badge?.collection).toBe('news');

    const newsItems = [
      record({ id: '1', readBy: [], createdBy: 'outro' }),
      record({ id: '2', readBy: ['eu'], createdBy: 'outro' }),
      record({ id: '3', readBy: ['outro'], createdBy: 'outro' }),
      // A própria notícia nunca conta: quem escreveu já sabe o que escreveu.
      record({ id: '4', readBy: [], createdBy: 'eu' }),
    ];

    expect(countBadgeRecords(newsItems, badge!, { id: 'eu', name: 'Eu', role: 'user' })).toBe(2);
    expect(countBadgeRecords(newsItems, badge!, { id: 'outro', name: 'Outro', role: 'user' })).toBe(1);
  });

  /**
   * Sair do kernel é também sair da lista que protegia a coleção: sem isso, a tela não poderia ser
   * declarada nem gravada pelo curinga das regras.
   */
  it('news deixou de ser coleção reservada', () => {
    expect(RESERVED_COLLECTIONS.has('news')).toBe(false);
    expect(RESERVED_COLLECTIONS.has('newsCategories')).toBe(false);
  });

  it('as fontes reais das views compilam pelo runtime (não caem no fallback)', () => {
    for (const view of newsPlugin.views ?? []) {
      const Component = evaluateExtensionView(`test::${view.key}`, view.source);
      expect(typeof Component, view.key).toBe('function');
    }
  });

  it('o startup compila (⌘K e a menção @notícia)', () => {
    const startup = evaluateExtensionView('test::news-startup', newsPlugin.startup ?? '');
    expect(typeof startup).toBe('function');
  });
});
