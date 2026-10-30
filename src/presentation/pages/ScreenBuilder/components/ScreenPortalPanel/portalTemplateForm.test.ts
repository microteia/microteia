import { describe, expect, it } from 'vitest';
import {
  EMPTY_PORTAL_TEMPLATE_FORM,
  defaultPortalCardSource,
  defaultPortalDetailSource,
  fromPortalTemplateForm,
  portalTemplateFormIssues,
  toPortalTemplateForm,
} from './portalTemplateForm';
import { fromPortalForm, toPortalForm } from './screenPortalForm';

const EXPOSED = [{ key: 'amount', type: 'currency' }, { key: 'status', type: 'select' }];

describe('a seção "Aparência no portal" do Form Design', () => {
  it('nada tocado não grava nada — a tela continua no portal de sempre', () => {
    expect(fromPortalTemplateForm(EMPTY_PORTAL_TEMPLATE_FORM)).toBeNull();
    expect(fromPortalForm({ ...toPortalForm({ subject: 'self', fields: ['amount'] }) })).not.toHaveProperty('template');
  });

  it('o arranjo padrão (um por linha) não é escrito; a grade é', () => {
    expect(fromPortalTemplateForm({ ...EMPTY_PORTAL_TEMPLATE_FORM, cardMinWidth: 'lg' })).toEqual({ card: { minWidth: 'lg' } });
    expect(fromPortalTemplateForm({ ...EMPTY_PORTAL_TEMPLATE_FORM, cardLayout: 'grid' })).toEqual({ card: { layout: 'grid' } });
  });

  it('ida e volta: o gravado volta aos controles e sai igual', () => {
    const stored = {
      card: { layout: 'grid', accent: { field: 'status' }, body: [{ type: 'field', field: 'amount', variant: 'strong' }] },
      detail: { body: [{ type: 'section', title: '@acme/totals', children: [{ type: 'fields' }] }] },
    };
    const form = toPortalTemplateForm(stored);
    expect(form).toMatchObject({ cardLayout: 'grid', cardMinWidth: 'md', cardCustom: true, detailCustom: true });
    expect(JSON.parse(form.cardSource)).toEqual({ accent: { field: 'status' }, body: stored.card.body });
    expect(fromPortalTemplateForm(form)).toEqual(stored);
    expect(fromPortalForm(toPortalForm({ subject: 'self', fields: ['amount', 'status'], template: stored as never }))?.template).toEqual(stored);
  });

  it('desligar o desenho personalizado não grava o JSON que ficou no editor', () => {
    const form = { ...toPortalTemplateForm({ detail: { body: [{ type: 'fields' }] } }), detailCustom: false };
    expect(fromPortalTemplateForm(form)).toBeNull();
  });

  it('os pontos de partida são o padrão escrito na DSL, e passam no portão', () => {
    const form = { ...EMPTY_PORTAL_TEMPLATE_FORM, cardCustom: true, cardSource: defaultPortalCardSource(), detailCustom: true, detailSource: defaultPortalDetailSource() };
    expect(portalTemplateFormIssues(form, EXPOSED)).toEqual([]);
  });

  it('JSON que não parseia é problema com o lugar dele, antes de qualquer outra conferência', () => {
    const issues = portalTemplateFormIssues({ ...EMPTY_PORTAL_TEMPLATE_FORM, detailCustom: true, detailSource: '{ "body": [' }, EXPOSED);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ message: '@core.records/portal-template.issue.json', messageParams: { where: 'portal.template.detail' } });
  });

  it('campo que não sai do escritório é problema — o servidor o descartaria em silêncio', () => {
    const issues = portalTemplateFormIssues({
      ...EMPTY_PORTAL_TEMPLATE_FORM,
      cardCustom: true,
      cardSource: JSON.stringify({ body: [{ type: 'field', field: 'internalScore' }] }),
    }, EXPOSED);
    expect(issues).toEqual([{
      message: '@core.records/portal-template.issue.field-unexposed',
      messageParams: { where: 'portal.template.card.body[0].field', field: 'internalScore' },
    }]);
  });
});
