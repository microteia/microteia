import { describe, expect, it } from 'vitest';
import { createPluginHost } from '../../kernel';
import { CORE_PLUGINS } from '..';
import { extensionRecordFrom } from '../../domain/usecases/plugins/extensionRecordFrom';
import { I18N_MESSAGES_POINT, messageBundlesOf } from '../../domain/schema/i18n/extensionPoints';
import { buildMessageCatalog } from '../../domain/schema/i18n/messages';
import { isMessageRef, parseMessageRef, resolveLabel } from '../../domain/schema/i18n/messageRef';
import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import { calendarPlugin } from './calendar';
import { businessDaysPlugin } from './businessDays';
import { dashboardPlugin } from './dashboard';
import { newsPlugin } from './news';
import { TRAVELLING_EXAMPLES } from './travellingExamples';

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
const PLUGINS: MarketplacePlugin[] = [calendarPlugin, businessDaysPlugin, dashboardPlugin, newsPlugin, ...TRAVELLING_EXAMPLES];

const catalogFor = (locale: string) => {
  const host = createPluginHost();
  host.load([
    ...CORE_PLUGINS,
    ...PLUGINS.map((plugin) => extensionRecordFrom(plugin, true)),
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

/**
 * Os nós de AUTOMAÇÃO em que `value` é dado, e não texto: as formas de `InputMapping` — o valor que um
 * passo recebe — e as de condição, cujo `value` é o termo comparado.
 *
 * Ali `value` é um id de coleção, uma severidade, um `changeType`, uma referência qualificada a
 * artefato de outra extensão. Nunca algo que alguém lê. Em toda outra parte do pacote `value` é texto
 * de verdade — o `metric` e o `keyValue` do Widget DSL vivem disso —, e por isso a exceção é pela FORMA
 * do nó, ter um `kind` conhecido, e não pela chave nem pelo caminho.
 */
const DATA_KINDS = new Set([
  'Literal', 'Event', 'Expression', 'Output', 'Variable',
  'AlwaysTrue', 'FieldComparison', 'LogicalAnd', 'LogicalOr', 'Not',
]);

const carriesData = (record: Record<string, unknown>): boolean =>
  typeof record.kind === 'string' && DATA_KINDS.has(record.kind);

/**
 * O caminho EXATO em que uma chave de texto não carrega texto.
 *
 * `presentation.chart.category` é a chave da DIMENSÃO que o gráfico desenha no eixo — um ponteiro para
 * algo declarado em `dataset.dimensions`, onde o rótulo dela é conferido como qualquer outro. A palavra
 * é a mesma de `manifest.category`, que é texto de verdade, e por isso a exceção é por CAMINHO e não
 * pela chave: tirar `category` do conjunto acima cegaria a varredura justamente onde ela precisa
 * enxergar.
 *
 * Por sufixo, e não por subárvore, de propósito. Pular `chart` inteiro pareceria mais simples e
 * calaria a varredura sobre um `chart.title` que ainda não existe — que é exatamente a propriedade
 * nova de que ninguém lembraria.
 */
const NOT_TEXT_PATHS = ['.presentation.chart.category'];

/**
 * A opção de um parâmetro de automação é o par `{ value, label }`, e os dois lados são opostos: o
 * `label` é o que se lê — e é cobrado como qualquer outro —, enquanto o `value` é a CHAVE estável, o
 * que chega ao fluxo. Traduzi-la mudaria o que o fluxo recebe.
 *
 * É por caminho, e não por forma, porque a forma não distingue: um item de `keyValue` do Widget DSL é
 * o mesmo par, e ali as duas metades são texto.
 */
const OPTION_VALUE = /\.options\[\d+\]\.value$/;

/**
 * O `name` de uma lista de modelo de documento é o IDENTIFICADOR que o texto do modelo lê
 * (`{{#each parcelas}}`) — traduzi-lo quebraria o modelo. O texto do modelo, por sua vez, não está em
 * `TEXT_KEYS` de propósito: o documento diz o que diz no idioma em que foi escrito, como um contrato.
 */
const DATASET_NAME = /\.datasets\[\d+\]\.name$/;

/**
 * O `name` de uma chave única de tela é o IDENTIFICADOR pelo qual a reserva já gravada é encontrada —
 * renomeá-lo é aposentar a chave e declarar outra. Traduzi-lo trocaria de chave a cada idioma.
 */
const RECORD_KEY_NAME = /\.keys\[\d+\]\.name$/;

const isPointer = (path: string): boolean =>
  NOT_TEXT_PATHS.some((suffix) => path.endsWith(suffix)) ||
  OPTION_VALUE.test(path) ||
  DATASET_NAME.test(path) ||
  RECORD_KEY_NAME.test(path);

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

    const mapping = carriesData(record);

    for (const [key, value] of Object.entries(record)) {
      if (SKIPPED_SUBTREES.has(key)) continue;
      if (mapping && key === 'value') continue;
      if (typeof value === 'string') {
        const here = `${path}.${key}`;
        if (TEXT_KEYS.has(key) && value !== '' && !isPointer(here)) found.push({ path: here, value });
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
   *
   * A guarda é em DUAS metades porque a pergunta é uma só e o tamanho dos pacotes não é. Um piso de
   * dez por pacote foi calibrado quando aqui só havia extensão grande, e passou a reprovar o exemplo
   * pequeno — que é pequeno de propósito, e cujo texto está tão certo quanto o dos outros. O que
   * importa é que a varredura enxergue ALGO em cada pacote, e que enxergue MUITO no conjunto: as duas
   * juntas dizem o que o piso dizia, e nenhuma delas depende de quantos pacotes existem hoje.
   */
  it.each(PLUGINS.map((plugin) => [plugin.manifest.id, plugin] as const))(
    'a varredura de %s encontra texto para conferir',
    (_id, plugin) => {
      expect(textsOf(plugin).length).toBeGreaterThan(0);
    },
  );

  it('e encontra muito texto no conjunto — a varredura não emudeceu', () => {
    const total = PLUGINS.reduce((sum, plugin) => sum + textsOf(plugin).length, 0);
    expect(total).toBeGreaterThanOrEqual(10 * PLUGINS.length);
  });

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
      ...PLUGINS.map((plugin) => extensionRecordFrom(plugin, true)),
    ]);
    const ownNamespaces = new Set(PLUGINS.map((plugin) => plugin.manifest.id));
    const fromLocalePackage = messageBundlesOf(host.contributions.query(I18N_MESSAGES_POINT))
      .filter((bundle) => ownNamespaces.has(bundle.namespace))
      .map((bundle) => `${bundle.locale}/${bundle.namespace}`);

    /*
     * Dois bundles por extensão — o de origem e o pt-BR —, ambos contribuídos por ela mesma. A
     * expectativa é DERIVADA de `PLUGINS`, e não escrita à mão: uma lista literal aqui obrigaria a
     * editar este teste a cada exemplo agnóstico novo, e o gesto de editá-la é indistinguível do gesto
     * de aceitar que um bundle sumiu. O que se afirma é a REGRA — cada uma traz os seus dois —, e é
     * ela que continua valendo com quatro ou com quarenta.
     */
    expect(fromLocalePackage.sort()).toEqual(
      PLUGINS.flatMap((plugin) => [`en/${plugin.manifest.id}`, `pt-BR/${plugin.manifest.id}`]).sort(),
    );
  });
});
