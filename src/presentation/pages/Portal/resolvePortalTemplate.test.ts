import { describe, expect, it } from 'vitest';
import { resolvePortalNodes, portalCardArrangement, type PortalTemplateAnswers } from './resolvePortalTemplate';
import { DEFAULT_PORTAL_DETAIL_BODY } from '../../../domain/schema/ui/portalTemplate';
import type { PortalFieldView } from './Portal.viewmodel';

const view = (key: string, value: string, extra: Partial<PortalFieldView> = {}): PortalFieldView => ({
  key, label: key.toUpperCase(), value, href: null, color: null, ...extra,
});

const FIELDS = [view('number', 'NF-12'), view('amount', 'R$ 1.200,00'), view('status', 'Late', { color: '#e00' }), view('notes', '')];

const answers = (extra: Partial<PortalTemplateAnswers> = {}): PortalTemplateAnswers => ({
  title: 'Invoice NF-12',
  field: (key) => FIELDS.find((field) => field.key === key) ?? null,
  fields: FIELDS.filter((field) => field.value !== ''),
  summary: 'NUMBER: NF-12',
  updated: 'Updated on 10/30/2026',
  editLabel: 'Edit',
  hasActions: true,
  isHidden: (hiddenWhen) => hiddenWhen === 'hide',
  ...extra,
});

describe('resolvePortalNodes — o desenho respondido para um registro', () => {
  it('o registro aberto padrão, escrito na DSL, responde o que o padrão mostrava', () => {
    const nodes = resolvePortalNodes(DEFAULT_PORTAL_DETAIL_BODY, answers());
    expect(nodes.map((node) => node.kind)).toEqual(['row', 'actions', 'fields']);
    expect(nodes[0]).toMatchObject({ kind: 'row', justify: 'between', children: [{ kind: 'title', text: 'Invoice NF-12', size: 'xl' }, { kind: 'edit', label: 'Edit' }] });
    expect(nodes[2]).toMatchObject({ kind: 'fields', fields: [{ key: 'number' }, { key: 'amount' }, { key: 'status' }] });
  });

  it('o campo em destaque leva variante, tamanho, rótulo e a cor da opção', () => {
    const [node] = resolvePortalNodes([{ type: 'field', field: 'status', variant: 'badge', size: 'lg', label: true, icon: 'flag' }], answers());
    expect(node).toEqual({
      kind: 'field', key: '0', field: FIELDS[2], label: 'STATUS', iconKey: 'flag', variant: 'badge', size: 'lg',
    });
  });

  it('campo vazio não ocupa espaço — salvo `showEmpty`, que mostra o traço', () => {
    expect(resolvePortalNodes([{ type: 'field', field: 'notes' }], answers())).toEqual([]);
    expect(resolvePortalNodes([{ type: 'field', field: 'notes', showEmpty: true }], answers())[0]).toMatchObject({ field: { value: '—' } });
    expect(resolvePortalNodes([{ type: 'field', field: 'secret' }], answers())).toEqual([]);
  });

  it('`hiddenWhen` some com o nó e o que ele contém; o contêiner que ficou vazio também some', () => {
    expect(resolvePortalNodes([
      { type: 'section', title: 'Totals', children: [{ type: 'field', field: 'amount', hiddenWhen: 'hide' }] },
      { type: 'stack', hiddenWhen: 'hide', children: [{ type: 'title' }] },
      { type: 'text', text: 'Pay by Friday', tone: 'danger' },
    ], answers())).toEqual([{ kind: 'text', key: '2', text: 'Pay by Friday', tone: 'danger', size: undefined }]);
  });

  it('o botão de alterar e as ações só existem para quem os tem', () => {
    const none = answers({ editLabel: null, hasActions: false });
    expect(resolvePortalNodes([{ type: 'edit' }, { type: 'actions' }], none)).toEqual([]);
  });

  it('`fields.exclude` tira o que o desenho já mostrou em destaque', () => {
    expect(resolvePortalNodes([{ type: 'fields', exclude: ['status', 'amount'] }], answers())[0])
      .toMatchObject({ fields: [{ key: 'number' }] });
  });
});

describe('portalCardArrangement', () => {
  it('sem cartão declarado, `null`: a lista de sempre', () => {
    expect(portalCardArrangement({})).toBeNull();
    expect(portalCardArrangement({ template: { detail: { body: [{ type: 'fields' }] } } })).toBeNull();
    expect(portalCardArrangement(null)).toBeNull();
  });

  it('declarado, o padrão do portal é um por linha', () => {
    expect(portalCardArrangement({ template: { card: { body: [{ type: 'title' }] } } })).toEqual({ layout: 'list', minWidth: 'md' });
    expect(portalCardArrangement({ template: { card: { layout: 'grid', minWidth: 'lg' } } })).toEqual({ layout: 'grid', minWidth: 'lg' });
  });
});
