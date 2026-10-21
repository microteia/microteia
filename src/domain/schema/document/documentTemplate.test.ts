import { describe, it, expect } from 'vitest';
import type { QualifiedContribution } from '../plugin/contribution';
import {
  datasetOrder,
  documentTemplateContribution,
  documentTemplateFingerprint,
  documentTemplateIssues,
  documentTemplateOf,
  isTemplateCopyOutdated,
  resolveDocumentTemplates,
  templateOutputs,
  templateScreenIndex,
  templatesForCollection,
} from './documentTemplate';
import type { DocumentTemplate, DocumentTemplateSpec } from './documentTemplate';

const spec = (overrides: Partial<DocumentTemplateSpec> = {}): DocumentTemplateSpec => ({
  key: 'receipt',
  title: 'Receipt',
  collection: 'payments',
  format: 'markdown',
  body: 'Received from {{payer}}',
  ...overrides,
});

const packaged = (pluginId: string, one: DocumentTemplateSpec): QualifiedContribution => ({
  ...documentTemplateContribution(one),
  pluginId,
});

const tenant = (overrides: Partial<DocumentTemplate> = {}): DocumentTemplate => ({
  ...spec({ body: 'Tenant {{payer}}' }),
  id: 'doc-1',
  ...overrides,
});

describe('documentTemplateIssues', () => {
  it('aceita um modelo bem formado', () => {
    expect(documentTemplateIssues(spec())).toEqual([]);
  });

  it('recusa DOCX → PDF na autoria, e não na geração', () => {
    const issues = documentTemplateIssues(spec({ format: 'docx', body: undefined, content: 'UEsDBA==', outputs: ['pdf'] }));

    expect(issues.map((one) => one.error)).toEqual(['@core.documents/template.output.unsupported']);
  });

  it('recusa o arquivo acima do teto antes de decodificá-lo', () => {
    const content = 'A'.repeat(800 * 1024);
    const issues = documentTemplateIssues(spec({ format: 'docx', body: undefined, content }));

    expect(issues.map((one) => one.error)).toEqual(['@core.documents/template.content.too-large']);
  });

  it('cobra nome de lista que a expressão consegue ler, e sem repetir', () => {
    const issues = documentTemplateIssues(spec({
      datasets: [
        { name: 'parcelas', from: 'installments', via: 'contractId' },
        { name: 'parcelas', from: 'installments', via: 'contractId' },
        { name: 'com espaço', from: 'installments', via: 'contractId' },
      ],
    }));

    expect(issues.map((one) => one.error)).toEqual([
      '@core.documents/template.dataset.name.duplicated',
      '@core.documents/template.dataset.name.invalid',
    ]);
  });

  it('aceita a ordem em texto e em lista, e recusa a lista malformada', () => {
    const errors = (orderBy: unknown, direction?: 'asc' | 'desc') =>
      documentTemplateIssues(spec({
        datasets: [{ name: 'itens', from: 'items', via: 'orderId', orderBy: orderBy as never, ...(direction ? { direction } : {}) }],
      })).map((one) => one.error);

    expect(errors('date', 'desc')).toEqual([]);
    expect(errors([{ path: 'date', dir: 'desc' }, { path: 'time', dir: 'desc' }])).toEqual([]);
    expect(errors([])).toEqual(['@core.documents/template.dataset.order.empty']);
    expect(errors([{ path: 'date', dir: 'down' }, { path: '', dir: 'asc' }])).toEqual([
      '@core.documents/template.dataset.order.key.invalid',
      '@core.documents/template.dataset.order.key.invalid',
    ]);
    expect(errors([{ path: 'date', dir: 'desc' }], 'asc')).toEqual(['@core.documents/template.dataset.order.direction']);
    expect(errors(42)).toEqual(['@core.documents/template.dataset.order.invalid']);
  });

  it('datasetOrder lê as duas formas como lista', () => {
    expect(datasetOrder({ orderBy: 'date' })).toEqual([{ path: 'date', dir: 'asc' }]);
    expect(datasetOrder({ orderBy: ' date ', direction: 'desc' })).toEqual([{ path: 'date', dir: 'desc' }]);
    expect(datasetOrder({ orderBy: [{ path: 'date', dir: 'desc' }, { path: 'time', dir: 'asc' }] }))
      .toEqual([{ path: 'date', dir: 'desc' }, { path: 'time', dir: 'asc' }]);
    expect(datasetOrder({})).toEqual([]);
    expect(datasetOrder({ orderBy: '' })).toEqual([]);
  });

  it('leva a gramática do texto e do nome do arquivo para o campo certo', () => {
    const issues = documentTemplateIssues(spec({ body: '{{#each a}}', fileName: '{{/if}}' }));

    expect(issues.map((one) => one.field)).toEqual(['body', 'fileName']);
  });
});

describe('templateOutputs', () => {
  it('cai no que o formato sabe produzir quando nada é declarado', () => {
    expect(templateOutputs({ format: 'markdown' })).toEqual(['pdf', 'docx']);
    expect(templateOutputs({ format: 'docx' })).toEqual(['docx']);
    expect(templateOutputs({ format: 'markdown', outputs: ['pdf'] })).toEqual(['pdf']);
  });
});

describe('documentTemplateOf', () => {
  it('descarta a contribuição sem forma de modelo, e mantém a que só tem erro de gramática', () => {
    expect(documentTemplateOf(documentTemplateContribution(spec({ format: 'odt' as never })))).toBeNull();
    expect(documentTemplateOf(documentTemplateContribution(spec({ body: '{{#if x}}' })))?.key).toBe('receipt');
  });
});

describe('resolveDocumentTemplates', () => {
  it('o modelo do escritório vence o do pacote na mesma chave, e diz que o substitui', () => {
    const [resolved] = resolveDocumentTemplates([packaged('com.acme', spec())], [tenant()]);

    expect(resolved.origin).toBe('tenant');
    expect(resolved.body).toBe('Tenant {{payer}}');
    expect(resolved.overridesPlugin).toBe(true);
    expect(resolved.pluginId).toBe('com.acme');
  });

  it('entre dois pacotes vence o primeiro da ordem do registro', () => {
    const [resolved] = resolveDocumentTemplates(
      [packaged('com.a', spec({ title: 'A' })), packaged('com.b', spec({ title: 'B' }))],
      [],
    );

    expect(resolved.pluginId).toBe('com.a');
  });

  it('o escritório desliga a chave de um pacote sem desinstalar a extensão', () => {
    expect(resolveDocumentTemplates([packaged('com.acme', spec())], [tenant({ enabled: false })])).toEqual([]);
  });

  it('o modelo próprio do escritório não diz que substitui ninguém', () => {
    const [resolved] = resolveDocumentTemplates([], [tenant({ key: 'own' })]);

    expect(resolved.overridesPlugin).toBeUndefined();
    expect(resolved).not.toHaveProperty('enabled');
  });

  it('a tela de pacote pelo sourceId vira a chave INSTALADA — mesmo com sufixo', () => {
    const [resolved] = resolveDocumentTemplates(
      [packaged('com.acme', spec({ collection: '', screenSourceId: 'acme:payments' }))],
      [],
      templateScreenIndex([{ key: 'payments_2', sourceId: 'acme:payments' }]),
    );

    expect(resolved.collection).toBe('payments_2');
  });

  it('o modelo cuja tela não está instalada sai de circulação sem tomar a chave de outro pacote', () => {
    const [resolved] = resolveDocumentTemplates(
      [
        packaged('com.a', spec({ title: 'A', collection: '', screenSourceId: 'a:missing' })),
        packaged('com.b', spec({ title: 'B' })),
      ],
      [],
      templateScreenIndex([]),
    );

    expect(resolved.pluginId).toBe('com.b');
  });

  describe('tela cuja chave difere da coleção', () => {
    const screens = templateScreenIndex([
      { key: 'financeiro', sourceId: 'microteia:financeiro', collection: 'financials' },
      { key: 'parcelas', sourceId: 'microteia:parcelas', collection: 'installments' },
    ]);

    it('o screenSourceId e o fromSourceId viram a coleção FÍSICA, não a chave da tela', () => {
      const [resolved] = resolveDocumentTemplates(
        [packaged('com.acme', spec({
          collection: '',
          screenSourceId: 'microteia:financeiro',
          datasets: [{ name: 'parcelas', from: '', fromSourceId: 'microteia:parcelas', via: 'paymentId' }],
        }))],
        [],
        screens,
      );

      expect(resolved.collection).toBe('financials');
      expect(resolved.datasets?.[0].from).toBe('installments');
    });

    it('o modelo do escritório gravado com a chave da tela também chega à coleção', () => {
      const [resolved] = resolveDocumentTemplates(
        [],
        [tenant({ collection: 'financeiro', datasets: [{ name: 'parcelas', from: 'parcelas', via: 'paymentId' }] })],
        screens,
      );

      expect(resolved.collection).toBe('financials');
      expect(resolved.datasets?.[0].from).toBe('installments');
    });

    it('o valor que já é coleção passa intacto', () => {
      const [resolved] = resolveDocumentTemplates([], [tenant({ collection: 'financials' })], screens);

      expect(resolved.collection).toBe('financials');
    });

    it('o diálogo do registro acha o modelo pela coleção do registro', () => {
      const resolved = resolveDocumentTemplates(
        [packaged('com.acme', spec({ collection: '', screenSourceId: 'microteia:financeiro' }))],
        [],
        screens,
      );

      expect(templatesForCollection(resolved, 'financials').map((one) => one.key)).toEqual(['receipt']);
      expect(templatesForCollection(resolved, 'financeiro')).toEqual([]);
    });
  });
});

describe('documentTemplateFingerprint', () => {
  it('não depende da ordem das chaves', () => {
    const reordered = { body: 'Received from {{payer}}', format: 'markdown', collection: 'payments', title: 'Receipt', key: 'receipt' } as DocumentTemplateSpec;
    expect(documentTemplateFingerprint(reordered)).toBe(documentTemplateFingerprint(spec()));
  });

  it('muda quando o texto muda', () => {
    expect(documentTemplateFingerprint(spec({ body: 'Paid by {{payer}}' }))).not.toBe(documentTemplateFingerprint(spec()));
  });
});

describe('isTemplateCopyOutdated', () => {
  it('a cópia feita do original atual não está desatualizada', () => {
    expect(isTemplateCopyOutdated({ basedOn: documentTemplateFingerprint(spec()) }, spec())).toBe(false);
  });

  it('a extensão trocou o original depois da personalização', () => {
    expect(isTemplateCopyOutdated({ basedOn: documentTemplateFingerprint(spec()) }, spec({ body: 'New {{payer}}' }))).toBe(true);
  });

  it('cópia sem basedOn não é dada como desatualizada', () => {
    expect(isTemplateCopyOutdated({}, spec({ body: 'New {{payer}}' }))).toBe(false);
  });

  it('basedOn não vaza para o modelo resolvido', () => {
    const resolved = resolveDocumentTemplates([packaged('ext', spec())], [tenant({ key: 'receipt', basedOn: 'abc' })]);
    expect(resolved[0]).not.toHaveProperty('basedOn');
  });
});
