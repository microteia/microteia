import { describe, it, expect } from 'vitest';
import type { ScreenDefinition } from '../../entities/entitySchemas';
import { parseTemplate } from './templateGrammar';
import { documentTemplateIssues } from './documentTemplate';
import { buildStarterTemplate } from './starterTemplate';

const screen = (id: string, overrides: Partial<ScreenDefinition>): ScreenDefinition =>
  ({ id, titleSingular: id, titlePlural: `${id}s`, titleFieldKey: 'name', fields: [], ...overrides }) as ScreenDefinition;

const CLIENT = screen('client', { fields: [{ key: 'name', label: 'Name', type: 'text', required: true, order: 0 }] as never });
const CONTRACT = screen('contract', {
  titleSingular: 'Contract',
  titleFieldKey: 'title',
  fields: [
    { key: 'title', label: 'Title', type: 'text', required: true, order: 0 },
    { key: 'client', label: 'Client', type: 'reference', refEntity: 'client', required: false, order: 1 },
    { key: 'signedOn', label: 'Signed on', type: 'date', required: false, order: 2 },
    { key: 'fee', label: 'Fee', type: 'currency', required: false, order: 3 },
    { key: 'active', label: 'Active', type: 'checkbox', required: false, order: 4 },
    { key: 'status', label: 'Status', type: 'select', required: false, order: 5, options: [{ key: 'draft', label: 'Draft' }] },
    { key: 'phase', label: 'Phase', type: 'select', required: false, order: 6, lookupCollection: 'phases' },
    { key: 'scan', label: 'Scan', type: 'file', required: false, order: 7 },
  ] as never,
});
const INSTALLMENT = screen('installment', {
  titlePlural: 'Installments',
  fields: [
    { key: 'contract', label: 'Contract', type: 'reference', refEntity: 'contract', required: true, order: 0 },
    { key: 'dueDate', label: 'Due', type: 'date', required: true, order: 1 },
    { key: 'amount', label: 'Amount', type: 'currency', required: true, order: 2 },
  ] as never,
});

const TEXTS = { fieldsComment: 'fields', listComment: 'list', dateFormat: 'DD/MM/YYYY', yes: 'Yes', no: 'No', generatedOn: 'Generated on' };

const build = () => buildStarterTemplate({
  screen: CONTRACT,
  screens: [CLIENT, CONTRACT, INSTALLMENT],
  label: (value) => value,
  texts: TEXTS,
});

describe('buildStarterTemplate', () => {
  it('imprime cada campo pela forma certa: data, valor, vínculo até o título, opção pelo rótulo', () => {
    const { body } = build();

    expect(body).toContain('**Signed on:** {{formatDate(signedOn, "DD/MM/YYYY")}}');
    expect(body).toContain('**Fee:** {{formatMoney(fee)}}');
    expect(body).toContain('**Client:** {{client.name}}');
    expect(body).toContain('{{#if active}}Yes{{/if}}{{#if not active}}No{{/if}}');
    expect(body).toContain('{{#if status == "draft"}}Draft{{/if}}');
  });

  it('deixa de fora o que sairia como identificador: arquivo e opção de lista do escritório', () => {
    const { body } = build();

    expect(body).not.toContain('scan');
    expect(body).not.toContain('phase');
  });

  it('cada tela que aponta para esta vira uma lista declarada e uma tabela, ordenada pela data', () => {
    const { body, datasets } = build();

    expect(datasets).toEqual([{ name: 'installment', from: 'installment', via: 'contract', orderBy: 'dueDate' }]);
    expect(body).toContain('{{#each installment}}| {{index}} | {{formatDate(dueDate, "DD/MM/YYYY")}} | {{formatMoney(amount)}} |');
  });

  it('sai um modelo VÁLIDO, sem problema de gramática, com o nome do arquivo pelo título', () => {
    const starter = build();

    expect(parseTemplate(starter.body).issues).toEqual([]);
    expect(starter.fileName).toBe('Contract - {{title}}');
    expect(documentTemplateIssues({
      key: 'k', title: 't', collection: 'contract', format: 'markdown', ...starter,
    })).toEqual([]);
  });
});

describe('buildStarterTemplate — tela ligada a uma coleção de outro nome', () => {
  const anchor = screen('contract', { origin: 'builtin', titleFieldKey: '' } as Partial<ScreenDefinition>);
  const bound = { ...CONTRACT, id: 'contractPanel', dataCollection: 'contract' } as ScreenDefinition;
  const starter = (screens: ScreenDefinition[]) => buildStarterTemplate({
    screen: bound,
    screens,
    label: (value) => value,
    texts: TEXTS,
  });

  it.each([
    ['a âncora chega antes da tela', [CLIENT, anchor, bound, INSTALLMENT]],
    ['a âncora chega depois da tela', [CLIENT, bound, anchor, INSTALLMENT]],
  ])('acha os filhos que apontam para a coleção quando %s', (_, screens) => {
    expect(starter(screens).datasets).toEqual([{ name: 'installment', from: 'installment', via: 'contract', orderBy: 'dueDate' }]);
  });

  it('o vínculo para a coleção segue até o título da tela que a descreve, não da âncora', () => {
    const { body } = buildStarterTemplate({
      screen: INSTALLMENT,
      screens: [anchor, bound, INSTALLMENT],
      label: (value) => value,
      texts: TEXTS,
    });
    expect(body).toContain('**Contract:** {{contract.title}}');
  });
});
