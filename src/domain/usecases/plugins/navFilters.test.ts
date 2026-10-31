import { describe, expect, it } from 'vitest';
import type { MarketplacePlugin, ScreenModuleTemplate, TemplateField } from '../../entities/MarketplacePlugin';
import type { Contribution } from '../../schema/plugin/contribution';
import { NAV_FILTER_PRESENCE_SINCE_KERNEL, UI_API_VERSION, UI_NAV_POINT } from '../../schema/ui/uiExtensionPoints';
import { FILTER_EMPTY_KEY, FILTER_FILLED_KEY } from '../../services/customFieldValues';
import { navFilterIssues, navFilterTokens } from './navFilters';

const FIELDS: TemplateField[] = [
  { key: 'title', label: 'Title', type: 'text', order: 0 },
  {
    key: 'status', label: 'Status', type: 'select', order: 1, filterable: true,
    options: [{ key: 'waiting', label: 'Waiting' }, { key: 'closed', label: 'Closed' }],
  },
  { key: 'urgent', label: 'Urgent', type: 'checkbox', order: 2, filterable: true },
  { key: 'dueDate', label: 'Due', type: 'date', order: 3, filterable: true },
  { key: 'stage', label: 'Stage', type: 'select', order: 4, filterable: true, lookupCollection: 'stages' },
  { key: 'notes', label: 'Notes', type: 'text', order: 5 },
  { key: 'attachment', label: 'File', type: 'file', order: 6, filterable: true },
  { key: 'owner', label: 'Owner', type: 'reference', order: 7, filterable: true, refEntity: 'people' },
] as TemplateField[];

const screen: ScreenModuleTemplate = {
  key: 'conversations',
  sourceId: 'com.acme.chat:conversations',
  titleSingular: 'Conversation',
  titlePlural: 'Conversations',
  icon: 'chat',
  fields: FIELDS,
  titleFieldKey: 'title',
};

const navOf = (metadata: Record<string, unknown>): Contribution => ({
  point: UI_NAV_POINT,
  id: 'waiting',
  apiVersion: UI_API_VERSION,
  metadata: { label: 'Item', icon: 'chat', order: 1, ...metadata },
});

const pkgWith = (contribution: Contribution, kernel = '^2.0.0'): MarketplacePlugin => ({
  summary: 'x',
  manifest: { id: 'com.acme.chat', version: '1.0.0', kernel, name: 'Chat', contributes: [contribution] },
  workflows: [],
  screens: [screen],
});

const messages = (metadata: Record<string, unknown>, kernel?: string): string[] =>
  navFilterIssues(pkgWith(navOf(metadata), kernel)).map((issue) => issue.message);

const PRESENCE_KERNEL = `^${NAV_FILTER_PRESENCE_SINCE_KERNEL}`;

describe('o filtro inicial de um item de menu', () => {
  it('aceita o mesmo recorte do selo, sobre campo filtrável e pela chave da opção', () => {
    expect(messages({
      screen: 'conversations',
      badge: { collection: 'conversations', when: 'status == "waiting"' },
      filter: [{ key: 'status', values: ['waiting'] }],
    })).toEqual([]);
  });

  it('aceita a tela do próprio pacote também pelo sourceId', () => {
    expect(messages({ screenSourceId: 'com.acme.chat:conversations', filter: [{ key: 'urgent', values: ['true'] }] }))
      .toEqual([]);
  });

  it('aceita a data pelas duas pontas do intervalo', () => {
    expect(messages({
      screen: 'conversations',
      filter: [{ key: 'dueDate', values: ['2026-10-01'] }, { key: 'dueDate:ate', values: ['2026-10-31'] }],
    })).toEqual([]);
  });

  it('sem filtro, não confere nada', () => {
    expect(messages({ screen: 'conversations' })).toEqual([]);
  });

  /** Era o defeito: a chave que a lista não reconhece abria a lista inteira, sem erro. */
  it('recusa a chave que não é de campo filtrável — nem o campo de arquivo, nem o que não existe', () => {
    for (const key of ['notes', 'attachment', 'missing', 'status:ate']) {
      expect(messages({ screen: 'conversations', filter: [{ key, values: ['x'] }] }))
        .toEqual(['@core.marketplace/issue.package.nav.filter.not-filterable']);
    }
  });

  it('recusa o rótulo no lugar da chave da opção, e o que a caixa de seleção e a data não aceitam', () => {
    expect(messages({ screen: 'conversations', filter: [{ key: 'status', values: ['Waiting', 'closed'] }] }))
      .toEqual(['@core.marketplace/issue.package.nav.filter.value']);
    expect(messages({ screen: 'conversations', filter: [{ key: 'urgent', values: ['yes'] }] }))
      .toEqual(['@core.marketplace/issue.package.nav.filter.value']);
    expect(messages({ screen: 'conversations', filter: [{ key: 'dueDate', values: ['01/10/2026'] }] }))
      .toEqual(['@core.marketplace/issue.package.nav.filter.value']);
  });

  /** A lista de opções do escritório só existe na instalação: daqui não há como dizer que o valor falta. */
  it('não julga o valor de uma lista de opções do escritório', () => {
    expect(messages({ screen: 'conversations', filter: [{ key: 'stage', values: ['anything'] }] })).toEqual([]);
  });

  it('recusa o filtro em item que abre uma página, e o filtro fora da forma', () => {
    expect(messages({ key: 'reports', filter: [{ key: 'status', values: ['waiting'] }] }))
      .toEqual(['@core.marketplace/issue.package.nav.filter.target']);
    for (const filter of [[], 'status', [{ key: 'status' }], [{ key: 'status', values: [] }], [{ key: '', values: ['x'] }]]) {
      expect(messages({ screen: 'conversations', filter })).toEqual(['@core.marketplace/issue.package.nav.filter.shape']);
    }
  });

  it('passa sem veredito o filtro sobre a tela de uma dependência', () => {
    expect(messages({ screenSourceId: 'com.other:tickets', filter: [{ key: 'whatever', values: ['x'] }] })).toEqual([]);
  });
});

/**
 * A fila do "que ainda não aconteceu" é um campo vazio: a fatura sem data de pagamento, o
 * chamado sem responsável. O selo a conta com `isEmpty(campo)`; sem o termo de presença, o clique abria
 * a lista inteira.
 */
describe('o termo de presença no filtro de um item de menu', () => {
  it('aceita campo vazio ou preenchido sobre data, referência e lista de opções', () => {
    expect(messages({
      screen: 'conversations',
      badge: { collection: 'conversations', when: 'isEmpty(dueDate) and isEmpty(owner)' },
      filter: [{ key: 'dueDate', empty: true }, { key: 'owner', empty: true }, { key: 'status', empty: false }],
    }, PRESENCE_KERNEL)).toEqual([]);
  });

  it('convive com o termo de valor no mesmo filtro', () => {
    expect(messages({
      screen: 'conversations',
      filter: [{ key: 'status', values: ['waiting'] }, { key: 'dueDate', empty: true }],
    }, PRESENCE_KERNEL)).toEqual([]);
  });

  /** Um kernel anterior recusa o pacote pela FORMA do filtro — o autor precisa ouvir o motivo de verdade. */
  it('exige o kernel que entende o termo', () => {
    expect(messages({ screen: 'conversations', filter: [{ key: 'dueDate', empty: true }] }))
      .toEqual(['@core.marketplace/issue.package.nav.filter.kernel']);
    expect(messages({ screenSourceId: 'com.other:tickets', filter: [{ key: 'whatever', empty: true }] }))
      .toEqual(['@core.marketplace/issue.package.nav.filter.kernel']);
  });

  it('não exige kernel novo de quem só filtra por valor', () => {
    expect(messages({ screen: 'conversations', filter: [{ key: 'status', values: ['waiting'] }] })).toEqual([]);
  });

  it('recusa a caixa de seleção com o motivo: ela nunca está vazia', () => {
    expect(messages({ screen: 'conversations', filter: [{ key: 'urgent', empty: true }] }, PRESENCE_KERNEL))
      .toEqual(['@core.marketplace/issue.package.nav.filter.presence']);
  });

  it('recusa o campo que não é filtrável, o arquivo, o que não existe e a ponta do intervalo', () => {
    for (const key of ['notes', 'attachment', 'missing', 'dueDate:ate']) {
      expect(messages({ screen: 'conversations', filter: [{ key, empty: false }] }, PRESENCE_KERNEL))
        .toEqual(['@core.marketplace/issue.package.nav.filter.not-filterable']);
    }
  });

  it('recusa o termo com valores E presença, e a presença que não é booleana', () => {
    for (const term of [{ key: 'dueDate', empty: true, values: ['2026-10-01'] }, { key: 'dueDate', empty: 'yes' }, { empty: true }]) {
      expect(messages({ screen: 'conversations', filter: [term] }, PRESENCE_KERNEL))
        .toEqual(['@core.marketplace/issue.package.nav.filter.shape']);
    }
  });
});

describe('navFilterTokens', () => {
  it('o termo de valor passa como está', () => {
    expect(navFilterTokens([{ key: 'status', values: ['waiting'] }])).toEqual([{ key: 'status', values: ['waiting'] }]);
  });

  it('os termos de presença se juntam nos dois filtros da tela, pela chave do campo', () => {
    expect(navFilterTokens([
      { key: 'dueDate', empty: true },
      { key: 'status', values: ['waiting'] },
      { key: 'owner', empty: true },
      { key: 'title', empty: false },
      { key: 'dueDate', empty: true },
    ])).toEqual([
      { key: 'status', values: ['waiting'] },
      { key: FILTER_EMPTY_KEY, values: ['dueDate', 'owner'] },
      { key: FILTER_FILLED_KEY, values: ['title'] },
    ]);
  });

  /** Um token sem `values` derrubaria a barra de filtros, que o lê como lista. */
  it('descarta o termo fora das duas formas', () => {
    const malformed = [{ key: 'status' }, { key: 'dueDate', empty: true, values: ['x'] }] as never[];
    expect(navFilterTokens(malformed)).toEqual([]);
  });
});
