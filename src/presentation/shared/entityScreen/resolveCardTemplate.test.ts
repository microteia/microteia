import { describe, expect, it, vi } from 'vitest';
import { resolveCardNodes } from './resolveCardTemplate';
import type { CardTemplateResolvers } from './resolveCardTemplate';
import type { RecordCardAction } from './useRecordListViewModel';
import type { EntityRecord } from '../../../domain/entities';
import type { CardNode } from '../../../domain/schema/ui/cardTemplate';

const record = { id: 'r1', nome: 'Ana', situacao: 'nova', vazio: '', tagIds: ['t1'] } as unknown as EntityRecord;

const action = (key: string, refs: string[]): RecordCardAction => ({ key, title: key, refs, onClick: vi.fn() });

const ACTIONS = [
  action('copyLink', ['copyLink']),
  action('delete', ['delete']),
  action('act-123', ['act-123', 'concluir', 'com.acme:concluir']),
];

const resolvers = (overrides: Partial<CardTemplateResolvers> = {}): CardTemplateResolvers => ({
  title: () => 'Ana',
  subtitle: () => '',
  subtitleIconKey: null,
  imageUrl: () => null,
  fieldItem: (_record, fieldKey, options) => (fieldKey === 'sumiu' ? null : {
    key: fieldKey,
    label: fieldKey === 'situacao' ? 'Situação (lista)' : undefined,
    value: fieldKey === 'vazio' ? '—' : `valor de ${fieldKey}`,
    badges: options?.badges ? [{ label: 'Nova', color: '#00aa00' }] : undefined,
    type: 'text',
  }),
  fieldLabel: (fieldKey) => `Rótulo ${fieldKey}`,
  fields: () => [],
  metaRows: () => [],
  tags: () => [{ id: 't1', name: 'Urgente', color: '#ff0000' }],
  actions: () => ACTIONS,
  isHidden: (_record, expr) => expr === 'esconde',
  label: (text) => (text.startsWith('@') ? `traduzido(${text})` : text),
  ...overrides,
});

const resolve = (nodes: CardNode[], overrides?: Partial<CardTemplateResolvers>) =>
  resolveCardNodes(nodes, record, resolvers(overrides));

describe('resolveCardNodes', () => {
  it('hiddenWhen verdadeiro tira o nó e tudo o que ele contém', () => {
    const nodes = resolve([
      { type: 'row', hiddenWhen: 'esconde', children: [{ type: 'title' }] },
      { type: 'title', hiddenWhen: 'mostra' },
    ]);
    expect(nodes).toEqual([{ kind: 'title', key: '1', text: 'Ana', size: undefined }]);
  });

  it('contêiner que fica sem filhos some — o cartão não desenha moldura vazia', () => {
    expect(resolve([{ type: 'row', children: [{ type: 'subtitle' }, { type: 'title', hiddenWhen: 'esconde' }] }])).toEqual([]);
  });

  it('campo vazio não ocupa espaço, salvo showEmpty', () => {
    expect(resolve([{ type: 'field', field: 'vazio' }])).toEqual([]);
    expect(resolve([{ type: 'field', field: 'vazio', showEmpty: true }])).toHaveLength(1);
  });

  it('campo que a tela não tem é ignorado', () => {
    expect(resolve([{ type: 'field', field: 'sumiu', showEmpty: true }])).toEqual([]);
  });

  it('label: true usa o rótulo de listagem e, sem ele, o rótulo do campo; texto passa pela tradução', () => {
    const [comListagem, semListagem, referencia] = resolve([
      { type: 'field', field: 'situacao', label: true },
      { type: 'field', field: 'nome', label: true },
      { type: 'field', field: 'nome', label: '@acme/card.nome' },
    ]);
    expect(comListagem).toMatchObject({ label: 'Situação (lista)' });
    expect(semListagem).toMatchObject({ label: 'Rótulo nome' });
    expect(referencia).toMatchObject({ label: 'traduzido(@acme/card.nome)' });
  });

  it('variant badge pede as etiquetas da opção', () => {
    const [node] = resolve([{ type: 'field', field: 'situacao', variant: 'badge' }]);
    expect(node).toMatchObject({ kind: 'field', variant: 'badge', item: { badges: [{ label: 'Nova', color: '#00aa00' }] } });
  });

  it('actions: todas por padrão, na ordem do cartão; include escolhe por chave, key ou sourceId, na ordem pedida', () => {
    const todas = resolve([{ type: 'actions' }]);
    expect(todas[0]).toMatchObject({ kind: 'actions', placement: 'inline' });
    expect((todas[0] as { actions: RecordCardAction[] }).actions.map((a) => a.key)).toEqual(['copyLink', 'delete', 'act-123']);

    const escolhidas = resolve([{ type: 'actions', include: ['com.acme:concluir', 'copyLink', 'nao-existe'] }]);
    expect((escolhidas[0] as { actions: RecordCardAction[] }).actions.map((a) => a.key)).toEqual(['act-123', 'copyLink']);

    const semExcluir = resolve([{ type: 'actions', exclude: ['delete', 'concluir'], placement: 'hover' }]);
    expect(semExcluir[0]).toMatchObject({ placement: 'hover' });
    expect((semExcluir[0] as { actions: RecordCardAction[] }).actions.map((a) => a.key)).toEqual(['copyLink']);
  });

  it('nenhuma ação sobrando, nenhum nó', () => {
    expect(resolve([{ type: 'actions', include: ['nao-existe'] }])).toEqual([]);
  });

  it('etiquetas, meta-linhas e campos de listagem somem quando vazios', () => {
    expect(resolve([{ type: 'tags' }], { tags: () => [] })).toEqual([]);
    expect(resolve([{ type: 'metaRows' }, { type: 'fields' }])).toEqual([]);
    expect(resolve([{ type: 'tags' }])).toEqual([{ kind: 'tags', key: '0', tags: [{ id: 't1', name: 'Urgente', color: '#ff0000' }] }]);
  });

  it('texto fixo passa por label: referência traduzida, texto do escritório intacto', () => {
    expect(resolve([{ type: 'text', text: '@acme/vencido' }, { type: 'text', text: 'Do escritório' }])).toEqual([
      { kind: 'text', key: '0', text: 'traduzido(@acme/vencido)', tone: 'default', size: undefined },
      { kind: 'text', key: '1', text: 'Do escritório', tone: 'default', size: undefined },
    ]);
  });

  it('as chaves seguem a posição na árvore', () => {
    const [row] = resolve([{ type: 'row', children: [{ type: 'divider' }, { type: 'stack', children: [{ type: 'spacer' }] }] }]);
    expect(row).toMatchObject({ key: '0', children: [{ key: '0.0' }, { key: '0.1', children: [{ key: '0.1.0' }] }] });
  });

  it('nó desconhecido (de um kernel mais novo) é ignorado', () => {
    expect(resolve([{ type: 'hologram' } as unknown as CardNode, { type: 'divider' }])).toEqual([{ kind: 'divider', key: '1' }]);
  });
});
