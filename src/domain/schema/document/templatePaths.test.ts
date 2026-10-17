import { describe, expect, it } from 'vitest';
import type { FieldDefinition } from '../../entities/entitySchemas';
import { createSchemaContext } from '../pathResolver';
import type { SchemaScreen } from '../pathResolver';
import { templatePathIssues } from './templatePaths';

const field = (overrides: Partial<FieldDefinition> & Pick<FieldDefinition, 'key' | 'label'>): FieldDefinition => ({
  origin: 'design',
  type: 'text',
  required: false,
  order: 0,
  ...overrides,
});

const screens: SchemaScreen[] = [
  {
    id: 'clients',
    titleSingular: 'Client',
    titleFieldKey: 'name',
    fields: [field({ key: 'name', label: 'Name' })],
  },
  {
    id: 'contracts',
    titleSingular: 'Contract',
    titleFieldKey: 'title',
    fields: [
      field({ key: 'title', label: 'Title' }),
      field({ key: 'client', label: 'Client', type: 'reference', refEntity: 'clients' }),
      field({ key: 'fee', label: 'Fee', type: 'currency' }),
    ],
  },
  {
    id: 'installments',
    titleSingular: 'Installment',
    titleFieldKey: 'amount',
    fields: [
      field({ key: 'contract', label: 'Contract', type: 'reference', refEntity: 'contracts' }),
      field({ key: 'amount', label: 'Amount', type: 'currency' }),
    ],
  },
];

const ctx = createSchemaContext(screens);
const DATASETS = [{ name: 'parcels', from: 'installments', via: 'contract' }];

describe('templatePathIssues', () => {
  it('aceita campo, caminho por vínculo e função sobre campo', () => {
    expect(templatePathIssues(ctx, 'contracts', [], ['{{title}} {{client.name}} {{formatMoney(fee)}}'])).toEqual([]);
  });

  it('aponta o campo que a tela não tem, e o caminho que o vínculo não alcança', () => {
    const issues = templatePathIssues(ctx, 'contracts', [], ['{{titel}} {{client.city}}']);
    expect(issues.map((issue) => [issue.path, issue.scope])).toEqual([
      ['titel', 'record'],
      ['client.city', 'record'],
    ]);
  });

  it('dentro do laço vale o campo do item e o do registro de fora', () => {
    const text = '{{#each parcels}}{{index}} {{amount}} {{title}} {{item}}{{/each}}';
    expect(templatePathIssues(ctx, 'contracts', DATASETS, [text])).toEqual([]);
  });

  it('no laço, o campo que não é do item nem do registro é apontado com o nome do laço', () => {
    const issues = templatePathIssues(ctx, 'contracts', DATASETS, ['{{#each parcels}}{{amont}}{{/each}}']);
    expect(issues.map((issue) => [issue.path, issue.scope])).toEqual([['amont', 'parcels']]);
  });

  it('não confere o que se lê num laço sobre algo que não é lista declarada', () => {
    expect(templatePathIssues(ctx, 'contracts', [], ['{{#each tags}}{{whatever}}{{/each}}'])).toHaveLength(1);
  });

  it('confere também o nome do arquivo e o que está dentro de um #if', () => {
    const issues = templatePathIssues(ctx, 'contracts', [], ['{{#if fee > 0}}{{nope}}{{/if}}', 'Contract - {{nme}}']);
    expect(issues.map((issue) => issue.path)).toEqual(['nope', 'nme']);
  });

  it('coleção desconhecida não produz aviso — quem recusa é quem resolve a tela', () => {
    expect(templatePathIssues(ctx, 'missing', [], ['{{anything}}'])).toEqual([]);
  });
});
