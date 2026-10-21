import { describe, expect, it } from 'vitest';
import type { MarketplacePlugin, TemplateField } from '../../entities/MarketplacePlugin';
import type { DocumentTemplateDataset } from '../../schema/document/documentTemplate';
import {
  DOCUMENT_DATASET_ORDER_LIST_SINCE_KERNEL,
  documentTemplateContribution,
} from '../../schema/document/documentTemplate';
import { packageDocumentTemplateIssues } from './pluginDocumentTemplates';
import { packageIssues } from './pluginReferences';

const field = (key: string, type: TemplateField['type'] = 'text'): TemplateField => ({
  key,
  label: key,
  type,
  required: false,
  order: 0,
});

const MOVEMENTS_SOURCE = 'com.acme.movimentos:movimentos';

const pkg = (dataset: Partial<DocumentTemplateDataset>, kernel = `^${DOCUMENT_DATASET_ORDER_LIST_SINCE_KERNEL}`): MarketplacePlugin => ({
  summary: 'x',
  manifest: {
    id: 'com.acme.movimentos',
    version: '1.0.0',
    kernel,
    name: 'Movimentos',
    contributes: [
      documentTemplateContribution({
        key: 'andamento',
        title: 'Andamento',
        collection: 'processos',
        format: 'markdown',
        body: '{{#each movimentacoes}}{{descricao}}{{/each}}',
        datasets: [{ name: 'movimentacoes', from: 'movimentos', fromSourceId: MOVEMENTS_SOURCE, via: 'processo', ...dataset }],
      }),
    ],
  },
  workflows: [],
  screens: [
    {
      key: 'processos',
      titleSingular: 'Processo',
      titlePlural: 'Processos',
      icon: 'folder',
      titleFieldKey: 'numero',
      fields: [field('numero')],
    },
    {
      key: 'movimentos',
      sourceId: MOVEMENTS_SOURCE,
      titleSingular: 'Movimento',
      titlePlural: 'Movimentos',
      icon: 'list',
      titleFieldKey: 'descricao',
      fields: [field('processo', 'reference'), field('descricao'), field('date', 'date'), field('time', 'time')],
    },
  ],
});

const messages = (plugin: MarketplacePlugin) => packageDocumentTemplateIssues(plugin).map((issue) => issue.message);

const byDateAndTime = [{ path: 'date', dir: 'desc' as const }, { path: 'time', dir: 'desc' as const }];

describe('packageDocumentTemplateIssues', () => {
  it('aceita a ordem por data e hora, com o kernel que a conhece', () => {
    expect(packageDocumentTemplateIssues(pkg({ orderBy: byDateAndTime }))).toEqual([]);
  });

  it('aceita a ordem em texto em qualquer kernel, como sempre', () => {
    expect(packageDocumentTemplateIssues(pkg({ orderBy: 'date', direction: 'desc' }, '^2.49.0'))).toEqual([]);
  });

  it('exige o kernel que entende a lista', () => {
    const issues = packageDocumentTemplateIssues(pkg({ orderBy: byDateAndTime }, '^2.49.0'));
    expect(issues).toEqual([{
      message: '@core.marketplace/issue.document.order.kernel',
      messageParams: { template: 'andamento', list: 'movimentacoes', minimum: DOCUMENT_DATASET_ORDER_LIST_SINCE_KERNEL },
    }]);
  });

  it('recusa chave que não é campo da tela dos filhos, nas duas formas', () => {
    expect(messages(pkg({ orderBy: [{ path: 'data', dir: 'desc' }] }))).toEqual(['@core.marketplace/issue.document.order.unknown']);
    expect(messages(pkg({ orderBy: 'data' }))).toEqual(['@core.marketplace/issue.document.order.unknown']);
  });

  it('aceita os campos de sistema que o latest também aceita', () => {
    expect(packageDocumentTemplateIssues(pkg({ orderBy: [{ path: 'createdAt', dir: 'desc' }] }))).toEqual([]);
  });

  it('não confere campo de tela que não vem no pacote', () => {
    expect(packageDocumentTemplateIssues(pkg({ fromSourceId: 'outra:tela', orderBy: [{ path: 'qualquer', dir: 'asc' }] })))
      .toEqual([]);
  });

  it('recusa a lista malformada, e a recusa chega ao portão do pacote', () => {
    const plugin = pkg({ orderBy: [{ path: 'date', dir: 'desc' }], direction: 'desc' });
    expect(messages(plugin)).toEqual(['@core.marketplace/issue.document.order.invalid']);
    expect(packageIssues(plugin).map((issue) => issue.message)).toContain('@core.marketplace/issue.document.order.invalid');
  });
});
