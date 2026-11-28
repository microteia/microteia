import { describe, expect, it } from 'vitest';
import { documentTemplateIssues, templateOutputs, textDocumentContent } from './documentTemplate';
import type { DocumentTemplateSpec } from './documentTemplate';
import { evaluateFieldExpression } from '../fieldExpression';
import { packageDocumentTemplateIssues } from '../../usecases/plugins/pluginDocumentTemplates';
import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';

/** Issue #47: o modelo de texto de leiaute fixo — TXT ou XML, na mesma gramática, sem marcação. */
const spec = (extra: Partial<DocumentTemplateSpec> = {}): Partial<DocumentTemplateSpec> => ({
  key: 'monthly-file',
  title: 'Monthly file',
  collection: 'companies',
  format: 'text',
  body: '|0000|{{taxId}}|',
  ...extra,
});
const errors = (extra: Partial<DocumentTemplateSpec> = {}) => documentTemplateIssues(spec(extra)).map((one) => one.error);
const EMPTY = { value: null, data: {} };

describe('o modelo de texto de leiaute fixo (#47)', () => {
  it('é válido com corpo, produz txt e xml, e nada mais', () => {
    expect(errors()).toEqual([]);
    expect(templateOutputs({ format: 'text' })).toEqual(['txt', 'xml']);
    expect(errors({ outputs: ['pdf'] })).toContain('@core.documents/template.output.unsupported');
  });

  it('exige o corpo, como o Markdown', () => {
    expect(errors({ body: '' })).toContain('@core.documents/template.body.missing');
  });

  it('confere a codificação e a quebra de linha, e só as aceita no formato texto', () => {
    expect(errors({ encoding: 'latin1', lineEnding: 'crlf' })).toEqual([]);
    expect(errors({ encoding: 'ascii' as never })).toContain('@core.documents/template.encoding.invalid');
    expect(errors({ lineEnding: 'cr' as never })).toContain('@core.documents/template.line-ending.invalid');
    expect(errors({ format: 'markdown', body: '# x', encoding: 'latin1' })).toContain('@core.documents/template.text-only');
  });

  it('as quebras do corpo viram TODAS a declarada, e o Latin-1 troca o que não representa por "?"', () => {
    expect(textDocumentContent('a\r\nb\nc', { lineEnding: 'crlf' })).toBe('a\r\nb\r\nc');
    expect(textDocumentContent('a\r\nb', {})).toBe('a\nb');
    expect(textDocumentContent('ação €😀', { encoding: 'latin1' })).toBe('ação ??');
    expect(textDocumentContent('ação €', { encoding: 'utf8' })).toBe('ação €');
  });
});

describe('padLeft e padRight — a coluna de largura fixa (#47)', () => {
  it('completam até a largura com o caractere pedido (espaço por padrão)', () => {
    expect(evaluateFieldExpression('padLeft(42, 5, "0")', EMPTY)).toBe('00042');
    expect(evaluateFieldExpression('padRight("ab", 4)', EMPTY)).toBe('ab  ');
  });

  it('cortam o que passa da largura — um valor longo não empurra as colunas seguintes', () => {
    expect(evaluateFieldExpression('padRight("abcdef", 3)', EMPTY)).toBe('abc');
    expect(evaluateFieldExpression('padLeft("abcdef", 3, "0")', EMPTY)).toBe('abc');
  });

  it('largura inválida devolve o texto como está, e vazio vira só preenchimento', () => {
    expect(evaluateFieldExpression('padLeft("ab", -1)', EMPTY)).toBe('ab');
    expect(evaluateFieldExpression('padLeft(null, 3, "0")', EMPTY)).toBe('000');
  });
});

describe('o pacote com modelo de texto declara o kernel que o entende (#47)', () => {
  const pkg = (kernel: string): MarketplacePlugin => ({
    manifest: {
      id: 'com.acme.files',
      kernel,
      contributes: [{ point: 'document.template', id: 'monthly-file', metadata: spec() }],
    },
  } as unknown as MarketplacePlugin);

  it('kernel antigo no intervalo é recusado; o atual passa', () => {
    expect(packageDocumentTemplateIssues(pkg('^2.36.0')).map((one) => one.message))
      .toContain('@core.marketplace/issue.document.text.kernel');
    expect(packageDocumentTemplateIssues(pkg('^2.151.0'))).toEqual([]);
  });
});
