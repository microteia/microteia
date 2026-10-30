import { describe, expect, it } from 'vitest';
import {
  CARD_TEMPLATE_MAX_DEPTH,
  CARD_TEMPLATE_MAX_NODES,
  DEFAULT_CARD_BODY,
  readCardTemplate,
} from './cardTemplate';
import { cardTemplateIssues } from './cardTemplateIssues';

const FIELDS = [
  { key: 'nome', type: 'text' },
  { key: 'situacao', type: 'select' },
  { key: 'valor', type: 'currency' },
];

const nest = (levels: number): unknown => {
  let node: unknown = { type: 'title' };
  for (let level = 0; level < levels; level += 1) node = { type: 'stack', children: [node] };
  return node;
};

describe('readCardTemplate — a leitura tolerante do que está gravado', () => {
  it('ausente, nulo ou fora de forma é "sem declaração": o cartão padrão', () => {
    expect(readCardTemplate(undefined)).toBeNull();
    expect(readCardTemplate(null)).toBeNull();
    expect(readCardTemplate('grid')).toBeNull();
    expect(readCardTemplate([])).toBeNull();
    expect(readCardTemplate({})).toBeNull();
  });

  it('só o arranjo, sem desenho: muda a lista e mantém o cartão', () => {
    expect(readCardTemplate({ layout: 'list' })).toEqual({ layout: 'list' });
    expect(readCardTemplate({ minWidth: 'lg' })).toEqual({ minWidth: 'lg' });
  });

  it('descarta nó desconhecido em qualquer profundidade, sem perder os vizinhos', () => {
    const template = readCardTemplate({
      body: [
        { type: 'chart', series: [] },
        { type: 'row', children: [{ type: 'title' }, { type: 'sparkline' }] },
      ],
    });
    expect(template?.body).toEqual([{ type: 'row', children: [{ type: 'title' }] }]);
  });

  it('descarta o nó sem o que ele exige e a opção fora da lista', () => {
    const template = readCardTemplate({
      body: [
        { type: 'field' },
        { type: 'text', text: '   ' },
        { type: 'icon' },
        { type: 'field', field: 'nome', variant: 'neon', size: 'huge', label: true },
      ],
    });
    expect(template?.body).toEqual([{ type: 'field', field: 'nome', label: true }]);
  });

  it('valor inválido no arranjo é ignorado, e o que sobra continua valendo', () => {
    expect(readCardTemplate({ layout: 'carousel', body: [{ type: 'title' }] }))
      .toEqual({ body: [{ type: 'title' }] });
  });

  it('corta o aninhamento além do teto', () => {
    const shallow = readCardTemplate({ body: [nest(CARD_TEMPLATE_MAX_DEPTH - 1)] });
    const deep = readCardTemplate({ body: [nest(CARD_TEMPLATE_MAX_DEPTH)] });
    expect(JSON.stringify(shallow)).toContain('"title"');
    expect(JSON.stringify(deep)).not.toContain('"title"');
  });

  it('para de ler depois do teto de nós', () => {
    const body = Array.from({ length: CARD_TEMPLATE_MAX_NODES + 20 }, () => ({ type: 'divider' }));
    expect(readCardTemplate({ body })?.body).toHaveLength(CARD_TEMPLATE_MAX_NODES);
  });

  it('o cartão padrão escrito na DSL é lido sem perda', () => {
    expect(readCardTemplate({ body: DEFAULT_CARD_BODY })?.body).toEqual(DEFAULT_CARD_BODY);
  });
});

const codes = (raw: unknown) => cardTemplateIssues(raw, FIELDS).map((issue) => issue.message.split('.issue.')[1]);

describe('cardTemplateIssues — o portão da autoria', () => {
  it('ausente não é problema; o cartão padrão também não', () => {
    expect(cardTemplateIssues(undefined, FIELDS)).toEqual([]);
    expect(cardTemplateIssues({ body: DEFAULT_CARD_BODY }, FIELDS)).toEqual([]);
  });

  it('recusa o que não é objeto', () => {
    expect(codes([])).toEqual(['not-object']);
  });

  it('aponta cada defeito com o caminho dele', () => {
    const issues = cardTemplateIssues({
      layout: 'carousel',
      body: [
        { type: 'chart' },
        { type: 'row', children: [{ type: 'field', field: 'inexistente' }] },
      ],
    }, FIELDS);
    expect(issues).toEqual([
      expect.objectContaining({ message: '@core.records/card-template.issue.option', messageParams: expect.objectContaining({ where: 'cardTemplate.layout', value: 'carousel' }) }),
      expect.objectContaining({ message: '@core.records/card-template.issue.node-type', messageParams: { where: 'cardTemplate.body[0].type', type: 'chart' } }),
      expect.objectContaining({ message: '@core.records/card-template.issue.field-unknown', messageParams: { where: 'cardTemplate.body[1].children[0].field', field: 'inexistente' } }),
    ]);
  });

  it('cobre cada regra de nó', () => {
    expect(codes({ body: 'x' })).toEqual(['node-list']);
    expect(codes({ body: [42] })).toEqual(['node-shape']);
    expect(codes({ body: [{ type: 'field' }] })).toEqual(['field-missing']);
    expect(codes({ body: [{ type: 'field', field: 'nome', label: 3 }] })).toEqual(['label']);
    expect(codes({ body: [{ type: 'field', field: 'nome', icon: 'naoExiste' }] })).toEqual(['icon-unknown']);
    expect(codes({ body: [{ type: 'icon' }] })).toEqual(['icon-missing']);
    expect(codes({ body: [{ type: 'text' }] })).toEqual(['text-missing']);
    expect(codes({ body: [{ type: 'actions', include: 'delete' }] })).toEqual(['key-list']);
    expect(codes({ body: [{ type: 'title', hiddenWhen: 'nome ==' }] })).toEqual(['expression']);
    expect(codes({ body: [{ type: 'title', hiddenWhen: true }] })).toEqual(['expression-type']);
    expect(codes({ body: [{ type: 'row', gap: 'huge', children: [] }] })).toEqual(['option']);
  });

  it('a faixa de destaque só aceita campo de seleção', () => {
    expect(codes({ accent: { field: 'valor' } })).toEqual(['accent-field']);
    expect(codes({ accent: { field: 'situacao' } })).toEqual([]);
    expect(codes({ accent: { field: 'sumiu' } })).toEqual(['field-unknown']);
  });

  it('cobra os tetos que a leitura aplicaria em silêncio', () => {
    expect(codes({ body: [nest(CARD_TEMPLATE_MAX_DEPTH)] })).toContain('too-deep');
    expect(codes({ body: Array.from({ length: CARD_TEMPLATE_MAX_NODES + 1 }, () => ({ type: 'divider' })) }))
      .toEqual(['too-many']);
  });

  it('uma expressão válida e um ícone do catálogo passam', () => {
    expect(codes({ body: [{ type: 'field', field: 'nome', icon: 'calendar', hiddenWhen: 'isEmpty(nome)' }] })).toEqual([]);
  });
});
