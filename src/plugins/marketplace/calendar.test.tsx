// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createPluginHost } from '../../kernel';
import { I18N_MESSAGES_POINT } from '../../domain/schema/i18n/extensionPoints';
import { CORE_PLUGINS } from '..';
import { extensionRecordFrom } from '../../domain/usecases/plugins/extensionRecordFrom';
import { materializePluginScreens } from '../../domain/usecases/plugins/screenModule';
import { evaluateExtensionView } from '../../presentation/shared/extensions/evaluateExtensionView';
import { UI_PAGE_POINT, UI_SETTINGS_POINT } from '../../domain/schema/ui/uiExtensionPoints';
import { validateSettingValue, type SettingsSection } from '../../domain/schema/settings';
import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import { pointContribution } from '../contributionBuilders';
import { calendarPlugin } from './calendar';

const loadHost = (plugins: MarketplacePlugin[]) => {
  const host = createPluginHost();
  const result = host.load([
    ...CORE_PLUGINS,
    ...plugins.map((plugin) => extensionRecordFrom(plugin, true)),
  ]);
  return { host, result };
};

describe('calendarPlugin', () => {
  it('carrega no host como extensão trusted, com a página da agenda, sem erros', () => {
    const { host, result } = loadHost([calendarPlugin]);

    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(host.isLoaded(calendarPlugin.manifest.id)).toBe(true);

    const pageKeys = host.contributions
      .query(UI_PAGE_POINT)
      .map((c) => (c.impl as { key?: string } | undefined)?.key);
    expect(pageKeys).toContain('calendar');
  });

  /**
   * A agenda não conhece prazo, audiência nem parcela. Este é o teste que a mantém assim: a
   * declaração inteira não pode citar nenhuma coleção de negócio — quem endereça o registro de
   * origem é o par `origem`/`origemId`, preenchido por quem o criou.
   *
   * O catálogo de mensagens fica FORA da varredura, e a distinção é a que o caso todo defende: a
   * declaração é o que a agenda CONHECE, o catálogo é o que ela EXPLICA. A frase "não conhece prazo,
   * audiência nem parcela" é a afirmação de independência, e passou a reprovar o caso no dia em que a
   * tradução mudou de lado e foi viajar dentro do manifest.
   */
  it('a declaração não menciona nenhuma entidade de negócio', () => {
    const declaracao = JSON.stringify({
      screens: calendarPlugin.screens,
      lookups: calendarPlugin.lookups,
      workflows: calendarPlugin.workflows,
      manifest: {
        ...calendarPlugin.manifest,
        contributes: (calendarPlugin.manifest.contributes ?? [])
          .filter((contribution) => contribution.point !== I18N_MESSAGES_POINT),
      },
    });

    for (const colecao of ['deadlines', 'cases', 'persons', 'financials', 'contracts', 'pushes']) {
      expect(declaracao, `a agenda não pode conhecer "${colecao}"`).not.toContain(colecao);
    }
  });

  it('a tela do item é um espelho: fora do menu, sem ação de cartão e com o par de origem', () => {
    const [{ input }] = materializePluginScreens(calendarPlugin, 'u1');

    expect(input.hideFromSidebar).toBe(true);
    expect(input.listActions).toEqual([]);
    expect(input.eventPrefix).toBe('calendar');

    const byKey = new Map(input.fields.map((field) => [field.key, field]));
    expect([...byKey.keys()]).toEqual([
      'title', 'status', 'priority', 'description',
      'date', 'hour', 'finishDate', 'finishHour',
      'origem', 'origemId',
    ]);
    // A hora é o tipo de campo novo do kernel — string 'HH:mm', não instante.
    expect(byKey.get('hour')?.type).toBe('time');
    expect(byKey.get('finishHour')?.type).toBe('time');
    // Situação, prioridade e as duas datas filtram; é sobre eles que o CompositeTFilter da agenda
    // se monta, e é aí que os campos de outras extensões se somam.
    expect(byKey.get('status')?.filterable).toBe(true);
    expect(byKey.get('priority')?.filterable).toBe(true);
    expect(byKey.get('date')?.filterable).toBe(true);
  });

  /**
   * As chaves das duas listas são estáveis e em inglês porque quem grava um item é uma automação de
   * OUTRA extensão: um rótulo renomeado no escritório não pode quebrar o espelho.
   */
  it('as listas de situação e prioridade têm chaves estáveis', () => {
    const status = calendarPlugin.lookups?.find((lookup) => lookup.collection === 'calendarStatuses');
    const prioridade = calendarPlugin.lookups?.find((lookup) => lookup.collection === 'calendarPriorities');

    expect(status?.options?.map((option) => option.key)).toEqual(['pending', 'closed']);
    expect(prioridade?.options?.map((option) => option.key)).toEqual(['low', 'medium', 'high', 'critical']);
    expect(prioridade?.options?.map((option) => option.color)).toEqual(['success', 'warning', 'secondary', 'danger']);
  });

  /**
   * UM ponto só, e é o do arrasto. O gesto do CARTÃO não tem ponto próprio de propósito: ele sai da
   * lista de ações da tela (a aba "Ações" do Form Design), que é onde o escritório já mexe. Dois
   * caminhos para a mesma pergunta — "o que aparece neste cartão?" — deixariam metade da resposta
   * fora do alcance do usuário.
   */
  it('publica só o ponto do arrasto — o gesto do cartão é configuração da tela', () => {
    const pontos = (calendarPlugin.manifest.extensionPoints ?? []).map((point) => point.id);
    expect(pontos).toEqual(['calendar.moveaction']);

    // Metadata pura: sem implementação, uma extensão de TERCEIRO (que não pode entregar código)
    // participa do arrasto pelo mesmo caminho que uma de primeira parte.
    for (const point of calendarPlugin.manifest.extensionPoints ?? []) {
      expect(point.allowedImplKinds).toEqual([]);
      expect(point.implRequired).toBe(false);
      expect(point.multiple).toBe(true);
    }
  });

  it('a lista de ações do arrasto é configurável, e sobre o ponto certo', () => {
    const { host } = loadHost([calendarPlugin]);
    const [contribution] = host.contributions.query(UI_SETTINGS_POINT)
      .filter((item) => (item.metadata as unknown as SettingsSection).key === 'calendar');
    const secao = contribution.metadata as unknown as SettingsSection;
    const [propriedade] = secao.properties;

    expect(propriedade.key).toBe('calendar.moveActions');
    expect(propriedade.type).toBe('contributions');
    expect(propriedade.point).toBe('calendar.moveaction');
    expect(validateSettingValue(propriedade, [{ key: 'prazo.mover', enabled: true }])).toBeNull();
    expect(validateSettingValue(propriedade, 'ligado')).not.toBeNull();
  });

  it('a view compila e avalia contra a API curada', () => {
    const source = calendarPlugin.views?.find((view) => view.key === 'calendar')?.source ?? '';
    expect(evaluateExtensionView('com.microteia.calendar::calendar', source)).toBeTypeOf('function');
  });
});

/**
 * A agenda COMO ALVO. Substitui um caso que exercitava isto com a extensão de Prazos, hoje mantida
 * fora deste repositório — e é melhor assim: o que o kernel tem de garantir é que os dois caminhos de
 * consumo EXISTEM e funcionam para qualquer extensão, não que uma extensão específica os usa.
 *
 * São dois, e a distinção entre eles é a decisão que o Calendário registra:
 *
 * - **complemento de tela** (`screenPatches`): campos acrescentados ao item da agenda, com chave
 *   própria. É por isso que duas extensões podem se mostrar na mesma agenda sem se apagarem.
 * - **ponto de extensão** (`calendar.moveaction`): o gesto de ARRASTAR, que é da agenda e precisa
 *   saber a qual origem se aplica. O gesto do CARTÃO não tem ponto: ele sai da lista de ações da
 *   tela, que é onde o escritório já mexe.
 */
const CONSUMIDOR: MarketplacePlugin = {
  manifest: {
    id: 'com.example.consumidor',
    version: '1.0.0',
    kernel: '^2.0.0',
    name: 'Consumidor da agenda',
    description: 'Uma extensão de exemplo que se mostra na agenda.',
    publisher: { name: 'Example' },
    dependencies: { 'com.microteia.calendar': { version: '^1.0.0', collections: ['calendar'] } },
    // Nem menu nem página: esta extensão de exemplo existe SÓ para se mostrar na agenda. É o caso
    // mínimo, e o que ele prova é que os dois caminhos de consumo bastam sozinhos.
    contributes: [
      pointContribution('calendar.moveaction', 'mover-coisa', {
        key: 'coisa.mover',
        title: 'Mover a coisa',
        icon: 'arrowRight',
        order: 0,
        origem: 'things',
        actionSourceId: 'act-mover-coisa',
      }),
    ],
  },
  summary: 'Exemplo.',
  overview: { type: 'stack', children: [] },
  workflows: [],
  screenPatches: [
    {
      target: 'microteia:calendar',
      targetKind: 'sourceId',
      fields: [
        { key: 'thingState', label: 'Situação da coisa', type: 'select', required: false, order: 100, filterable: true },
      ],
      cardActionIds: ['act-mover-coisa'],
    },
  ],
  actions: [
    {
      templateId: 'act-mover-coisa',
      key: 'coisa_mover',
      title: 'Mover a coisa',
      icon: 'arrowRight',
      workflowId: 'wf-mover-coisa',
      hiddenWhen: 'origem != "things"',
      order: 0,
      enabled: true,
      danger: false,
    },
  ],
};

describe('a agenda como alvo de outra extensão', () => {
  it('aceita um consumidor sem que nada dela mude', () => {
    const { host, result } = loadHost([calendarPlugin, CONSUMIDOR]);

    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(host.isLoaded(CONSUMIDOR.manifest.id)).toBe(true);
  });

  /**
   * O complemento traz chave PRÓPRIA (`thingState`, não `status`) porque ele SUBSTITUI na tela alvo o
   * campo de mesma chave, e a desinstalação leva embora o que é dele. Duas extensões disputando a mesma
   * chave na agenda fariam a saída de uma apagar o filtro da outra.
   */
  it('o complemento não colide com nenhum campo da própria agenda', () => {
    const daAgenda = new Set(calendarPlugin.screens![0].fields.map((field) => field.key));
    for (const field of CONSUMIDOR.screenPatches![0].fields) {
      expect(daAgenda.has(field.key), field.key).toBe(false);
    }
  });

  /**
   * A contribuição do arrasto endereça a Action pelo `templateId` do pacote (`sourceId` depois de
   * instalada): o id real só nasce na instalação, e um manifest não tem como conhecê-lo. E ela carrega a
   * ORIGEM — sem isso, arrastar qualquer item da agenda cairia nesta extensão.
   */
  it('o arrasto chega ao ponto declarado, com origem e ação do próprio pacote', () => {
    const { host } = loadHost([calendarPlugin, CONSUMIDOR]);
    const [contribuicao] = host.contributions.query('calendar.moveaction');

    expect(contribuicao.pluginId).toBe(CONSUMIDOR.manifest.id);

    const metadata = contribuicao.metadata as { origem?: string; actionSourceId?: string };
    expect(metadata.origem).toBe('things');
    expect(new Set((CONSUMIDOR.actions ?? []).map((action) => action.templateId)))
      .toContain(metadata.actionSourceId);
  });

  /** O gesto do cartão entra pela lista de ações da tela alvo — o mesmo lugar que o Form Design edita. */
  it('o gesto do cartão entra pela lista de ações da tela, não por contribuição', () => {
    const [patch] = CONSUMIDOR.screenPatches ?? [];
    const templateIds = new Set((CONSUMIDOR.actions ?? []).map((action) => action.templateId));

    expect(patch.cardActionIds).toEqual(['act-mover-coisa']);
    expect(templateIds.has(patch.cardActionIds![0])).toBe(true);
  });

  /** Sem a agenda instalada, a coleção `calendar` não existe e o consumidor gravaria no vazio. */
  it('sem a agenda instalada, o host recusa carregar o consumidor', () => {
    const { host, result } = loadHost([CONSUMIDOR]);

    expect(host.isLoaded(CONSUMIDOR.manifest.id)).toBe(false);
    expect(result.diagnostics.map((d) => d.code)).toContain('dependency.missing');
  });
});
