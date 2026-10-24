import { describe, expect, it } from 'vitest';
import type { MarketplacePlugin, ScreenModuleTemplate, TemplateField } from '../../entities/MarketplacePlugin';
import type { Contribution } from '../../schema/plugin/contribution';
import { UI_API_VERSION, UI_NAV_POINT } from '../../schema/ui/uiExtensionPoints';
import { navFilterIssues } from './navFilters';

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

const pkgWith = (...contributes: Contribution[]): MarketplacePlugin => ({
  summary: 'x',
  manifest: { id: 'com.acme.chat', version: '1.0.0', kernel: '^2.0.0', name: 'Chat', contributes },
  workflows: [],
  screens: [screen],
});

const messages = (metadata: Record<string, unknown>): string[] =>
  navFilterIssues(pkgWith(navOf(metadata))).map((issue) => issue.message);

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
