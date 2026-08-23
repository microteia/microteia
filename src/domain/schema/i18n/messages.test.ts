import { describe, it, expect } from 'vitest';
import {
  asMessageBundle,
  buildMessageCatalog,
  hasMessage,
  localesOf,
  messagesOfNamespace,
  namespacesOf,
  qualifyKey,
  translate,
} from './messages';
import type { MessageBundle } from './messages';

const bundle = (overrides: Partial<MessageBundle> = {}): MessageBundle => ({
  locale: 'en',
  namespace: 'core.ui',
  messages: { 'nav.settings': 'Settings' },
  ...overrides,
});

describe('qualifyKey', () => {
  it('prefixa com o namespace de quem chama', () => {
    expect(qualifyKey('core.ui', 'nav.settings')).toBe('core.ui/nav.settings');
  });

  it('deixa passar a chave ABSOLUTA — é como uma extensão reaproveita texto do núcleo', () => {
    expect(qualifyKey('com.acme.docs', 'core.ui/action.save')).toBe('core.ui/action.save');
  });
});

describe('asMessageBundle', () => {
  it('lê uma metadata bem formada', () => {
    expect(asMessageBundle(bundle())).toEqual(bundle());
  });

  it('normaliza o idioma na leitura', () => {
    expect(asMessageBundle(bundle({ locale: 'pt_br' }))?.locale).toBe('pt-BR');
  });

  it('recusa metadata malformada em vez de lançar', () => {
    expect(asMessageBundle(null)).toBeNull();
    expect(asMessageBundle({})).toBeNull();
    expect(asMessageBundle(bundle({ locale: 'português' }))).toBeNull();
    expect(asMessageBundle(bundle({ namespace: '   ' }))).toBeNull();
    expect(asMessageBundle({ ...bundle(), messages: 'oi' })).toBeNull();
  });

  it('descarta as entradas ruins e aproveita o resto do bundle', () => {
    const read = asMessageBundle({
      locale: 'en',
      namespace: 'core.ui',
      messages: { 'nav.settings': 'Settings', 'nav.bad': 42, 'chave inválida': 'x' },
    });
    expect(read?.messages).toEqual({ 'nav.settings': 'Settings' });
  });
});

describe('buildMessageCatalog', () => {
  it('indexa por chave plenamente qualificada', () => {
    const catalog = buildMessageCatalog([bundle()], 'en');
    expect(catalog.messages['core.ui/nav.settings']).toBe('Settings');
  });

  it('deixa o idioma específico sobrepor o genérico e o genérico sobrepor a fonte', () => {
    const catalog = buildMessageCatalog(
      [
        bundle({ locale: 'en', messages: { a: 'source', b: 'source', c: 'source' } }),
        bundle({ locale: 'pt', messages: { a: 'geral', b: 'geral' } }),
        bundle({ locale: 'pt-BR', messages: { a: 'regional' } }),
      ],
      'pt-BR',
    );
    expect(catalog.messages['core.ui/a']).toBe('regional');
    expect(catalog.messages['core.ui/b']).toBe('geral');
    expect(catalog.messages['core.ui/c']).toBe('source');
  });

  /**
   * A garantia que separa isto de "o último instalado vence": os bundles chegam na ordem do
   * `ContributionRegistry` (prioridade desc), e quem chega primeiro não é sobrescrito.
   */
  it('dentro do mesmo idioma, o PRIMEIRO bundle vence', () => {
    const catalog = buildMessageCatalog(
      [
        bundle({ messages: { 'nav.settings': 'De maior prioridade' } }),
        bundle({ messages: { 'nav.settings': 'De menor prioridade' } }),
      ],
      'en',
    );
    expect(catalog.messages['core.ui/nav.settings']).toBe('De maior prioridade');
  });

  it('mantém separados os namespaces que usam a mesma chave', () => {
    const catalog = buildMessageCatalog(
      [
        bundle({ namespace: 'core.ui', messages: { title: 'Settings' } }),
        bundle({ namespace: 'com.acme.docs', messages: { title: 'Documents' } }),
      ],
      'en',
    );
    expect(catalog.messages['core.ui/title']).toBe('Settings');
    expect(catalog.messages['com.acme.docs/title']).toBe('Documents');
  });
});

describe('translate', () => {
  const catalog = buildMessageCatalog(
    [
      bundle({
        messages: {
          'nav.settings': 'Settings',
          greeting: 'Hello, {name}',
          'items.one': '{count} item',
          'items.other': '{count} items',
        },
      }),
    ],
    'en',
  );

  it('resolve a chave', () => {
    expect(translate(catalog, 'core.ui/nav.settings')).toBe('Settings');
  });

  it('interpola no mesmo formato do catálogo de expressões', () => {
    expect(translate(catalog, 'core.ui/greeting', { name: 'Ana' })).toBe('Hello, Ana');
  });

  /**
   * Chave ausente devolve a PRÓPRIA CHAVE: uma tela feia é diagnosticável e continua clicável; uma
   * tela com botões em branco não é nem uma coisa nem outra.
   */
  it('devolve a própria chave quando não há tradução', () => {
    expect(translate(catalog, 'core.ui/nao.existe')).toBe('core.ui/nao.existe');
  });

  it('escolhe a forma do plural pelo idioma, não por n > 1', () => {
    expect(translate(catalog, 'core.ui/items', { count: 1 })).toBe('1 item');
    expect(translate(catalog, 'core.ui/items', { count: 3 })).toBe('3 items');
  });

  it('preserva o token quando o parâmetro não veio', () => {
    expect(translate(catalog, 'core.ui/greeting')).toBe('Hello, {name}');
  });

  it('nunca lança com entrada inválida', () => {
    expect(translate(catalog, '')).toBe('');
  });
});

describe('parâmetro que é referência', () => {
  const catalog = buildMessageCatalog(
    [
      bundle({
        messages: {
          'wrap.field': '[Campo: {field}] {detail}',
          'input.invalid': 'value "{value}" is not valid',
          'tag-list.option': '{name} ({collection})',
          'tag-list.of': 'Tags: {name}',
          'ping.a': 'A: {other}',
          'ping.b': 'B: {other}',
        },
      }),
    ],
    'en',
  );

  it('resolve a referência e desce os parâmetros irmãos para a mensagem aninhada', () => {
    expect(
      translate(catalog, 'core.ui/wrap.field', {
        field: 'due_at',
        detail: '@core.ui/input.invalid',
        value: '2026-13-40',
      }),
    ).toBe('[Campo: due_at] value "2026-13-40" is not valid');
  });

  /**
   * O ciclo nasce do encontro de duas coisas legítimas: os parâmetros irmãos descem, e a mensagem de
   * dentro é de OUTRO namespace, cujos nomes de token não são nossos. Bastava as duas usarem `{name}`
   * — era o caso de `tag-list.option` com `tag-list.of` — para a pilha estourar e a tela inteira cair
   * no ErrorBoundary. Degradar para a referência crua deixa o defeito visível sem custar a página.
   */
  it('não recursa para sempre quando a referência reentra na própria chave', () => {
    expect(
      translate(catalog, 'core.ui/tag-list.option', {
        name: '@core.ui/tag-list.of',
        collection: 'consultas_tags',
      }),
    ).toBe('Tags: @core.ui/tag-list.of (consultas_tags)');
  });

  it('corta também o ciclo entre duas chaves diferentes', () => {
    expect(
      translate(catalog, 'core.ui/ping.a', { other: '@core.ui/ping.b' }),
    ).toBe('A: B: @core.ui/ping.b');
  });

  it('devolve a referência crua quando a chave apontada não existe', () => {
    expect(
      translate(catalog, 'core.ui/wrap.field', { field: 'x', detail: '@core.ui/nao.existe' }),
    ).toBe('[Campo: x] core.ui/nao.existe');
  });
});

describe('leitura auxiliar', () => {
  const bundles = [
    bundle({ locale: 'en', namespace: 'core.ui' }),
    bundle({ locale: 'pt-BR', namespace: 'com.acme.docs' }),
  ];

  it('lista namespaces e idiomas ordenados', () => {
    expect(namespacesOf(bundles)).toEqual(['com.acme.docs', 'core.ui']);
    expect(localesOf(bundles)).toEqual(['en', 'pt-BR']);
  });

  it('extrai as chaves de um namespace já sem o prefixo', () => {
    const catalog = buildMessageCatalog([bundle()], 'en');
    expect(messagesOfNamespace(catalog, 'core.ui')).toEqual({ 'nav.settings': 'Settings' });
    expect(messagesOfNamespace(catalog, 'com.acme.docs')).toEqual({});
  });

  it('diz se a chave existe', () => {
    const catalog = buildMessageCatalog([bundle()], 'en');
    expect(hasMessage(catalog, 'core.ui/nav.settings')).toBe(true);
    expect(hasMessage(catalog, 'core.ui/x')).toBe(false);
  });
});
