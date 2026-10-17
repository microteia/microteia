import { describe, expect, it } from 'vitest';
import type { DocumentTemplate, DocumentTemplateSpec } from './documentTemplate';
import {
  documentTemplateContribution,
  documentTemplateIssues,
  resolveDocumentTemplates,
  templatesForCollection,
} from './documentTemplate';

const payloadSpec = (overrides: Partial<DocumentTemplateSpec> = {}): DocumentTemplateSpec => ({
  key: 'payment-receipt',
  title: 'Payment receipt',
  source: 'payload',
  collection: '',
  format: 'markdown',
  body: '{{payer}}',
  parameters: [
    { key: 'payer', label: 'Payer', type: 'String', required: true },
    {
      key: 'address',
      label: 'Address',
      type: 'Object',
      fields: [{ key: 'city', label: 'City', type: 'String' }],
    },
    { key: 'items', label: 'Items', type: 'Object', list: true, fields: [{ key: 'amount', label: 'Amount', type: 'Number' }] },
  ],
  ...overrides,
});

const fields = (spec: Partial<DocumentTemplateSpec>) => documentTemplateIssues(spec).map((issue) => issue.field);

describe('validação do modelo de dados', () => {
  it('sem tela é válido quando a origem é o payload, com parâmetros aninhados e listas', () => {
    expect(documentTemplateIssues(payloadSpec())).toEqual([]);
  });

  it('sem parâmetros também é válido: qualquer objeto é aceito como vem', () => {
    expect(documentTemplateIssues(payloadSpec({ parameters: undefined }))).toEqual([]);
  });

  it('o modelo de registro continua exigindo a tela, e não declara parâmetros', () => {
    expect(fields({ ...payloadSpec(), source: 'record' })).toEqual(['collection', 'parameters']);
  });

  it('recusa lista de registros, destino no registro e exemplo que não é objeto', () => {
    expect(fields(payloadSpec({
      datasets: [{ name: 'x', from: 'y', via: 'z' }],
      destination: 'record',
      sample: [] as never,
    }))).toEqual(['datasets', 'destination', 'sample']);
  });

  it('confere a forma dos parâmetros em qualquer nível, com o caminho do problema', () => {
    const issues = documentTemplateIssues(payloadSpec({
      parameters: [
        { key: 'payer', label: 'Payer', type: 'String' },
        { key: 'payer', label: 'Again', type: 'String' },
        { key: 'client', label: 'Client', type: 'EntityReference' },
        { key: 'group', label: 'Group', type: 'Object', fields: [{ key: '1bad', label: 'Bad', type: 'String' }] },
        { key: 'empty', label: 'Empty', type: 'Object' },
        { key: 'weird', label: 'Weird', type: 'Money' as never },
      ],
    }));

    expect(issues.map((issue) => [issue.error, issue.errorParams?.key])).toEqual([
      ['@core.documents/template.parameter.duplicated', 'payer'],
      ['@core.documents/template.parameter.entity-missing', 'client'],
      ['@core.documents/template.parameter.key.invalid', 'group.1bad'],
      ['@core.documents/template.parameter.object-empty', 'empty'],
      ['@core.documents/template.parameter.type.invalid', 'weird'],
    ]);
  });
});

describe('resolução do modelo de dados', () => {
  it('vale sem tela instalada, e não é oferecido a registro nenhum', () => {
    const contribution = { ...documentTemplateContribution(payloadSpec()), pluginId: 'acme' };
    const resolved = resolveDocumentTemplates([contribution as never], []);

    expect(resolved).toMatchObject([{ key: 'payment-receipt', origin: 'plugin', collection: '' }]);
    expect(templatesForCollection(resolved, '')).toEqual([]);
  });

  it('o do escritório substitui o do pacote na mesma chave, como qualquer modelo', () => {
    const contribution = { ...documentTemplateContribution(payloadSpec()), pluginId: 'acme' };
    const own: DocumentTemplate = { ...payloadSpec({ title: 'Ours' }), id: 'payment-receipt' };

    expect(resolveDocumentTemplates([contribution as never], [own]))
      .toMatchObject([{ title: 'Ours', origin: 'tenant', overridesPlugin: true }]);
  });
});
