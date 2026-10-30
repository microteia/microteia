import { describe, expect, it } from 'vitest';
import {
  EMPTY_CARD_TEMPLATE_FORM,
  cardTemplateFormIssues,
  defaultCardTemplateSource,
  fromCardTemplateForm,
  previewCardTemplate,
  toCardTemplateForm,
} from './screenCardTemplateForm';
import { DEFAULT_CARD_BODY } from '../../../../../domain/schema/ui/cardTemplate';

const FIELDS = [{ key: 'nome', type: 'text' }, { key: 'situacao', type: 'select' }];

describe('a aba "Cartão" e a declaração gravada', () => {
  it('sem declaração, o formulário nasce no padrão e grava null — o cartão de sempre', () => {
    expect(toCardTemplateForm(undefined)).toEqual(EMPTY_CARD_TEMPLATE_FORM);
    expect(fromCardTemplateForm(EMPTY_CARD_TEMPLATE_FORM)).toBeNull();
  });

  it('o arranjo padrão não é escrito; o resto vai como foi escolhido', () => {
    expect(fromCardTemplateForm({ ...EMPTY_CARD_TEMPLATE_FORM, layout: 'list' })).toEqual({ layout: 'list' });
    expect(fromCardTemplateForm({ ...EMPTY_CARD_TEMPLATE_FORM, minWidth: 'sm' })).toEqual({ minWidth: 'sm' });
  });

  it('ida e volta: o que foi gravado é o que a aba mostra e o que ela grava de novo', () => {
    const stored = { layout: 'list', accent: { field: 'situacao' }, body: [{ type: 'title' }] };
    const form = toCardTemplateForm(stored);
    expect(form).toMatchObject({ layout: 'list', minWidth: 'md', custom: true });
    expect(fromCardTemplateForm(form)).toEqual(stored);
  });

  it('desligar o cartão personalizado mantém só o arranjo', () => {
    const form = { ...toCardTemplateForm({ layout: 'list', body: [{ type: 'title' }] }), custom: false };
    expect(fromCardTemplateForm(form)).toEqual({ layout: 'list' });
  });

  it('o arranjo é dos botões: um layout escrito no JSON não passa por cima deles', () => {
    const form = { ...EMPTY_CARD_TEMPLATE_FORM, custom: true, source: '{ "layout": "list", "body": [{ "type": "title" }] }' };
    expect(fromCardTemplateForm(form)).toEqual({ body: [{ type: 'title' }] });
  });

  it('JSON que não parseia é problema, e nunca vira gravação', () => {
    const form = { ...EMPTY_CARD_TEMPLATE_FORM, custom: true, source: '{ "body": [' };
    expect(cardTemplateFormIssues(form, FIELDS).map((issue) => issue.message))
      .toEqual(['@core.records/card-template.issue.json']);
  });

  it('o JSON tem de ser um objeto', () => {
    const form = { ...EMPTY_CARD_TEMPLATE_FORM, custom: true, source: '[]' };
    expect(cardTemplateFormIssues(form, FIELDS).map((issue) => issue.message))
      .toEqual(['@core.records/card-template.issue.not-object']);
  });

  it('o portão é o mesmo do pacote: campo que a tela não tem', () => {
    const form = { ...EMPTY_CARD_TEMPLATE_FORM, custom: true, source: '{ "body": [{ "type": "field", "field": "sumiu" }] }' };
    expect(cardTemplateFormIssues(form, FIELDS).map((issue) => issue.message))
      .toEqual(['@core.records/card-template.issue.field-unknown']);
  });

  it('o ponto de partida é o cartão padrão, válido e lido sem perda', () => {
    const form = { ...EMPTY_CARD_TEMPLATE_FORM, custom: true, source: defaultCardTemplateSource() };
    expect(cardTemplateFormIssues(form, FIELDS)).toEqual([]);
    expect(previewCardTemplate(form)?.body).toEqual(DEFAULT_CARD_BODY);
  });
});
