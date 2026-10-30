import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PORTAL_CARD_BODY,
  DEFAULT_PORTAL_DETAIL_BODY,
  PORTAL_TEMPLATE_MAX_NODES,
  guestPortalTemplate,
  portalConditionReadsOnly,
  portalTemplatePlaces,
  readPortalTemplate,
} from './portalTemplate';
import { portalTemplateIssues } from './portalTemplateIssues';
import { asPortalDeclaration } from '../portal';

const EXPOSED = [
  { key: 'number', type: 'text' },
  { key: 'amount', type: 'currency' },
  { key: 'status', type: 'select' },
];

const exposedKeys = new Set(EXPOSED.map((field) => field.key));
const codes = (raw: unknown) => portalTemplateIssues(raw, EXPOSED).map((one) => `${one.messageParams.where} ${one.message.split('/').pop()}`);

describe('readPortalTemplate — a leitura tolerante do que está gravado', () => {
  it('ausente, nulo ou fora de forma é "sem declaração": o portal de sempre', () => {
    expect(readPortalTemplate(undefined)).toBeNull();
    expect(readPortalTemplate(null)).toBeNull();
    expect(readPortalTemplate([])).toBeNull();
    expect(readPortalTemplate({ card: { body: [{ type: 'nope' }] } })).toBeNull();
  });

  it('só o arranjo do cartão: muda a lista e mantém o cartão padrão', () => {
    expect(readPortalTemplate({ card: { layout: 'grid', minWidth: 'sm' } })).toEqual({ card: { layout: 'grid', minWidth: 'sm' } });
  });

  it('descarta nó desconhecido, opção fora da lista e o que o nó exige e não trouxe', () => {
    expect(readPortalTemplate({
      detail: {
        body: [
          { type: 'section', title: '  @acme/data  ', gap: 'huge', children: [{ type: 'field' }, { type: 'field', field: 'amount', variant: 'loud' }] },
          { type: 'avatar' },
          { type: 'text', text: '' },
        ],
      },
    })).toEqual({
      detail: { body: [{ type: 'section', title: '@acme/data', children: [{ type: 'field', field: 'amount' }] }] },
    });
  });

  it('no cartão, alterar e as ações não existem — o toque abre o registro', () => {
    expect(readPortalTemplate({ card: { body: [{ type: 'title' }, { type: 'edit' }, { type: 'actions' }] } }))
      .toEqual({ card: { body: [{ type: 'title' }] } });
  });

  it('o teto de nós corta o excesso', () => {
    const body = Array.from({ length: PORTAL_TEMPLATE_MAX_NODES + 10 }, () => ({ type: 'divider' }));
    expect(readPortalTemplate({ detail: { body } })?.detail?.body).toHaveLength(PORTAL_TEMPLATE_MAX_NODES);
  });

  it('viaja dentro da declaração `portal`, lida pela mesma porta das outras chaves', () => {
    const portal = asPortalDeclaration({ subject: 'self', fields: ['number'], template: { card: { layout: 'grid', junk: 1 } } });
    expect(portal?.template).toEqual({ card: { layout: 'grid' } });
    expect(asPortalDeclaration({ subject: 'self', fields: ['number'] })).not.toHaveProperty('template');
  });
});

describe('o padrão escrito na DSL', () => {
  it('o cartão e o registro aberto padrão passam no próprio portão', () => {
    expect(portalTemplateIssues({ card: { body: DEFAULT_PORTAL_CARD_BODY }, detail: { body: DEFAULT_PORTAL_DETAIL_BODY } }, EXPOSED)).toEqual([]);
  });

  it('portalTemplatePlaces acha o nó em qualquer profundidade', () => {
    expect(portalTemplatePlaces(DEFAULT_PORTAL_DETAIL_BODY, 'edit')).toBe(true);
    expect(portalTemplatePlaces(DEFAULT_PORTAL_DETAIL_BODY, 'actions')).toBe(true);
    expect(portalTemplatePlaces([{ type: 'fields' }], 'edit')).toBe(false);
    expect(portalTemplatePlaces(undefined, 'edit')).toBe(false);
  });
});

describe('guestPortalTemplate — o que sai para o convidado', () => {
  const upper = (text: string) => text.toUpperCase();

  it('a condição só passa se lê apenas o exposto, e se parseia', () => {
    expect(portalConditionReadsOnly('amount > 10 and status == "late"', exposedKeys)).toBe(true);
    expect(portalConditionReadsOnly('today() > 0 and amount > 1', exposedKeys)).toBe(true);
    expect(portalConditionReadsOnly('score < 300', exposedKeys)).toBe(false);
    expect(portalConditionReadsOnly('amount >', exposedKeys)).toBe(false);
  });

  it('some o nó de campo interno, o nó cuja condição o lê, e a faixa por ele', () => {
    const guest = guestPortalTemplate(readPortalTemplate({
      card: {
        accent: { field: 'risk' },
        body: [
          { type: 'field', field: 'risk' },
          { type: 'row', hiddenWhen: 'risk > 3', children: [{ type: 'title' }] },
          { type: 'field', field: 'status', variant: 'badge', label: '@acme/status' },
        ],
      },
    }), exposedKeys, upper);
    expect(guest).toEqual({ card: { body: [{ type: 'field', field: 'status', variant: 'badge', label: '@ACME/STATUS' }] } });
  });

  it('traduz o texto fixo e o título de seção; `label: true` fica para o rótulo do campo', () => {
    const guest = guestPortalTemplate(readPortalTemplate({
      detail: {
        body: [
          { type: 'section', title: '@acme/totals', children: [{ type: 'field', field: 'amount', label: true }] },
          { type: 'text', text: 'Texto do escritório' },
          { type: 'fields', exclude: ['amount', 'risk'] },
        ],
      },
    }), exposedKeys, upper);
    expect(guest?.detail?.body).toEqual([
      { type: 'section', title: '@ACME/TOTALS', children: [{ type: 'field', field: 'amount', label: true }] },
      { type: 'text', text: 'TEXTO DO ESCRITÓRIO' },
      { type: 'fields', exclude: ['amount'] },
    ]);
  });

  it('o que sobra vazio volta ao padrão', () => {
    expect(guestPortalTemplate(readPortalTemplate({ detail: { body: [{ type: 'field', field: 'risk' }] } }), exposedKeys, upper)).toBeNull();
    expect(guestPortalTemplate(null, exposedKeys, upper)).toBeNull();
  });
});

describe('portalTemplateIssues — o portão da autoria', () => {
  it('sem declaração não há o que conferir', () => {
    expect(portalTemplateIssues(undefined, EXPOSED)).toEqual([]);
    expect(portalTemplateIssues(null, EXPOSED)).toEqual([]);
  });

  it('aponta cada defeito com o caminho dele', () => {
    expect(codes({
      card: {
        layout: 'masonry',
        accent: { field: 'amount' },
        body: [{ type: 'edit' }, { type: 'field', field: 'risk' }, { type: 'icon', icon: 'nope' }],
      },
      detail: {
        body: [
          { type: 'text' },
          { type: 'title', hiddenWhen: 'score < 300' },
          { type: 'title', hiddenWhen: 'amount >' },
          { type: 'fields', exclude: 'amount' },
          { type: 'wat' },
        ],
      },
    })).toEqual([
      'portal.template.card.layout card-template.issue.option',
      'portal.template.card.accent.field card-template.issue.accent-field',
      'portal.template.card.body[0].type portal-template.issue.detail-only',
      'portal.template.card.body[1].field portal-template.issue.field-unexposed',
      'portal.template.card.body[2].icon card-template.issue.icon-unknown',
      'portal.template.detail.body[0].text card-template.issue.text-missing',
      'portal.template.detail.body[1].hiddenWhen portal-template.issue.expression-unexposed',
      'portal.template.detail.body[2].hiddenWhen card-template.issue.expression',
      'portal.template.detail.body[3].exclude card-template.issue.key-list',
      'portal.template.detail.body[4].type card-template.issue.node-type',
    ]);
  });

  it('o desenho de destaque que só lê o exposto passa', () => {
    expect(portalTemplateIssues({
      card: { layout: 'grid', minWidth: 'lg', accent: { field: 'status' }, body: [{ type: 'field', field: 'amount', variant: 'strong', size: 'xl' }] },
      detail: {
        body: [
          { type: 'section', title: '@acme/totals', children: [{ type: 'field', field: 'amount', size: 'xl', label: true }] },
          { type: 'text', text: '@acme/late', tone: 'danger', hiddenWhen: 'status != "late"' },
          { type: 'edit' },
          { type: 'actions' },
          { type: 'fields', exclude: ['amount'] },
        ],
      },
    }, EXPOSED)).toEqual([]);
  });
});
