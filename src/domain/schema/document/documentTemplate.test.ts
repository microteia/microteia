import { describe, it, expect } from 'vitest';
import type { QualifiedContribution } from '../plugin/contribution';
import {
  documentTemplateContribution,
  documentTemplateIssues,
  documentTemplateOf,
  resolveDocumentTemplates,
  templateOutputs,
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
      (sourceId) => (sourceId === 'acme:payments' ? 'payments_2' : undefined),
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
      () => undefined,
    );

    expect(resolved.pluginId).toBe('com.b');
  });
});
