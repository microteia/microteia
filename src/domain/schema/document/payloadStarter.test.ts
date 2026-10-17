import { describe, expect, it } from 'vitest';
import type { WorkflowParameter } from '../../entities/Workflow';
import { buildPayloadStarterTemplate, samplePayloadFrom } from './payloadStarter';
import { parseTemplate } from './templateGrammar';

const PARAMETERS: WorkflowParameter[] = [
  { key: 'payer', label: 'Payer', type: 'String' },
  { key: 'paidOn', label: 'Paid on', type: 'Date' },
  { key: 'confirmed', label: 'Confirmed', type: 'Boolean' },
  { key: 'client', label: 'Client', type: 'EntityReference', entityType: 'persons' },
  { key: 'address', label: 'Address', type: 'Object', fields: [{ key: 'city', label: 'City', type: 'String' }] },
  {
    key: 'items',
    label: 'Items',
    type: 'Object',
    list: true,
    fields: [
      { key: 'description', label: 'Description', type: 'String' },
      { key: 'amount', label: 'Amount', type: 'Number' },
    ],
  },
  { key: 'tags', label: 'Tags', type: 'String', list: true },
];

const starter = () => buildPayloadStarterTemplate({
  title: 'Receipt',
  parameters: PARAMETERS,
  titleFieldOf: (collection) => (collection === 'persons' ? 'name' : undefined),
  label: (text) => text,
  texts: { comment: 'Edit me', dateFormat: 'MM/DD/YYYY', yes: 'Yes', no: 'No' },
});

describe('buildPayloadStarterTemplate', () => {
  it('escreve um texto que a gramática lê sem problema nenhum', () => {
    expect(parseTemplate(starter()).issues).toEqual([]);
  });

  it('cada tipo sai pela marca que o imprime', () => {
    const text = starter();
    expect(text).toContain('**Payer:** {{payer}}');
    expect(text).toContain('{{formatDate(paidOn, "MM/DD/YYYY")}}');
    expect(text).toContain('{{#if confirmed}}Yes{{/if}}{{#if not confirmed}}No{{/if}}');
    expect(text).toContain('{{client.name}}');
    expect(text).toContain('**City:** {{address.city}}');
  });

  it('lista de grupos vira tabela; lista simples, itens com {{item}}', () => {
    const text = starter();
    expect(text).toContain('| Description | Amount |');
    expect(text).toContain('{{#each items}}| {{description}} | {{amount}} |');
    expect(text).toContain('{{#each tags}}- {{item}}');
  });
});

describe('samplePayloadFrom', () => {
  it('um esqueleto no formato dos parâmetros, com um item por lista', () => {
    expect(samplePayloadFrom(PARAMETERS)).toEqual({
      payer: '',
      paidOn: '2026-01-31',
      confirmed: false,
      client: '',
      address: { city: '' },
      items: [{ description: '', amount: 0 }],
      tags: [''],
    });
  });
});
